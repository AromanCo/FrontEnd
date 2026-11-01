import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const api = process.env.API_ORIGIN || 'http://localhost:8000';
const browserPath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

const json = (route, value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
const hold = (() => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; })();
let blockedImport = false;
let initialImportFinished;
const initialImportStarted = new Promise(resolve => { initialImportFinished = resolve; });

try {
  // This isolated Playwright fixture supplies a session only for saved-concept
  // route coverage. It does not add or expose an application OTP/auth bypass.
  await page.route(`${api}/api/v1/auth/session`, route => json(route, { user_id: '00000000-0000-4000-8000-000000000701', role: 'customer' }));
  await page.route(`${api}/api/v1/auth/csrf`, route => json(route, { csrf_token: 'playwright-isolated-csrf-fixture' }));
  await page.route(`${api}/api/v1/users/me`, route => json(route, { id: '00000000-0000-4000-8000-000000000701', mobile_e164: '+989121234567', role: 'customer' }));

  let realNotes = [];
  await page.route(`${api}/api/v1/fragrance-notes?limit=100&offset=0`, async route => {
    const currentUrl = new URL(page.url());
    if (!blockedImport && currentUrl.pathname === '/studio/creative' && currentUrl.searchParams.get('from') === 'guided') {
      blockedImport = true;
      const response = await route.fetch();
      realNotes = await response.json();
      initialImportFinished();
      await hold.promise;
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });

  const savedId = '00000000-0000-4000-8000-000000000799';
  const savedConcept = () => ({ id: savedId, name: 'مفهوم پیشین', notes: [{ note_id: realNotes[0]?.id, layer: 'heart', position: 0 }] });
  await page.route(`${api}/api/v1/fragrance-concepts?limit=20&offset=0`, route => json(route, [savedConcept()]));
  await page.route(`${api}/api/v1/fragrance-concepts/${savedId}`, route => json(route, savedConcept()));

  const familiesResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-families?'));
  const notesResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?') && new URL(response.url()).searchParams.get('limit') === '100');
  await page.goto(`${origin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  const [familyResponse, noteResponse] = await Promise.all([familiesResponse, notesResponse]);
  const families = await familyResponse.json();
  const notes = await noteResponse.json();
  assert.equal(familyResponse.status(), 200);
  assert.equal(noteResponse.status(), 200);
  assert.ok(families.length && notes.length, 'Guided catalog must be live API data');
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  const choose = async (role, name) => {
    const control = page.getByRole(role, { name });
    if (await control.isChecked()) return;
    await control.locator('xpath=..').click();
    await page.waitForFunction(element => element.checked, await control.elementHandle());
  };
  const next = () => page.getByRole('button', { name: /ادامه|دیدن پیشنهاد من/ }).click();
  await choose('radio', /آرام و آسوده/); await next();
  await page.getByRole('heading', { name: 'جهان‌های رایحه' }).waitFor();
  await page.locator(`input[name="familyIds"][value="${families[0].id}"]`).check({ force: true }); await next();
  await page.getByRole('heading', { name: 'دمای حسی' }).waitFor(); await choose('radio', /نرم و متعادل/); await next();
  await page.getByRole('heading', { name: 'یک تصویر برای خیال' }).waitFor(); await choose('radio', /باغ پس از باران/); await next();
  await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }).waitFor();
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click(); await next();
  await page.getByRole('heading', { name: 'بازبینی و میزان کشف' }).waitFor();
  await choose('radio', /کمی آشنا، کمی تازه/); await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const guidedIds = await page.locator('.guided-result-layer li').evaluateAll(items => items.map(item => item.getAttribute('data-note-id')));
  const guidedLayers = await page.locator('.guided-result-layer li').evaluateAll(items => items.map(item => item.closest('.guided-result-layer')?.getAttribute('data-layer')));
  assert.ok(guidedIds.length && guidedIds.every(id => notes.some(note => note.id === id)));

  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await initialImportStarted;
  assert.ok(realNotes.length > 0 && realNotes.some(note => guidedIds.includes(note.id)));
  assert.equal(await page.getByText('پیش‌نویس در حال بررسی با کاتالوگ فعلی است…').isVisible(), true);

  // Leave the import request pending, visit the saved account concept, then
  // explicitly accept the Guided draft. This exercises the real App Router URL
  // transition and the shared root provider across route changes.
  await page.getByRole('link', { name: 'حساب من' }).click();
  await page.waitForURL('**/account');
  await page.getByRole('link', { name: 'باز کردن و ویرایش' }).waitFor();
  await page.getByRole('link', { name: 'باز کردن و ویرایش' }).click();
  await page.waitForURL(`**/studio/creative?concept=${savedId}`);
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'مفهوم پیشین'));
  await page.getByRole('button', { name: 'بارگذاری پیش‌نویس هدایت‌شده' }).waitFor();
  assert.equal(await page.getByText('یک پیش‌نویس ذخیره‌نشده از استودیوی هدایت‌شده در همین برگه آماده است.').isVisible(), true);

  await page.getByRole('button', { name: 'بارگذاری پیش‌نویس هدایت‌شده' }).click();
  await page.getByRole('dialog', { name: 'جایگزینی ترکیب فعلی' }).getByRole('button', { name: 'جایگزینی و بارگذاری' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  const importedIds = await page.locator('.composition-note').evaluateAll(items => items.map(item => item.getAttribute('data-selected-note-id')));
  const importedLayers = await page.locator('.composition-note').evaluateAll(items => items.map(item => item.querySelector('select')?.value));
  assert.deepEqual(importedIds, guidedIds);
  assert.deepEqual(importedLayers, guidedLayers);
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), 'رایحهٔ من');
  assert.ok(await page.getByRole('button', { name: 'ذخیره مفهوم' }).count() > 0, 'Imported draft is a new unsaved concept');
  assert.equal(await page.getByRole('button', { name: 'ذخیره تغییرات' }).count(), 0, 'Old saved concept must no longer be the update target');

  // Complete the superseded request only after import 2 has initialized. It
  // must not reapply the old composition after its route intent was invalidated.
  hold.release();
  await page.waitForTimeout(100);
  assert.deepEqual(await page.locator('.composition-note').evaluateAll(items => items.map(item => item.getAttribute('data-selected-note-id'))), guidedIds);
  assert.deepEqual(pageErrors, [], pageErrors.join('\n'));
  console.log(`Saved-route URL detached to ${page.url()}; imported ${guidedIds.length} real note IDs and layers; stale in-flight import ignored.`);
  console.log('Isolated saved-concept browser route journey PASS (auth/concept responses are Playwright-only fixtures; catalog is real FastAPI).');
} finally {
  hold.release();
  await browser.close();
}
