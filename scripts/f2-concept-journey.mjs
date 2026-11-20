// Owner-gated F2 browser candidate: real Next.js + FastAPI + disposable PG17.
// This file never provisions resources; real-stack-runner.mjs owns the guard.
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

async function verifyLogin(page, scope, account) {
  await scope.getByLabel('شماره موبایل').fill(account.mobile);
  const challengePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST');
  await scope.getByRole('button', { name: 'دریافت کد' }).click();
  const challenge = await challengePromise;
  assert.equal(challenge.status(), 202);
  const challengeBody = await challenge.json();
  assert.equal(Object.hasOwn(challengeBody, 'code') || Object.hasOwn(challengeBody, 'otp'), false);
  await scope.getByLabel('کد شش رقمی').fill(await privateOtp(account.e164));
  const verifyPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST');
  await scope.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyPromise).status(), 200);
}

async function loginFromPage(page, account) {
  await page.goto(`${frontendOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await verifyLogin(page, page, account);
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
}

async function logout(page, context) {
  await page.getByRole('button', { name: 'خروج', exact: true }).click();
  // Both the header and the account page include a login link after logout.
  await page.locator('#main').getByRole('link', { name: 'ورود', exact: true }).waitFor();
  assert.equal((await context.request.get(`${apiBase}/auth/session`)).status(), 401);
  assert.equal((await context.cookies(`${apiBase}/auth/session`)).some(cookie => cookie.name === 'aroman_session'), false);
}

function sortedNotes(notes) {
  return [...notes].map(({ note_id, layer, position }) => ({ note_id, layer, position }))
    .sort((a, b) => a.layer.localeCompare(b.layer) || a.position - b.position || a.note_id.localeCompare(b.note_id));
}

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const report = watchPage(page, (status, url) => {
  const path = new URL(url).pathname;
  return (status === 401 && ['/api/v1/auth/session', '/api/v1/users/me'].includes(path)) ||
    (status === 403 && path === '/api/v1/auth/session');
});
const conceptCreates = [];
page.on('request', request => {
  if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/fragrance-concepts') {
    conceptCreates.push(request);
  }
});

try {
  assert.equal((await context.request.get(`${apiBase}/fragrance-concepts`)).status(), 401);
  await page.goto(`${frontendOrigin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();

  const selectOption = async (role, name) => {
    const control = page.getByRole(role, { name });
    if (!(await control.isChecked())) await control.locator('xpath=..').click();
    assert.equal(await control.isChecked(), true);
  };
  const continueStep = async (nextHeading, buttonName = 'ادامه') => {
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await page.getByRole('heading', { name: nextHeading }).waitFor();
  };

  await selectOption('radio', /آرام و آسوده/);
  await continueStep('جهان‌های رایحه');
  // The checkbox input is visually clipped; interact with its visible label
  // card, as we do for the other Guided choices, and assert React state.
  await selectOption('checkbox', /گلی/);
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

  const guidedName = (await page.locator('.guided-result-name').textContent())?.trim();
  assert.ok(guidedName);
  const guidedNotes = await page.locator('.guided-result-layer li').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.closest('.guided-result-layer')?.getAttribute('data-layer') || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-note-id') || '', layer, position };
    });
  });
  assert.ok(guidedNotes.length >= 1 && guidedNotes.length <= 6);
  assert.ok(guidedNotes.every(note => note.note_id && ['top', 'heart', 'base'].includes(note.layer)));

  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
  await loginDialog.waitFor();
  assert.equal(conceptCreates.length, 0, 'Guest Save must not send a create');
  const firstChallengeStartedAt = Date.now();
  await verifyLogin(page, loginDialog, accounts[0]);
  await loginDialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای ذخیرهٔ این پیشنهاد، دوباره دکمهٔ ذخیره را بزنید.', { exact: true }).waitFor();
  assert.equal(conceptCreates.length, 0, 'Login must not silently save');
  assert.equal((await page.locator('.guided-result-name').textContent())?.trim(), guidedName);

  const cookie = (await context.cookies(`${apiBase}/auth/session`)).find(item => item.name === 'aroman_session');
  assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/api/v1');
  const aIdentityResponse = await context.request.get(`${apiBase}/users/me`);
  assert.equal(aIdentityResponse.status(), 200);
  const aIdentity = await aIdentityResponse.json();
  assert.equal(aIdentity.mobile_e164, accounts[0].e164);
  const createPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const createdResponse = await createPromise;
  assert.equal(createdResponse.status(), 201);
  assert.equal(conceptCreates.length, 1);
  const posted = createdResponse.request().postDataJSON();
  assert.equal(posted.name, guidedName);
  assert.deepEqual(sortedNotes(posted.notes), sortedNotes(guidedNotes));
  const created = await createdResponse.json();
  assert.ok(created.id);
  await page.getByRole('button', { name: 'ذخیره شد', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'ذخیره شد', exact: true }).isDisabled(), true);

  await page.getByRole('link', { name: 'دیدن مفاهیم ذخیره‌شده' }).click();
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: guidedName, exact: true }).waitFor();
  await checkLayout(page, 'F2 account A after Guided Save');
  const firstList = await context.request.get(`${apiBase}/fragrance-concepts?limit=50&offset=0`);
  assert.equal(firstList.status(), 200);
  assert.deepEqual((await firstList.json()).map(item => item.id), [created.id]);

  await logout(page, context);
  // Backend enforces a 60-second per-mobile challenge cooldown, even when the
  // previous OTP was consumed. Relogin must respect that real safety policy.
  const remainingCooldown = 65_000 - (Date.now() - firstChallengeStartedAt);
  if (remainingCooldown > 0) await new Promise(resolve => setTimeout(resolve, remainingCooldown));
  await loginFromPage(page, accounts[0]);
  await page.getByRole('heading', { name: guidedName, exact: true }).waitFor();
  const persisted = await context.request.get(`${apiBase}/fragrance-concepts/${created.id}`);
  assert.equal(persisted.status(), 200);
  assert.deepEqual(sortedNotes((await persisted.json()).notes), sortedNotes(guidedNotes));
  assert.equal(conceptCreates.length, 1, 'Relogin must not create a second concept');

  const openLink = page.locator(`a[href="/studio/creative?concept=${encodeURIComponent(created.id)}"]`);
  await openLink.click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?concept=${created.id}`);
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  // The 390px Studio layout shows one tab at a time. The name field exists in
  // the Composition panel but is hidden while the default Notes tab is active.
  const compositionTab = page.getByRole('tablist', { name: 'گام‌های استودیو' })
    .getByRole('tab', { name: /ترکیب/ });
  await compositionTab.click();
  assert.equal(await compositionTab.getAttribute('aria-selected'), 'true');
  const compositionPanel = page.locator('#studio-panel-1[data-active="true"]');
  await compositionPanel.waitFor({ state: 'visible' });
  const nameField = compositionPanel.getByRole('textbox', { name: 'نام مفهوم', exact: true });
  await nameField.waitFor();
  await page.waitForFunction(
    expected => document.querySelector('#studio-panel-1 input[aria-label="نام مفهوم"]')?.value === expected,
    guidedName,
  );
  assert.equal(await nameField.inputValue(), guidedName);
  const editedName = `${guidedName.slice(0, 35)} — بازبینی‌شده`;
  await nameField.fill(editedName);
  const updatePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${created.id}` && response.request().method() === 'PUT');
  await page.locator('.studio-save-top').click();
  assert.equal((await updatePromise).status(), 200);
  assert.equal(conceptCreates.length, 1, 'Reopen/edit must update the concept, not create another');
  const updatedResponse = await context.request.get(`${apiBase}/fragrance-concepts/${created.id}`);
  assert.equal(updatedResponse.status(), 200);
  assert.equal((await updatedResponse.json()).name, editedName);

  await page.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: editedName, exact: true }).waitFor();
  const article = page.locator('article').filter({ has: page.locator(`a[href="/studio/creative?concept=${encodeURIComponent(created.id)}"]`) });
  const duplicatePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${created.id}/duplicate` && response.request().method() === 'POST');
  await article.getByRole('button', { name: 'کپی' }).click();
  const duplicatedResponse = await duplicatePromise;
  assert.equal(duplicatedResponse.status(), 201);
  const duplicated = await duplicatedResponse.json();
  assert.notEqual(duplicated.id, created.id);
  const duplicateArticle = page.locator('article').filter({ has: page.locator(`a[href="/studio/creative?concept=${encodeURIComponent(duplicated.id)}"]`) });
  await duplicateArticle.waitFor();
  page.once('dialog', dialog => { void dialog.accept(); });
  const deletePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${duplicated.id}` && response.request().method() === 'DELETE');
  await duplicateArticle.getByRole('button', { name: 'حذف' }).click();
  assert.equal((await deletePromise).status(), 204);
  await duplicateArticle.waitFor({ state: 'detached' });
  const aAfterDelete = await context.request.get(`${apiBase}/fragrance-concepts?limit=50&offset=0`);
  assert.deepEqual((await aAfterDelete.json()).map(item => item.id), [created.id]);

  await logout(page, context);
  await loginFromPage(page, accounts[1]);
  await checkLayout(page, 'F2 account B empty collection');
  const bIdentityResponse = await context.request.get(`${apiBase}/users/me`);
  assert.equal(bIdentityResponse.status(), 200);
  const bIdentity = await bIdentityResponse.json();
  assert.equal(bIdentity.mobile_e164, accounts[1].e164);
  assert.notEqual(bIdentity.id, aIdentity.id);
  await page.getByRole('heading', { name: 'اولین داستان رایحه‌تان را بسازید' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: editedName, exact: true }).count(), 0);
  const bList = await context.request.get(`${apiBase}/fragrance-concepts?limit=50&offset=0`);
  assert.equal(bList.status(), 200);
  assert.deepEqual(await bList.json(), []);
  for (const [method, path] of [
    ['GET', `/fragrance-concepts/${created.id}`],
    ['PUT', `/fragrance-concepts/${created.id}`],
    ['POST', `/fragrance-concepts/${created.id}/duplicate`],
    ['DELETE', `/fragrance-concepts/${created.id}`],
  ]) {
    const options = method === 'PUT' ? { data: { name: 'unauthorized', notes: guidedNotes } } : {};
    // A missing CSRF may be denied first; use a fresh valid CSRF to test ownership.
    const csrfResponse = await context.request.get(`${apiBase}/auth/csrf`);
    assert.equal(csrfResponse.status(), 200);
    const token = (await csrfResponse.json()).csrf_token;
    const response = await context.request.fetch(`${apiBase}${path}`, {
      method, headers: { Origin: frontendOrigin, 'X-CSRF-Token': token }, ...options,
    });
    assert.ok([403, 404].includes(response.status()), `B ${method} must not access A's concept`);
    if (response.status() === 403) assert.notEqual((await response.json()).code, 'csrf_invalid');
  }
  assertNoBrowserErrors(report, 'F2 saved-concept browser journey');
  console.log('F2 candidate PASS: Guided guest/login/explicit Save, relogin persistence, Creative edit, dashboard duplicate/delete, B isolation');
} finally {
  await browser.close();
}
