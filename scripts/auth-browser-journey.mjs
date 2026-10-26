import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { apiBase, assertNoBrowserErrors, frontendOrigin, openBrowser, watchPage } from './browser-utils.mjs';

const testApiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL || apiBase;
const apiOrigin = new URL(testApiBase).origin;
const fixtureMobile = '09121234567';
const fixtureMobileE164 = '+989121234567';
const fixtureOtp = '654321';
const fixtureSession = randomBytes(32).toString('hex');
const fixtureUserId = '00000000-0000-4000-8000-000000000204';
const fixtureUser = { id: fixtureUserId, mobile_e164: fixtureMobileE164, role: 'customer' };

let sessionActive = false;
let currentCsrf = '';
let challengeRequests = 0;
let acceptedChallenges = 0;
let verifyRequests = 0;
let logoutRequests = 0;
let acceptedLogouts = 0;
let conceptsRequests = 0;
let sessionRequests = 0;
const csrfValues = [];
const apiCalls = [];
const unexpectedApiCalls = [];

function requestHasSession(request) {
  const cookieHeader = request.headers().cookie || '';
  return cookieHeader.split(';').some(part => part.trim() === `aroman_session=${fixtureSession}`);
}

function isAuthenticated(request) {
  return sessionActive && requestHasSession(request);
}

function corsHeaders(request) {
  const origin = request.headers().origin || frontendOrigin;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, x-csrf-token',
    vary: 'Origin',
  };
}

function jsonResponse(request, status, payload, extraHeaders = {}) {
  return {
    status,
    headers: {
      ...corsHeaders(request),
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

const browser = await openBrowser();
const context = await browser.newContext();
const page = await context.newPage();
const report = watchPage(page, (status, url) =>
  (status === 401 || status === 403) && new URL(url).pathname === '/api/v1/auth/session',
);

try {
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    apiCalls.push({ method, path });

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(request) });
      return;
    }

    if (path === '/api/v1/auth/challenges' && method === 'POST') {
      challengeRequests += 1;
      const body = request.postDataJSON();
      const accepted = body.mobile === fixtureMobile;
      if (accepted) acceptedChallenges += 1;
      await route.fulfill(jsonResponse(request, accepted ? 202 : 422, {
        message: accepted ? 'If delivery is available, a code has been sent' : 'Invalid mobile number',
      }));
      return;
    }

    if (path === '/api/v1/auth/verify' && method === 'POST') {
      verifyRequests += 1;
      const body = request.postDataJSON();
      if (body.mobile !== fixtureMobile || body.code !== fixtureOtp) {
        await route.fulfill(jsonResponse(request, 400, { detail: 'Invalid or expired code' }));
        return;
      }
      sessionActive = true;
      currentCsrf = randomBytes(32).toString('hex');
      csrfValues.push(currentCsrf);
      await route.fulfill(jsonResponse(request, 200, {
        user_id: fixtureUserId,
        csrf_token: currentCsrf,
      }, {
        'set-cookie': `aroman_session=${fixtureSession}; HttpOnly; Path=/api/v1; SameSite=Lax`,
      }));
      return;
    }

    if (path === '/api/v1/auth/session' && method === 'GET') {
      sessionRequests += 1;
      if (!isAuthenticated(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      await route.fulfill(jsonResponse(request, 200, { user_id: fixtureUserId, role: 'customer' }));
      return;
    }

    if (path === '/api/v1/auth/csrf' && method === 'GET') {
      if (!isAuthenticated(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      currentCsrf = randomBytes(32).toString('hex');
      csrfValues.push(currentCsrf);
      await route.fulfill(jsonResponse(request, 200, { csrf_token: currentCsrf }));
      return;
    }

    if (path === '/api/v1/users/me' && method === 'GET') {
      await route.fulfill(isAuthenticated(request)
        ? jsonResponse(request, 200, fixtureUser)
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }

    if (path === '/api/v1/fragrance-concepts' && method === 'GET') {
      conceptsRequests += 1;
      await route.fulfill(isAuthenticated(request)
        ? jsonResponse(request, 200, [])
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }

    if (path === '/api/v1/auth/session' && method === 'DELETE') {
      logoutRequests += 1;
      const csrf = request.headers()['x-csrf-token'];
      if (!isAuthenticated(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      if (!csrf || csrf !== currentCsrf) {
        await route.fulfill(jsonResponse(request, 403, { code: 'csrf_invalid', detail: 'CSRF token required' }));
        return;
      }
      acceptedLogouts += 1;
      sessionActive = false;
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders(request),
          'set-cookie': 'aroman_session=; Max-Age=0; Path=/api/v1; HttpOnly; SameSite=Lax',
        },
      });
      return;
    }

    unexpectedApiCalls.push({ method, path });
    await route.fulfill(jsonResponse(request, 500, { detail: 'Unexpected isolated auth test API call' }));
  });

  await page.goto(`${frontendOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'ورود به آرومان' }).waitFor();
  await page.getByLabel('شماره موبایل').fill(fixtureMobile);
  const challengeResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' &&
    response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  const challengeResponse = await challengeResponsePromise;
  assert.equal(challengeResponse.status(), 202, 'Challenge request should be accepted');
  assert.equal(challengeRequests, 1, 'Exactly one challenge request should be made');
  assert.equal(acceptedChallenges, 1, 'The fixture should accept the requested mobile');
  const challengeBody = await challengeResponse.json();
  assert.equal(Object.hasOwn(challengeBody, 'code'), false, 'Challenge response must not contain an OTP');
  assert.equal(Object.hasOwn(challengeBody, 'otp'), false, 'Challenge response must not contain an OTP');
  await page.getByLabel('کد شش رقمی').fill(fixtureOtp);

  const verifyResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' &&
    response.request().method() === 'POST',
  );
  const firstConceptsResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' &&
    response.status() === 200,
  );
  await page.getByRole('button', { name: 'تأیید و ورود' }).click();
  const verifyResponse = await verifyResponsePromise;
  assert.equal(verifyResponse.status(), 200, 'Valid fixture OTP should authenticate');
  assert.equal(verifyRequests, 1, 'Verification should be submitted once');
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
  await page.getByText(fixtureMobileE164, { exact: true }).waitFor();
  await firstConceptsResponsePromise;

  const cookieScopeUrl = `${apiOrigin}/api/v1/auth/session`;
  const cookieAfterVerify = (await context.cookies(cookieScopeUrl)).find(cookie => cookie.name === 'aroman_session');
  const verificationCookieIsCorrect = Boolean(cookieAfterVerify) &&
    cookieAfterVerify.httpOnly && cookieAfterVerify.sameSite === 'Lax' &&
    cookieAfterVerify.path === '/api/v1';
  assert.equal(verificationCookieIsCorrect, true, 'Browser should receive the scoped HttpOnly session cookie');

  const csrfCountBeforeReload = csrfValues.length;
  const reloadCsrfPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/csrf' &&
    response.request().method() === 'GET',
  );
  const reloadConceptsPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' &&
    response.status() === 200,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await Promise.all([reloadCsrfPromise, reloadConceptsPromise]);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
  await page.getByText(fixtureMobileE164, { exact: true }).waitFor();
  const csrfAdvancedAfterReload = csrfValues.length > csrfCountBeforeReload &&
    csrfValues.at(-1) !== csrfValues.at(-2);
  assert.equal(csrfAdvancedAfterReload, true, 'Reload should restore session and rotate CSRF');

  const invalidLogoutStatus = await page.evaluate(async apiUrl => {
    const response = await fetch(`${apiUrl}/auth/session`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'invalid-test-csrf' },
    });
    return response.status;
  }, testApiBase);
  assert.equal(invalidLogoutStatus, 403, 'Logout with stale CSRF should be rejected');
  const sessionAfterRejectedLogout = await page.evaluate(async apiUrl => {
    const response = await fetch(`${apiUrl}/auth/session`, { credentials: 'include' });
    return response.status;
  }, testApiBase);
  assert.equal(sessionAfterRejectedLogout, 200, 'Rejected logout should preserve the active session');

  const logoutResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/session' &&
    response.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'خروج' }).click();
  const logoutResponse = await logoutResponsePromise;
  assert.equal(logoutResponse.status(), 204, 'Logout should succeed with the current CSRF token');
  assert.equal(logoutRequests, 2, 'One rejected and one valid logout request should be submitted');
  assert.equal(acceptedLogouts, 1, 'Only the valid CSRF logout should revoke the session');
  await page.locator('#main').getByRole('link', { name: 'ورود' }).waitFor();
  const cookieAfterLogout = (await context.cookies(cookieScopeUrl)).some(cookie => cookie.name === 'aroman_session');
  assert.equal(cookieAfterLogout, false, 'Logout should expire the browser session cookie');

  const anonymousReloadSession = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/session' &&
    response.status() === 401,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await anonymousReloadSession;
  await page.locator('#main').getByRole('link', { name: 'ورود' }).waitFor();
  assert.equal(sessionActive, false, 'Logout should revoke the isolated session');
  assert.ok(sessionRequests >= 3, 'Session restoration should be checked on login and account reloads');
  assert.ok(conceptsRequests >= 2, 'Concept list should load only during authenticated account states');
  assert.equal(unexpectedApiCalls.length, 0, 'All API calls should match the isolated fixture contract');
  assertNoBrowserErrors(report, 'isolated authentication browser journey');

  console.log(
    `Auth browser PASS: ${challengeRequests} challenge, ${verifyRequests} verify, ${sessionRequests} session checks, ${logoutRequests} logout; all API requests intercepted.`,
  );
} finally {
  await browser.close();
}
