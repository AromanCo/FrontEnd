// F1-A3 source-only browser acceptance candidate. Execution against a disposable
// PostgreSQL/FakeSMS stack is separately owner-gated in real-stack-runner.mjs.
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { openBrowser, watchPage, assertNoBrowserErrors, checkLayout } from './browser-utils.mjs';

const frontendOrigin = process.env.FRONTEND_ORIGIN;
const apiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL;
const privateSocket = process.env.AROMAN_TEST_OTP_SOCKET;
assert.ok(frontendOrigin && apiBase && privateSocket && process.env.AROMAN_TEST_DB_MODE === 'postgres');

const accounts = [
  { mobile: '09121234567', e164: '+989121234567' },
  { mobile: '09121234568', e164: '+989121234568' },
];
const name = 'مفهوم تست مالکیت حساب الف';

function privateOtp(mobile) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(privateSocket);
    let body = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Private FakeSMS IPC timed out')));
    socket.on('connect', () => socket.write(`${mobile}\n`));
    socket.on('data', chunk => {
      body += chunk.toString();
      if (body.includes('\n')) socket.end();
    });
    socket.on('end', () => {
      try {
        const code = JSON.parse(body).code;
        assert.match(code, /^\d{6}$/);
        resolve(code);
      } catch (error) { reject(error); }
    });
    socket.on('error', reject);
  });
}

async function login(page, account) {
  await page.goto(`${frontendOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('شماره موبایل').fill(account.mobile);
  const challengePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  const challenge = await challengePromise;
  assert.equal(challenge.status(), 202, 'FakeSMS challenge must be accepted without public OTP disclosure');
  const payload = await challenge.json();
  assert.equal(Object.hasOwn(payload, 'code'), false);
  assert.equal(Object.hasOwn(payload, 'otp'), false);
  await page.getByLabel('کد شش رقمی').fill(await privateOtp(account.e164));
  const verifyPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyPromise).status(), 200);
  await page.waitForURL(`${frontendOrigin}/account`);
}

async function csrf(context) {
  const response = await context.request.get(`${apiBase}/auth/csrf`);
  assert.equal(response.status(), 200);
  const token = (await response.json()).csrf_token;
  assert.ok(typeof token === 'string' && token.length > 0);
  return token;
}

async function privateMutation(context, method, path, token, data) {
  return context.request.fetch(`${apiBase}${path}`, {
    method,
    headers: { Origin: frontendOrigin, 'X-CSRF-Token': token },
    ...(data === undefined ? {} : { data }),
  });
}

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const report = watchPage(page, (status, url) => {
  const path = new URL(url).pathname;
  return (status === 401 && ['/api/v1/auth/session', '/api/v1/users/me'].includes(path)) ||
    (status === 403 && path === '/api/v1/auth/session'); // Stale UI CSRF is retried once by the client.
});

try {
  assert.equal((await context.request.get(`${apiBase}/fragrance-concepts`)).status(), 401);
  await login(page, accounts[0]);
  await checkLayout(page, 'F1-A account A mobile');
  const a = await (await context.request.get(`${apiBase}/users/me`)).json();
  assert.equal(a.mobile_e164, accounts[0].e164);
  const cookie = (await context.cookies(`${apiBase}/auth/session`)).find(item => item.name === 'aroman_session');
  assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/api/v1');

  const notesResponse = await context.request.get(`${apiBase}/fragrance-notes?limit=100&offset=0`);
  assert.equal(notesResponse.status(), 200);
  const notes = await notesResponse.json();
  assert.equal(notes.length, 24, 'F1 test must use the pinned fictional catalog');
  const selection = [{ note_id: notes[0].id, layer: 'top', position: 0 }];
  let aCsrf = await csrf(context);
  const create = await privateMutation(context, 'POST', '/fragrance-concepts', aCsrf, { name, notes: selection });
  assert.equal(create.status(), 201);
  const concept = await create.json();
  assert.equal(concept.name, name);
  assert.deepEqual(concept.notes.map(({ note_id, layer, position }) => ({ note_id, layer, position })), selection);
  const aList = await context.request.get(`${apiBase}/fragrance-concepts?limit=50&offset=0`);
  assert.equal(aList.status(), 200);
  assert.deepEqual((await aList.json()).map(item => item.id), [concept.id]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name, exact: true }).waitFor();
  // Account hydration rotates the server-side CSRF token; never reuse the
  // token that preceded the browser reload for subsequent writes.
  aCsrf = await csrf(context);

  const editedName = `${name} — ویرایش‌شده`;
  const updated = await privateMutation(context, 'PUT', `/fragrance-concepts/${concept.id}`, aCsrf, { name: editedName, notes: selection });
  assert.equal(updated.status(), 200);
  const duplicated = await privateMutation(context, 'POST', `/fragrance-concepts/${concept.id}/duplicate`, aCsrf);
  assert.equal(duplicated.status(), 201);
  const duplicate = await duplicated.json();
  assert.notEqual(duplicate.id, concept.id);
  assert.equal((await privateMutation(context, 'DELETE', `/fragrance-concepts/${duplicate.id}`, aCsrf)).status(), 204);

  await page.getByRole('button', { name: 'خروج' }).click();
  // The header and logged-out account both expose a "ورود" link.
  // Wait specifically for the account's login action after logout.
  await page.locator('#main').getByRole('link', { name: 'ورود', exact: true }).waitFor();
  assert.equal((await context.request.get(`${apiBase}/auth/session`)).status(), 401, 'Logout must revoke the server session');
  assert.equal((await context.cookies(`${apiBase}/auth/session`)).some(item => item.name === 'aroman_session'), false);

  // Use the same browser context to expose a possible previous-user UI leak.
  await login(page, accounts[1]);
  await checkLayout(page, 'F1-A account B mobile');
  const b = await (await context.request.get(`${apiBase}/users/me`)).json();
  assert.equal(b.mobile_e164, accounts[1].e164);
  assert.notEqual(b.id, a.id);
  await page.getByRole('heading', { name: 'اولین داستان رایحه‌تان را بسازید' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: editedName, exact: true }).count(), 0);
  const bList = await context.request.get(`${apiBase}/fragrance-concepts?limit=50&offset=0`);
  assert.equal(bList.status(), 200);
  assert.deepEqual(await bList.json(), [], 'Account B must not receive A concepts');

  const bCsrf = await csrf(context);
  for (const [method, path, data] of [
    ['GET', `/fragrance-concepts/${concept.id}`, undefined],
    ['PUT', `/fragrance-concepts/${concept.id}`, { name: 'unauthorized', notes: selection }],
    ['POST', `/fragrance-concepts/${concept.id}/duplicate`, undefined],
    ['DELETE', `/fragrance-concepts/${concept.id}`, undefined],
  ]) {
    const response = method === 'GET'
      ? await context.request.get(`${apiBase}${path}`)
      : await privateMutation(context, method, path, bCsrf, data);
    assert.ok([403, 404].includes(response.status()), `Account B ${method} must be denied without revealing A concept`);
    if (response.status() === 403) assert.notEqual((await response.json()).code, 'csrf_invalid');
  }
  assertNoBrowserErrors(report, 'F1-A two-account browser journey');
  console.log('F1-A PASS: private FakeSMS, A CRUD, server logout, B empty account and forbidden cross-account read/writes');
} finally {
  await browser.close();
}
