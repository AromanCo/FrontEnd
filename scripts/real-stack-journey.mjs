import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { openBrowser, watchPage, assertNoBrowserErrors } from './browser-utils.mjs';

const frontendOrigin = process.env.FRONTEND_ORIGIN;
const apiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL;
const mobile = '09121234567';
const mobileE164 = '+989121234567';
const layers = ['top', 'heart', 'base'];
const normalized = items => [...items].sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer) || a.position - b.position);
const pathOf = response => new URL(response.url()).pathname;
const responseFor = (page, path, method = 'GET') => page.waitForResponse(response =>
  pathOf(response) === path && response.request().method() === method);

function privateOtp() {
  return new Promise((resolveOtp, reject) => {
    const client = createConnection(process.env.AROMAN_TEST_OTP_SOCKET);
    let data = '';
    client.setTimeout(5000, () => client.destroy(new Error('Private OTP IPC timed out')));
    client.on('connect', () => client.write(`${mobileE164}\n`));
    client.on('data', chunk => { data += chunk; if (data.includes('\n')) client.end(); });
    client.on('end', () => {
      try {
        const code = JSON.parse(data).code;
        assert.match(code, /^\d{6}$/, 'FakeSMS did not hold the requested OTP');
        resolveOtp(code);
      } catch (error) { reject(error); }
    });
    client.on('error', reject);
  });
}

async function composition(page) {
  return page.locator('#studio-panel-1').evaluate(panel => {
    const name = panel.querySelector('input[aria-label="نام مفهوم"]')?.value || '';
    const selections = [];
    for (const section of panel.querySelectorAll('.composition-layer[data-layer]')) {
      const layer = section.getAttribute('data-layer');
      [...section.querySelectorAll('.composition-note')].forEach((row, position) => {
        selections.push({ note_id: row.getAttribute('data-selected-note-id'), layer, position });
      });
    }
    return { name, selections };
  });
}

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const allowed = (status, url) => {
  const path = new URL(url).pathname;
  return (status === 401 && ['/api/v1/auth/session', '/api/v1/fragrance-concepts', '/api/v1/users/me'].includes(path)) ||
    (status === 403 && path === '/api/v1/fragrance-concepts');
};
const report = watchPage(page, allowed);
const posts = [];
page.on('response', response => {
  if (pathOf(response) === '/api/v1/fragrance-concepts' && response.request().method() === 'POST') posts.push(response);
});

try {
  const anonymous = await context.request.get(`${apiBase}/fragrance-concepts`);
  assert.equal(anonymous.status(), 401, 'Anonymous private concept list must be rejected');
  const anonymousUser = await context.request.get(`${apiBase}/users/me`);
  assert.equal(anonymousUser.status(), 401, 'Anonymous user details must be rejected');

  const familyResponse = responseFor(page, '/api/v1/fragrance-families');
  await page.goto(`${frontendOrigin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  const families = await (await familyResponse).json();
  assert.equal(families.length, 6, 'Real seeded families must load');
  assert.ok(families.every(family => family.is_demo));

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
  await page.getByRole('checkbox', { name: /گلی/ }).check({ force: true });
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
  const guided = {
    name: (await page.locator('.guided-result-name').textContent()).trim(),
    selections: await page.locator('.guided-result-layer li').evaluateAll(rows => {
      const positions = new Map();
      return rows.map(row => {
        const layer = row.closest('.guided-result-layer').getAttribute('data-layer');
        const position = positions.get(layer) || 0;
        positions.set(layer, position + 1);
        return { note_id: row.getAttribute('data-note-id'), layer, position };
      });
    }),
  };
  assert.ok(guided.name && guided.selections.length > 0);
  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق', exact: true }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?from=guided`);
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  await page.locator('#studio-panel-1').waitFor({ state: 'visible' });
  const noteResponse = await context.request.get(`${apiBase}/fragrance-notes?limit=100&offset=0`);
  assert.equal(noteResponse.status(), 200);
  const notes = await noteResponse.json();
  assert.equal(notes.length, 24, 'Real seeded notes must load');
  assert.ok(notes.every(note => note.is_demo));
  assert.ok(guided.selections.every(item => notes.some(note => note.id === item.note_id)));
  assert.deepEqual(await composition(page), guided, 'Guided composition must transfer exactly');

  await page.getByLabel('نام مفهوم').fill('روایت واقعی آزمون');
  const firstTop = guided.selections.find(item => item.layer === 'top');
  assert.ok(firstTop);
  const moved = notes.find(note => note.id === firstTop.note_id);
  await page.getByLabel(`لایه ${moved.name}`).selectOption('heart');
  const heart = page.locator('#studio-panel-1 .composition-layer[data-layer="heart"] .composition-note');
  assert.ok(await heart.count() >= 2);
  const secondId = await heart.nth(1).getAttribute('data-selected-note-id');
  const second = notes.find(note => note.id === secondId);
  await page.getByRole('button', { name: `جابجایی ${second.name} به بالا`, exact: true }).click();
  const edited = await composition(page);
  assert.notDeepEqual(edited, guided);

  await page.locator('.studio-save-top').click();
  const dialog = page.getByRole('dialog', { name: 'ورود برای ذخیره' });
  await dialog.waitFor();
  assert.deepEqual(await composition(page), edited);
  await dialog.getByLabel('شماره موبایل').fill(mobile);
  const challengeResponse = responseFor(page, '/api/v1/auth/challenges', 'POST');
  await dialog.getByRole('button', { name: 'دریافت کد' }).click();
  const challenge = await challengeResponse;
  assert.equal(challenge.status(), 202);
  const challengeBody = await challenge.json();
  assert.equal(Object.hasOwn(challengeBody, 'code'), false);
  assert.equal(Object.hasOwn(challengeBody, 'otp'), false);
  await dialog.getByLabel('کد شش رقمی').fill(await privateOtp());
  const verifyResponse = responseFor(page, '/api/v1/auth/verify', 'POST');
  await dialog.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyResponse).status(), 200);
  await dialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.').waitFor();
  assert.deepEqual(await composition(page), edited);
  const cookie = (await context.cookies(`${apiBase}/auth/session`)).find(item => item.name === 'aroman_session');
  assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/api/v1');
  assert.equal(posts.length, 0, 'Login must not auto-save');

  // Rotate the server token with the real endpoint while the UI retains its cached value.
  const rotated = await context.request.get(`${apiBase}/auth/csrf`);
  assert.equal(rotated.status(), 200);
  assert.match((await rotated.json()).csrf_token, /.+/);
  const firstSave = responseFor(page, '/api/v1/fragrance-concepts', 'POST');
  await page.locator('.studio-save-top').click();
  assert.equal((await firstSave).status(), 403, 'Stale client CSRF must be rejected');
  await page.waitForFunction(() => document.querySelector('.studio-save-top')?.textContent?.includes('ذخیره تغییرات'));
  assert.equal(posts.length, 2, 'Client must retry once after renewing CSRF');
  assert.equal(posts[1].status(), 201);
  assert.equal(report.apiResponses.filter(response => response.status === 403 && new URL(response.url).pathname === '/api/v1/fragrance-concepts').length, 1);
  assert.ok(report.apiResponses.some(response => new URL(response.url).pathname === '/api/v1/auth/csrf' && response.status === 200));
  const payloads = posts.map(response => response.request().postDataJSON());
  for (const payload of payloads) {
    assert.equal(payload.name, edited.name);
    assert.deepEqual(normalized(payload.notes), normalized(edited.selections));
  }
  const createdId = (await posts[1].json()).id;
  await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.').waitFor();

  const listResponse = responseFor(page, '/api/v1/fragrance-concepts');
  await page.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
  const listed = await (await listResponse).json();
  assert.equal(listed.length, 1, 'Exactly one concept must exist in the real database');
  assert.equal(listed[0].id, createdId, 'Account record must be the created record');
  assert.equal(listed[0].name, edited.name);
  assert.deepEqual(normalized(listed[0].notes), normalized(edited.selections));
  await page.getByRole('heading', { name: edited.name, exact: true }).waitFor();
  const conceptId = listed[0].id;
  const reopenResponse = responseFor(page, `/api/v1/fragrance-concepts/${conceptId}`);
  await page.getByRole('link', { name: 'باز کردن و ویرایش', exact: true }).click();
  assert.equal((await reopenResponse).status(), 200);
  await page.waitForFunction(expected => {
    const panel = document.querySelector('#studio-panel-1');
    if (panel?.querySelector('input[aria-label="نام مفهوم"]')?.value !== expected.name) return false;
    const selections = [];
    for (const section of panel.querySelectorAll('.composition-layer[data-layer]')) {
      [...section.querySelectorAll('.composition-note')].forEach((row, position) => selections.push({
        note_id: row.getAttribute('data-selected-note-id'), layer: section.getAttribute('data-layer'), position,
      }));
    }
    return JSON.stringify(selections) === JSON.stringify(expected.selections);
  }, edited);
  assert.deepEqual(await composition(page), edited);

  const logoutResponse = responseFor(page, '/api/v1/auth/session', 'DELETE');
  await page.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'خروج' }).click();
  assert.equal((await logoutResponse).status(), 204);
  assert.equal((await context.cookies(`${apiBase}/auth/session`)).some(item => item.name === 'aroman_session'), false);
  assert.equal((await context.request.get(`${apiBase}/fragrance-concepts`)).status(), 401);
  assert.equal((await context.request.get(`${apiBase}/auth/session`)).status(), 401);
  assertNoBrowserErrors(report, 'real FastAPI browser journey');
  console.log('REAL-STACK PASS: seeded catalog, private 401, Guided transfer, FakeSMS login, CSRF rejection and retry, one saved concept, reopen, logout');
} finally {
  await browser.close();
}
