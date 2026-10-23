import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  apiBase,
  assertNoBrowserErrors,
  frontendOrigin,
  openBrowser,
  watchPage,
} from './browser-utils.mjs';

const testApiBase = (process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL || apiBase).replace(/\/+$/, '');
const apiOrigin = new URL(testApiBase).origin;
const fixtureMobile = '09121234567';
const fixtureMobileE164 = '+989121234567';
const fixtureOtp = '654321';
const fixtureSession = randomBytes(32).toString('hex');
const fixtureUserId = '00000000-0000-4000-8000-000000000304';
const fixtureConceptId = '00000000-0000-4000-8000-000000000901';
const syntheticFixtureLabel = 'Synthetic Guided journey fixture; not a real catalog.';

// These DTO-shaped records are isolated synthetic test fixtures, never live catalog data.
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const families = [
  ['floral', 'گلی'],
  ['citrus', 'مرکباتی'],
  ['woody', 'چوبی'],
  ['amber', 'کهربایی'],
  ['fresh', 'تازه'],
  ['gourmand', 'خوراکی'],
].map(([slug, name], index) => ({
  id: uuid(index + 1),
  slug,
  name,
  description: `دادهٔ ساختگی آزمون برای خانوادهٔ ${name}`,
  is_demo: true,
}));

const syntheticNoteRows = [
  ['rose', 'رز', 1], ['jasmine', 'یاس', 1],
  ['bergamot', 'ترنج', 2], ['lemon', 'لیمو', 2],
  ['cedar', 'سدر', 3], ['sandalwood', 'چوب صندل', 3],
  ['amber', 'کهربا', 4], ['vanilla', 'وانیل', 4],
  ['mint', 'نعناع', 5], ['green-tea', 'چای سبز', 5],
  ['cocoa', 'کاکائو', 6], ['coffee', 'قهوه', 6],
];
const notes = syntheticNoteRows.map(([slug, name, familyNumber], index) => ({
  id: uuid(index + 100),
  slug,
  name,
  description: `دادهٔ ساختگی آزمون برای نت ${name}`,
  is_demo: true,
  family_id: uuid(familyNumber),
}));
const fixtureUser = { id: fixtureUserId, mobile_e164: fixtureMobileE164, role: 'customer' };

const layerOrder = ['top', 'heart', 'base'];
let sessionActive = false;
let currentCsrf = '';
let challengeRequests = 0;
let verificationRequests = 0;
let conceptCreates = 0;
let conceptReads = 0;
let savedConcept = null;
const unexpectedApiCalls = [];
const apiRequests = [];
const csrfValues = [];

function requestHasSession(request) {
  const cookieHeader = request.headers().cookie || '';
  return cookieHeader.split(';').some(part => part.trim() === `aroman_session=${fixtureSession}`);
}

function authenticatedRequest(request) {
  return sessionActive && requestHasSession(request);
}

function corsHeaders(request) {
  return {
    'access-control-allow-origin': request.headers().origin || frontendOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

function normalizedSelections(selections) {
  return [...selections].sort((left, right) =>
    layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer) || left.position - right.position,
  );
}

function hasExactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function isValidConceptPayload(payload) {
  if (!hasExactKeys(payload, ['name', 'notes']) || typeof payload.name !== 'string' ||
      !payload.name.trim() || !Array.isArray(payload.notes) || payload.notes.length < 1 ||
      payload.notes.length > 6) return false;

  const ids = new Set();
  const positionsByLayer = new Map(layerOrder.map(layer => [layer, []]));
  for (const selection of payload.notes) {
    if (!hasExactKeys(selection, ['note_id', 'layer', 'position']) ||
        typeof selection.note_id !== 'string' || !notes.some(note => note.id === selection.note_id) ||
        ids.has(selection.note_id) || !positionsByLayer.has(selection.layer) ||
        !Number.isInteger(selection.position) || selection.position < 0) return false;
    ids.add(selection.note_id);
    positionsByLayer.get(selection.layer).push(selection.position);
  }

  return [...positionsByLayer.values()].every(positions => {
    positions.sort((left, right) => left - right);
    return positions.every((position, index) => position === index);
  });
}

function conceptCreateIsValid(payload, visibleName, visibleSelections) {
  return isValidConceptPayload(payload) && payload.name === visibleName &&
    JSON.stringify(normalizedSelections(payload.notes)) ===
      JSON.stringify(normalizedSelections(visibleSelections));
}

function sameConceptRecord(candidate, expected) {
  return Boolean(candidate && expected) && candidate.id === expected.id &&
    candidate.name === expected.name &&
    JSON.stringify(normalizedSelections(candidate.notes)) ===
      JSON.stringify(normalizedSelections(expected.notes));
}

function statusAllowsWatcher(status, url) {
  return status === 401 && new URL(url).pathname === '/api/v1/auth/session';
}

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const browserReport = watchPage(page, statusAllowsWatcher);

try {
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    apiRequests.push({ method, path });

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(request) });
      return;
    }

    if (path === '/api/v1/fragrance-families' && method === 'GET') {
      await route.fulfill(jsonResponse(request, 200, families));
      return;
    }

    if (path === '/api/v1/fragrance-notes' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLocaleLowerCase('fa');
      const familyId = url.searchParams.get('family_id');
      const filtered = notes.filter(note =>
        (!familyId || note.family_id === familyId) &&
        (!q || `${note.name} ${note.slug}`.toLocaleLowerCase('fa').includes(q)),
      );
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 100);
      await route.fulfill(jsonResponse(request, 200, filtered.slice(offset, offset + limit)));
      return;
    }

    if (path === '/api/v1/auth/challenges' && method === 'POST') {
      challengeRequests += 1;
      let mobile;
      try { mobile = request.postDataJSON().mobile; } catch { mobile = undefined; }
      const accepted = mobile === fixtureMobile;
      await route.fulfill(jsonResponse(request, accepted ? 202 : 422, accepted
        ? { message: 'If delivery is available, a code has been sent' }
        : { detail: 'Invalid mobile number' }));
      return;
    }

    if (path === '/api/v1/auth/verify' && method === 'POST') {
      verificationRequests += 1;
      let body;
      try { body = request.postDataJSON(); } catch { body = {}; }
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
      await route.fulfill(authenticatedRequest(request)
        ? jsonResponse(request, 200, { user_id: fixtureUserId, role: 'customer' })
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }

    if (path === '/api/v1/auth/csrf' && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      currentCsrf = randomBytes(32).toString('hex');
      csrfValues.push(currentCsrf);
      await route.fulfill(jsonResponse(request, 200, { csrf_token: currentCsrf }));
      return;
    }

    if (path === '/api/v1/users/me' && method === 'GET') {
      await route.fulfill(authenticatedRequest(request)
        ? jsonResponse(request, 200, fixtureUser)
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }

    if (path === '/api/v1/fragrance-concepts' && method === 'POST') {
      conceptCreates += 1;
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      if (request.headers()['x-csrf-token'] !== currentCsrf) {
        await route.fulfill(jsonResponse(request, 403, { detail: 'CSRF token required' }));
        return;
      }
      let body;
      try { body = request.postDataJSON(); } catch { body = null; }
      if (!isValidConceptPayload(body)) {
        await route.fulfill(jsonResponse(request, 422, { detail: 'Invalid concept payload' }));
        return;
      }
      if (savedConcept || conceptCreates !== 1) {
        await route.fulfill(jsonResponse(request, 409, { detail: 'Concept create already accepted' }));
        return;
      }
      savedConcept = {
        id: fixtureConceptId,
        name: body.name,
        notes: body.notes.map(selection => ({
          note_id: selection.note_id,
          layer: selection.layer,
          position: selection.position,
        })),
      };
      await route.fulfill(jsonResponse(request, 201, savedConcept));
      return;
    }

    if (path === '/api/v1/fragrance-concepts' && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      conceptReads += 1;
      await route.fulfill(jsonResponse(request, 200, savedConcept ? [savedConcept] : []));
      return;
    }

    const conceptPath = path.match(/^\/api\/v1\/fragrance-concepts\/([^/]+)$/);
    if (conceptPath && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      conceptReads += 1;
      const requestedId = decodeURIComponent(conceptPath[1]);
      await route.fulfill(savedConcept && requestedId === savedConcept.id
        ? jsonResponse(request, 200, savedConcept)
        : jsonResponse(request, 404, { detail: 'Concept not found' }));
      return;
    }

    unexpectedApiCalls.push({ method, path });
    await route.fulfill(jsonResponse(request, 500, { detail: 'Unexpected isolated Guided Save API call' }));
  });

  const initialSession = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/session' && response.status() === 401,
  );
  await page.goto(`${frontendOrigin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  await initialSession;

  const selectOption = async (role, name) => {
    const control = page.getByRole(role, { name });
    if (!(await control.isChecked())) await control.locator('xpath=..').click();
    assert.equal(await control.isChecked(), true, `Guided choice was not selected: ${name}`);
  };
  const continueStep = async (nextHeading, buttonName = 'ادامه') => {
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await page.getByRole('heading', { name: nextHeading }).waitFor();
  };

  await selectOption('radio', /آرام و آسوده/);
  await continueStep('جهان‌های رایحه');
  await page.getByRole('checkbox', { name: /گلی/ }).check({ force: true });
  await continueStep('دمای حسی');
  await selectOption('radio', /نرم و متعادل/);
  await continueStep('یک تصویر برای خیال');
  await selectOption('radio', /گوشه‌ای پر از گل/);
  await continueStep('نت‌هایی که به دلتان می‌نشینند');
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click();
  await continueStep('بازبینی و میزان کشف');
  await selectOption('radio', /کمی آشنا، کمی تازه/);

  await page.getByRole('button', { name: 'دیدن پیشنهاد من', exact: true }).click();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const visibleName = (await page.locator('.guided-result-name').textContent())?.trim() || '';
  const visibleSelections = await page.locator('.guided-result-layer li').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.closest('.guided-result-layer')?.getAttribute('data-layer') || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-note-id') || '', layer, position };
    });
  });
  assert.ok(visibleName, 'Guided result must display a concept name');
  assert.ok(visibleSelections.length > 0 && visibleSelections.length <= 6, 'Guided result must contain one to six notes');
  assert.ok(visibleSelections.every(item => notes.some(note => note.id === item.note_id)), 'Displayed recommendation must use fixture catalog UUIDs');
  assert.ok(visibleSelections.every(item => layerOrder.includes(item.layer)), 'Displayed recommendation must use valid layers');

  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
  await loginDialog.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Guided result should remain mounted behind login');
  assert.equal(conceptCreates, 0, 'Anonymous Save must not create a concept');

  await loginDialog.getByLabel('شماره موبایل').fill(fixtureMobile);
  const challengeResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'دریافت کد' }).click();
  const challengeResponse = await challengeResponsePromise;
  assert.equal(challengeResponse.status(), 202, 'Synthetic challenge should be accepted');
  const challengeBody = await challengeResponse.json();
  assert.equal(Object.hasOwn(challengeBody, 'code') || Object.hasOwn(challengeBody, 'otp'), false, 'Challenge response must not expose OTP');
  await loginDialog.getByLabel('کد شش رقمی').fill(fixtureOtp);
  const verifyResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyResponsePromise).status(), 200, 'Fixture OTP should verify');
  await loginDialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای ذخیرهٔ این پیشنهاد، دوباره دکمهٔ ذخیره را بزنید.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Successful login must preserve Guided result');
  assert.equal(conceptCreates, 0, 'Login must not automatically save the concept');
  const browserSessionCookie = (await context.cookies(`${apiOrigin}/api/v1/auth/session`))
    .find(cookie => cookie.name === 'aroman_session');
  const cookieContractMatches = Boolean(browserSessionCookie) && browserSessionCookie.httpOnly &&
    browserSessionCookie.sameSite === 'Lax' && browserSessionCookie.path === '/api/v1';
  assert.equal(cookieContractMatches, true, 'Browser must receive the verification cookie with its API path and security attributes');
  const csrfWasRotated = csrfValues.length >= 2 && csrfValues[0] !== csrfValues[1];
  assert.equal(csrfWasRotated, true, 'Authenticated refresh should rotate the verification CSRF token');

  const saveResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const saveResponse = await saveResponsePromise;
  assert.equal(saveResponse.status(), 201, 'Explicit Save retry should create a validated concept');
  const savedPayload = saveResponse.request().postDataJSON();
  const payloadMatchesGuided = conceptCreateIsValid(savedPayload, visibleName, visibleSelections);
  assert.equal(payloadMatchesGuided, true, 'Save payload must contain only the visible name and exact note selections');
  assert.equal(conceptCreates, 1, 'Exactly one concept create should be accepted');
  await page.getByText('مفهوم رایحهٔ شما ذخیره شد.').waitFor();
  const savedButton = page.getByRole('button', { name: 'ذخیره شد', exact: true });
  await savedButton.waitFor();
  assert.equal(await savedButton.isDisabled(), true, 'Saved result should prevent duplicate Save actions');
  assert.equal(conceptCreates, 1, 'Saved result must not create duplicates');

  const accountListPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' &&
    response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'دیدن مفاهیم ذخیره‌شده' }).click();
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
  const accountList = await accountListPromise;
  assert.equal(accountList.status(), 200, 'Account should list saved concepts');
  const listedConcepts = await accountList.json();
  const accountContainsSavedRecord = Array.isArray(listedConcepts) && listedConcepts.length === 1 &&
    sameConceptRecord(listedConcepts[0], savedConcept);
  assert.equal(accountContainsSavedRecord, true, 'Account should return the exact in-memory saved concept');
  await page.getByRole('heading', { name: visibleName, exact: true }).waitFor();
  await page.locator('article').getByText(`${visibleSelections.length} نت`, { exact: true }).waitFor();

  const conceptId = savedConcept?.id;
  assert.equal(typeof conceptId, 'string', 'Created concept must have an ID');
  const savedConceptResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${conceptId}` &&
    response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'باز کردن و ویرایش' }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?concept=${conceptId}`);
  const savedConceptResponse = await savedConceptResponsePromise;
  assert.equal(savedConceptResponse.status(), 200, 'Creative Studio should fetch the saved record by ID');
  const reopenedRecord = await savedConceptResponse.json();
  assert.equal(sameConceptRecord(reopenedRecord, savedConcept), true, 'Concept GET should return the same stored record');
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const compositionPanel = page.locator('#studio-panel-1');
  await compositionPanel.waitFor({ state: 'visible' });
  await page.getByLabel('نام مفهوم').waitFor();
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), visibleName, 'Creative Studio should restore the saved concept name');
  const reopenedSelections = await compositionPanel.locator('.composition-note').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.querySelector('select')?.value || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-selected-note-id') || '', layer, position };
    });
  });
  const reopenedMatchesSaved = JSON.stringify(normalizedSelections(reopenedSelections)) ===
    JSON.stringify(normalizedSelections(savedConcept.notes));
  assert.equal(reopenedMatchesSaved, true, 'Creative Studio should restore exact saved note IDs, layers, and within-layer order');
  assert.ok(apiRequests.some(call => call.path === `/api/v1/fragrance-concepts/${conceptId}` && call.method === 'GET'), 'Saved record should be fetched by ID');
  assert.equal(apiRequests.some(call => call.method === 'PUT' || call.method === 'DELETE' || call.path.endsWith('/duplicate')), false, 'Reopening must not edit, delete, or duplicate the concept');
  assert.equal(conceptCreates, 1, 'Reopening must not create another concept');
  assert.equal(challengeRequests, 1, 'The journey should issue one challenge request');
  assert.equal(verificationRequests, 1, 'The journey should issue one OTP verification request');
  assert.equal(unexpectedApiCalls.length, 0, 'Every API request must match the isolated fixture contract');
  assertNoBrowserErrors(browserReport, 'Guided Save/account/reopen browser journey');

  console.log(
    `Guided Save/account/reopen PASS (${syntheticFixtureLabel}) — challenge: ${challengeRequests}, verify: ${verificationRequests}, concept create: ${conceptCreates}, concept reads: ${conceptReads}, unexpected API calls: ${unexpectedApiCalls.length}.`,
  );
} finally {
  await browser.close();
}
