// One owner-gated internal MVP journey against the disposable real stack.
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import {
  apiBase, assertNoBrowserErrors, checkLayout, frontendOrigin, isExpectedAbortedSessionGet,
  openBrowser, watchPage,
} from './browser-utils.mjs';

const privateSocket = process.env.AROMAN_TEST_OTP_SOCKET;
assert.ok(privateSocket && process.env.AROMAN_TEST_DB_MODE === 'postgres');

const accountA = { mobile: '09121234567', e164: '+989121234567' };
const accountB = { mobile: '09121234568', e164: '+989121234568' };
const layers = ['top', 'heart', 'base'];
const canonical = notes => notes.map(({ note_id, layer, position }) => ({ note_id, layer, position }))
  .sort((left, right) => layers.indexOf(left.layer) - layers.indexOf(right.layer) || left.position - right.position);
const conceptPath = '/api/v1/fragrance-concepts';

function privateOtp(mobile) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(privateSocket);
    let body = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Private FakeSMS IPC timed out')));
    socket.on('connect', () => socket.write(mobile + '\n'));
    socket.on('data', chunk => {
      body += chunk;
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

function waitForApi(page, path, method) {
  return page.waitForResponse(response =>
    response.url() === new URL(path, apiBase).href && response.request().method() === method);
}

async function login(page, scope, account) {
  await scope.getByLabel('شماره موبایل').fill(account.mobile);
  const challengePromise = waitForApi(page, '/api/v1/auth/challenges', 'POST');
  await scope.getByRole('button', { name: 'دریافت کد' }).click();
  const challenge = await challengePromise;
  assert.equal(challenge.status(), 202);
  const body = await challenge.json();
  assert.ok(!Object.hasOwn(body, 'code') && !Object.hasOwn(body, 'otp'));
  await scope.getByLabel('کد شش رقمی').fill(await privateOtp(account.e164));
  const verified = waitForApi(page, '/api/v1/auth/verify', 'POST');
  await scope.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verified).status(), 200);
}

async function loginFromPage(page, account) {
  await page.goto(frontendOrigin + '/login');
  await login(page, page, account);
  await page.waitForURL(frontendOrigin + '/account');
}

async function logout(page, context) {
  await page.getByRole('button', { name: 'خروج', exact: true }).click();
  await page.locator('#main').getByRole('link', { name: 'ورود', exact: true }).waitFor();
  assert.equal((await context.request.get(apiBase + '/auth/session')).status(), 401);
}

async function composition(page) {
  return page.locator('#studio-panel-1').evaluate(panel => ({
    name: panel.querySelector('input[aria-label="نام مفهوم"]').value,
    notes: Array.from(panel.querySelectorAll('.composition-layer[data-layer]')).flatMap(section =>
      Array.from(section.querySelectorAll('.composition-note'), (row, position) => ({
        note_id: row.getAttribute('data-selected-note-id'),
        layer: section.getAttribute('data-layer'),
        position,
      }))),
  }));
}

async function showComposition(page) {
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  await page.getByRole('tablist', { name: 'گام‌های استودیو' }).getByRole('tab', { name: /ترکیب/ }).click();
  await page.locator('#studio-panel-1[data-active="true"]').waitFor({ state: 'visible' });
}

async function checkCatalog(page, context) {
  const response = await context.request.get(apiBase + '/products?limit=100&offset=0');
  assert.equal(response.status(), 200);
  const products = await response.json();
  assert.equal(products.length, 6);
  assert.ok(products.every(product => product.is_demo));
  const target = products.find(product => product.brand_id && product.family_id);
  assert.ok(target);
  await page.goto(frontendOrigin + '/shop');
  await page.getByRole('heading', { name: target.name, exact: true }).waitFor();
  await checkLayout(page, 'F5 catalog at 390px');

  await page.getByRole('search', { name: 'جستجو و فیلتر محصولات' }).getByRole('searchbox').fill(target.name);
  await page.getByLabel('برند', { exact: true }).selectOption(target.brand_id);
  await page.getByLabel('خانواده رایحه', { exact: true }).selectOption(target.family_id);
  await page.getByRole('button', { name: 'اعمال فیلتر' }).click();
  await page.waitForURL(url => url.pathname === '/shop' && url.searchParams.get('q') === target.name &&
    url.searchParams.get('brand_id') === target.brand_id && url.searchParams.get('family_id') === target.family_id);
  await page.getByRole('button', { name: 'پاک کردن همه فیلترها' }).waitFor();
  const cards = page.locator('.product-editorial-card');
  const targetCard = cards.filter({ has: page.getByRole('heading', { name: target.name, exact: true }) });
  await targetCard.waitFor();
  assert.deepEqual(await cards.locator('h3').allTextContents(), [target.name]);
  await targetCard.getByRole('link', { name: /مشاهده جزئیات/ }).click();
  await page.waitForURL(frontendOrigin + '/shop/' + target.id);
  await page.getByRole('heading', { name: target.name, exact: true }).waitFor();
  await page.getByRole('heading', { name: 'گونه‌ها', exact: true }).waitFor();
  await page.getByRole('listitem').filter({ hasText: 'نمونه مفهومی · نمایشی' }).waitFor();

  const repeated = new URLSearchParams([
    ['q', target.name], ['q', 'aroman-f5-missing'], ['brand_id', target.brand_id],
    ['brand_id', 'invalid'], ['family_id', target.family_id], ['family_id', 'invalid'],
    ['offset', '0'], ['offset', '12'],
  ]);
  await page.goto(frontendOrigin + '/shop?' + repeated);
  await targetCard.waitFor();
  assert.deepEqual(await cards.locator('h3').allTextContents(), [target.name]);

  const empty = page.getByRole('heading', { name: 'برای این جستجو محصولی پیدا نشد.' });
  await page.goto(frontendOrigin + '/shop?q=aroman-f5-missing');
  await empty.waitFor();
  await page.getByRole('link', { name: 'نمایش همه محصولات' }).click();
  await page.waitForURL(frontendOrigin + '/shop');
  await targetCard.waitFor();

  // A malformed UUID deterministically exercises the real API's validation error.
  const failed = await context.request.get(apiBase + '/products?family_id=invalid');
  assert.equal(failed.status(), 422);
  await page.goto(frontendOrigin + '/shop?family_id=invalid');
  await page.getByRole('alert').filter({ hasText: 'اتصال به کاتالوگ برقرار نشد.' }).waitFor();
  assert.equal(await empty.count(), 0);
  await page.getByRole('button', { name: 'پاک کردن همه فیلترها' }).click();
  await page.waitForURL(frontendOrigin + '/shop');
  await targetCard.waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await checkLayout(page, 'F5 catalog at 1440px');
  await page.setViewportSize({ width: 390, height: 844 });
  console.log('F5 catalog PASS: six demo products, combined and repeated filters, detail, empty and error recovery');
}

async function guidedDraft(page) {
  await page.goto(frontendOrigin + '/studio/guided');
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  const choose = async (role, name) => {
    const input = page.getByRole(role, { name });
    if (!(await input.isChecked())) await input.locator('xpath=..').click();
    assert.equal(await input.isChecked(), true);
  };
  const next = async heading => {
    await page.getByRole('button', { name: 'ادامه', exact: true }).click();
    await page.getByRole('heading', { name: heading }).waitFor();
  };
  await choose('radio', /آرام و آسوده/);
  await next('جهان‌های رایحه');
  await choose('checkbox', /گلی/);
  await next('دمای حسی');
  await choose('radio', /نرم و متعادل/);
  await next('یک تصویر برای خیال');
  await choose('radio', /گوشه‌ای پر از گل/);
  await next('نت‌هایی که به دلتان می‌نشینند');
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click();
  await next('بازبینی و میزان کشف');
  await choose('radio', /کمی آشنا، کمی تازه/);
  await page.getByRole('button', { name: 'دیدن پیشنهاد من', exact: true }).click();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const name = (await page.locator('.guided-result-name').textContent()).trim();
  const notes = await page.locator('.guided-result-layer li').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.closest('.guided-result-layer').getAttribute('data-layer');
      const position = positions.get(layer) ?? 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-note-id'), layer, position };
    });
  });
  assert.ok(name && notes.length > 0);
  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق', exact: true }).click();
  await page.waitForURL(frontendOrigin + '/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  await showComposition(page);
  const imported = await composition(page);
  assert.equal(imported.name, name);
  assert.deepEqual(canonical(imported.notes), canonical(notes));
  return imported;
}

async function advise(page, imported) {
  // Three singleton layers offer no editorial move. Make one explicit edit
  // after verifying the Guided handoff so the preview still uses that draft.
  if (imported.notes.length === 3 && new Set(imported.notes.map(note => note.layer)).size === 3) {
    await page.locator('#studio-panel-1 .composition-note[data-selected-note-id="' +
      imported.notes.find(note => note.layer === 'top').note_id + '"] select').selectOption('heart');
  }
  const original = await composition(page);
  const advisor = page.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
  const summary = advisor.locator('summary');
  if (!(await summary.evaluate(element => element.parentElement.open))) await summary.click();
  const preview = async () => {
    await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
    await advisor.getByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 }).waitFor();
    assert.deepEqual(await composition(page), original);
  };
  await preview();
  await advisor.getByRole('button', { name: 'ترکیب فعلی را نگه می‌دارم' }).click();
  assert.deepEqual(await composition(page), original);
  await preview();
  await advisor.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی', exact: true }).click();
  await advisor.getByText(/چیدمان پیشنهادی در ترکیب مفهومی اعمال شد/).waitFor();
  const applied = await composition(page);
  assert.equal(applied.name, original.name);
  assert.notDeepEqual(applied.notes, original.notes);
  assert.deepEqual(applied.notes.map(note => note.note_id).sort(), original.notes.map(note => note.note_id).sort());
  await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی', exact: true }).click();
  assert.deepEqual(await composition(page), original);
  assert.equal(await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی', exact: true }).count(), 0);
  return original;
}

const browser = await openBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const report = watchPage(page, (status, url) =>
    (status === 401 && [apiBase + '/auth/session', apiBase + '/users/me'].includes(url)) ||
    (status === 403 && url === apiBase + '/auth/session'),
  (request, reason) => isExpectedAbortedSessionGet(request, reason, apiBase));
  const writes = [];
  page.on('request', request => {
    const { pathname, origin } = new URL(request.url());
    if (origin === new URL(apiBase).origin && (pathname === conceptPath || pathname.startsWith(conceptPath + '/')) &&
        ['POST', 'PUT', 'DELETE'].includes(request.method())) {
      writes.push([request.method(), pathname]);
    }
  });

  assert.equal((await context.request.get(apiBase + '/fragrance-concepts')).status(), 401);
  await checkCatalog(page, context);
  const imported = await guidedDraft(page);
  await checkLayout(page, 'F5 Creative at 390px');
  const draft = await advise(page, imported);
  assert.deepEqual(writes, [], 'Guided transfer and Advisor must not persist a draft');
  console.log('F5 Creative PASS: exact Guided handoff, read-only preview, Reject, Apply and Undo');

  const save = page.locator('button.studio-save-top');
  await save.click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیره' });
  await loginDialog.waitFor();
  assert.deepEqual(writes, [], 'Opening login must not save');
  const challengeStarted = Date.now();
  await login(page, loginDialog, accountA);
  await loginDialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.', { exact: true }).waitFor();
  assert.deepEqual(await composition(page), draft);
  assert.deepEqual(writes, [], 'Login must not save');

  const savedPromise = waitForApi(page, conceptPath, 'POST');
  await save.click();
  const saved = await savedPromise;
  assert.equal(saved.status(), 201);
  const body = saved.request().postDataJSON();
  assert.equal(body.name, draft.name);
  assert.deepEqual(canonical(body.notes), canonical(draft.notes));
  const { id } = await saved.json();
  assert.ok(id);
  await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.', { exact: true }).waitFor();
  assert.deepEqual(writes, [['POST', conceptPath]], 'Explicit Save creates exactly one concept');

  await page.goto(frontendOrigin + '/account');
  await page.getByRole('heading', { name: draft.name, exact: true }).waitFor();
  await logout(page, context);
  // The pinned backend enforces a 60-second cooldown per mobile.
  const waitMs = 65_000 - (Date.now() - challengeStarted);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  await loginFromPage(page, accountA);
  const savedPath = '/studio/creative?concept=' + encodeURIComponent(id);
  await page.locator('a[href="' + savedPath + '"]').click();
  await page.waitForURL(frontendOrigin + savedPath);
  await showComposition(page);
  await page.waitForFunction(expected => document.querySelector('#studio-panel-1 input[aria-label="نام مفهوم"]')?.value === expected, draft.name);
  const reopened = await composition(page);
  assert.equal(reopened.name, draft.name);
  assert.deepEqual(canonical(reopened.notes), canonical(draft.notes));
  const stored = await context.request.get(apiBase + '/fragrance-concepts/' + id);
  assert.equal(stored.status(), 200);
  const persisted = await stored.json();
  assert.equal(persisted.name, draft.name);
  assert.deepEqual(canonical(persisted.notes), canonical(draft.notes));
  await page.setViewportSize({ width: 1440, height: 900 });
  await checkLayout(page, 'F5 reopened Creative at 1440px');

  await page.goto(frontendOrigin + '/account');
  await logout(page, context);
  await loginFromPage(page, accountB);
  await page.getByRole('heading', { name: 'اولین داستان رایحه‌تان را بسازید' }).waitFor();
  assert.equal(await page.locator('a[href="' + savedPath + '"]').count(), 0);
  const collection = await context.request.get(apiBase + '/fragrance-concepts');
  assert.equal(collection.status(), 200);
  assert.deepEqual(await collection.json(), []);
  const denied = await context.request.get(apiBase + '/fragrance-concepts/' + id);
  assert.ok([403, 404].includes(denied.status()), 'Account B must not read Account A’s concept');
  assert.deepEqual(writes, [['POST', conceptPath]], 'Relogin and reopen must never write');
  assertNoBrowserErrors(report, 'F5 unified MVP browser journey');
  console.log('F5 candidate PASS: catalog → Guided → Creative and Advisor → private FakeSMS → explicit Save → relogin and reopen → second-account isolation');
} finally {
  await browser.close();
}
