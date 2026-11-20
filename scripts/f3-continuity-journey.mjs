// Source-only F3-C candidate. Execution is owner-gated by real-stack-runner.mjs;
// this file cannot provision Docker resources or send real SMS.
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { openBrowser, watchPage, assertNoBrowserErrors, checkLayout, isExpectedAbortedSessionGet } from './browser-utils.mjs';

const frontendOrigin = process.env.FRONTEND_ORIGIN;
const apiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL;
const otpSocket = process.env.AROMAN_TEST_OTP_SOCKET;
assert.ok(frontendOrigin && apiBase && otpSocket && process.env.AROMAN_TEST_DB_MODE === 'postgres');

function privateOtp(mobile) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(otpSocket);
    let response = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Private FakeSMS IPC timed out')));
    socket.on('connect', () => socket.write(`${mobile}\n`));
    socket.on('data', chunk => {
      response += chunk.toString();
      if (response.includes('\n')) socket.end();
    });
    socket.on('end', () => {
      try {
        const code = JSON.parse(response).code;
        assert.match(code, /^\d{6}$/);
        resolve(code);
      } catch (error) { reject(error); }
    });
    socket.on('error', reject);
  });
}

function canonicalNotes(notes) {
  return [...notes].map(({ note_id, layer, position }) => ({ note_id, layer, position }))
    .sort((a, b) => a.layer.localeCompare(b.layer) || a.position - b.position || a.note_id.localeCompare(b.note_id));
}

async function authenticatedPost(context, path, body) {
  const csrf = await context.request.get(`${apiBase}/auth/csrf`);
  assert.equal(csrf.status(), 200);
  const csrfToken = (await csrf.json()).csrf_token;
  assert.ok(csrfToken);
  return context.request.post(`${apiBase}${path}`, {
    headers: { Origin: frontendOrigin, 'X-CSRF-Token': csrfToken },
    data: body,
  });
}

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const report = watchPage(page, (status, url) => {
  const path = new URL(url).pathname;
  return (status === 401 && ['/api/v1/auth/session', '/api/v1/users/me'].includes(path)) ||
    (status === 403 && path === '/api/v1/auth/session');
}, (request, reason) => isExpectedAbortedSessionGet(request, reason, apiBase));
const uiWrites = [];
page.on('request', request => {
  if (new URL(request.url()).pathname.startsWith('/api/v1/fragrance-concepts') &&
      ['POST', 'PUT', 'DELETE'].includes(request.method())) {
    uiWrites.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
  }
});

try {
  await page.goto(`${frontendOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('شماره موبایل').fill('09121234567');
  const challengePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  assert.equal((await challengePromise).status(), 202);
  await page.getByLabel('کد شش رقمی').fill(await privateOtp('+989121234567'));
  const verifyPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyPromise).status(), 200);
  await page.waitForURL(`${frontendOrigin}/account`);

  const catalog = await context.request.get(`${apiBase}/fragrance-notes?limit=100&offset=0`);
  assert.equal(catalog.status(), 200);
  const availableNotes = await catalog.json();
  assert.ok(Array.isArray(availableNotes) && availableNotes.length >= 4, 'Synthetic seeded catalog must contain four notes');
  const [top, heartFirst, heartSecond, base] = availableNotes;
  assert.equal(new Set([top.id, heartFirst.id, heartSecond.id, base.id]).size, 4);

  const name = 'F3 منبع محفوظ چهار نتی';
  const sourcePayload = { name, notes: [
    { note_id: top.id, layer: 'top', position: 0 },
    { note_id: heartFirst.id, layer: 'heart', position: 0 },
    { note_id: heartSecond.id, layer: 'heart', position: 1 },
    { note_id: base.id, layer: 'base', position: 0 },
  ] };
  const sourceCreated = await authenticatedPost(context, '/fragrance-concepts', sourcePayload);
  assert.equal(sourceCreated.status(), 201);
  const sourceId = (await sourceCreated.json()).id;
  assert.ok(sourceId);
  const sourceBeforeResponse = await context.request.get(`${apiBase}/fragrance-concepts/${sourceId}`);
  assert.equal(sourceBeforeResponse.status(), 200);
  const sourceBefore = await sourceBeforeResponse.json();
  assert.equal(sourceBefore.name, name);
  assert.deepEqual(canonicalNotes(sourceBefore.notes), canonicalNotes(sourcePayload.notes));

  await page.goto(`${frontendOrigin}/studio/creative?concept=${sourceId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const compositionTab = page.getByRole('tablist', { name: 'گام‌های استودیو' })
    .getByRole('tab', { name: /ترکیب/ });
  await compositionTab.click();
  await page.locator('#studio-panel-1[data-active="true"]').waitFor({ state: 'visible' });
  const nameField = page.getByRole('textbox', { name: 'نام مفهوم' });
  await page.waitForFunction(
    expected => document.querySelector('#studio-panel-1 input[aria-label="نام مفهوم"]')?.value === expected,
    name,
  );
  assert.equal(await nameField.inputValue(), name);
  await checkLayout(page, 'F3 source at 390px');
  const advisor = page.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
  const summary = advisor.locator('summary');
  if (!(await summary.evaluate(element => element.parentElement.open))) await summary.click();
  await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
  await advisor.getByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 }).waitFor();
  assert.deepEqual(uiWrites, [], 'Preview must never persist a change');

  await advisor.getByRole('button', { name: 'ترکیب فعلی را نگه می‌دارم' }).click();
  assert.deepEqual(uiWrites, [], 'Reject must never persist a change');
  await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
  await advisor.getByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 }).waitFor();
  await advisor.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).click();
  const confirm = page.getByRole('dialog', { name: 'ساخت نسخهٔ مستقل' });
  await confirm.waitFor();
  assert.deepEqual(uiWrites, [], 'Opening confirmation cannot persist a fork');
  await confirm.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?from=advisor`);
  await page.getByText(/نسخهٔ مستقل برای ویرایش آماده است/).waitFor();
  await page.getByRole('tablist', { name: 'گام‌های استودیو' }).getByRole('tab', { name: /ترکیب/ }).click();
  await page.locator('#studio-panel-1[data-active="true"]').waitFor({ state: 'visible' });
  const forkName = page.getByRole('textbox', { name: 'نام مفهوم' });
  assert.equal(await forkName.inputValue(), name);
  assert.deepEqual(uiWrites, [], 'Fork transfer must remain in memory until explicit Save');
  const proposedPayload = { name, notes: [
    { note_id: top.id, layer: 'top', position: 0 },
    { note_id: heartSecond.id, layer: 'heart', position: 0 },
    { note_id: heartFirst.id, layer: 'heart', position: 1 },
    { note_id: base.id, layer: 'base', position: 0 },
  ] };
  const forkResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST');
  await page.locator('button.studio-save-top').click();
  const forkResponse = await forkResponsePromise;
  assert.equal(forkResponse.status(), 201);
  const forkId = (await forkResponse.json()).id;
  assert.ok(forkId && forkId !== sourceId);
  assert.deepEqual(forkResponse.request().postDataJSON(), proposedPayload);
  assert.deepEqual(uiWrites.map(write => write.method), ['POST'], 'Fork creates exactly one new concept; no source PUT');
  const sourceAfterResponse = await context.request.get(`${apiBase}/fragrance-concepts/${sourceId}`);
  const forkSavedResponse = await context.request.get(`${apiBase}/fragrance-concepts/${forkId}`);
  assert.equal(sourceAfterResponse.status(), 200);
  assert.equal(forkSavedResponse.status(), 200);
  const sourceAfter = await sourceAfterResponse.json();
  const forkSaved = await forkSavedResponse.json();
  assert.equal(sourceAfter.name, sourceBefore.name);
  assert.deepEqual(canonicalNotes(sourceAfter.notes), canonicalNotes(sourceBefore.notes), 'Original source is unchanged in real PostgreSQL');
  assert.equal(forkSaved.name, name);
  assert.deepEqual(canonicalNotes(forkSaved.notes), canonicalNotes(proposedPayload.notes));

  await page.goto(`${frontendOrigin}/studio/creative?concept=${sourceId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  await page.getByRole('tablist', { name: 'گام‌های استودیو' }).getByRole('tab', { name: /ترکیب/ }).click();
  await page.waitForFunction(
    expected => document.querySelector('#studio-panel-1 input[aria-label="نام مفهوم"]')?.value === expected,
    name,
  );
  assert.equal(await page.getByRole('textbox', { name: 'نام مفهوم' }).inputValue(), name);
  await page.setViewportSize({ width: 1440, height: 900 });
  await checkLayout(page, 'F3 original source at 1440px');
  assert.deepEqual(uiWrites.map(write => write.method), ['POST'], 'Reopening source causes no writes');
  assertNoBrowserErrors(report, 'F3 saved-source fork browser journey');
  console.log('F3 candidate PASS: source preview/reject, detached advisor fork, explicit single POST, original saved source unchanged');
} finally {
  await browser.close();
}
