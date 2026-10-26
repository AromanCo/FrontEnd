import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { apiBase, assertNoBrowserErrors, checkLayout, frontendOrigin, openBrowser, watchPage } from './browser-utils.mjs';

const outputDir = join(process.cwd(), process.env.QA_INTEGRATION_SCREENSHOT_DIR || 'artifacts/integrated-qa');
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const responses = [];
const report = watchPage(page, (status, url) =>
  (status === 401 && url.endsWith('/api/v1/auth/session')) ||
  (status === 503 && url.endsWith('/api/v1/auth/challenges')),
);
page.on('response', response => {
  if (response.url().includes('/api/v1/')) responses.push({ url: response.url(), method: response.request().method(), status: response.status() });
});

const screenshot = async name => page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: true, animations: 'disabled' });
const viewportWidths = [320, 390, 768, 1440];
const verifyResponsive = async label => {
  const measurements = [];
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    measurements.push(await checkLayout(page, `${label} ${width}px`));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  return measurements;
};
const choose = async (role, name) => {
  const option = page.getByRole(role, { name });
  if (!(await option.isChecked())) await option.locator('xpath=..').click();
  await page.waitForFunction(element => element.checked, await option.elementHandle());
};
const next = () => page.getByRole('button', { name: /ادامه|دیدن پیشنهاد من/ }).click();

try {
  await mkdir(outputDir, { recursive: true });

  const [familiesResponse, notesResponse, productsResponse] = await Promise.all([
    fetch(`${apiBase}/fragrance-families?limit=100&offset=0`),
    fetch(`${apiBase}/fragrance-notes?limit=100&offset=0`),
    fetch(`${apiBase}/products?limit=100&offset=0`),
  ]);
  assert.equal(familiesResponse.status, 200, 'Live family catalog request failed');
  assert.equal(notesResponse.status, 200, 'Live note catalog request failed');
  assert.equal(productsResponse.status, 200, 'Live product catalog request failed');
  const [families, notes, products] = await Promise.all([familiesResponse.json(), notesResponse.json(), productsResponse.json()]);
  assert.ok(families.length > 0 && notes.length > 0 && products.length > 0, 'The real demonstration catalogs must be seeded');
  assert.ok(products.every(product => product.is_demo), 'Current seeded products should be explicitly marked as demonstration data');
  const familyProduct = products.find(product => product.family_id);
  assert.ok(familyProduct, 'Seeded demo products should include a family-linked record for filter coverage');

  await page.goto(frontendOrigin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /رایحه‌ای که/ }).waitFor();
  await assertNoBrowserErrors(report, 'home');
  await screenshot('home-1440');
  await verifyResponsive('home');

  await page.getByRole('link', { name: /کشف عطرها/ }).first().click();
  await page.waitForURL('**/shop');
  await page.getByRole('heading', { name: 'کشف محصولات' }).waitFor();
  await page.getByLabel('خانواده رایحه').selectOption(familyProduct.family_id);
  await page.getByRole('button', { name: 'اعمال فیلتر' }).click();
  await page.waitForURL(/\/shop\?family_id=/);
  const familyProductsResponse = await fetch(`${apiBase}/products?family_id=${encodeURIComponent(familyProduct.family_id)}&limit=100&offset=0`);
  assert.equal(familyProductsResponse.status, 200, 'Live product family filter request failed');
  const expectedFamilyProducts = await familyProductsResponse.json();
  const renderedFamilyProducts = await page.locator('.product-editorial-card h3').allTextContents();
  assert.deepEqual(renderedFamilyProducts, expectedFamilyProducts.map(product => product.name), 'Shop family filtering should match live API records');
  const search = page.getByPlaceholder('نام محصول');
  await search.fill(familyProduct.name);
  await page.getByRole('button', { name: 'اعمال فیلتر' }).click();
  await page.waitForURL(/\/shop\?q=.*family_id=/);
  await page.getByRole('heading', { name: familyProduct.name }).waitFor();
  const productCard = page.locator('.product-editorial-card').filter({ has: page.getByRole('heading', { name: familyProduct.name }) });
  assert.equal(await productCard.getByText('محصول نمایشی', { exact: true }).count(), 1, 'Product card should disclose demonstration data');
  await verifyResponsive('shop listing');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('shop-filtered-390');

  await page.getByRole('link', { name: 'مشاهده جزئیات' }).click();
  await page.waitForURL(`**/shop/${familyProduct.id}`);
  await page.getByRole('heading', { name: familyProduct.name }).waitFor();
  await page.getByText(/قیمت، موجودی و خرید آنلاین هنوز در دسترس نیستند/).waitFor();
  await verifyResponsive('product detail');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('product-detail-390');

  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  await page.getByRole('navigation', { name: 'ناوبری موبایل' }).getByRole('link', { name: 'استودیو راهنما' }).click();
  await page.waitForURL('**/studio/guided');
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 5, 'Guided should render the five approved feeling choices');
  await choose('radio', /آرام و آسوده/); await next();
  await page.getByRole('heading', { name: 'جهان‌های رایحه' }).waitFor();
  const availableFamily = families[0];
  await page.locator(`input[name="familyIds"][value="${availableFamily.id}"]`).check({ force: true }); await next();
  await page.getByRole('heading', { name: 'دمای حسی' }).waitFor(); await choose('radio', /نرم و متعادل/); await next();
  await page.getByRole('heading', { name: 'یک تصویر برای خیال' }).waitFor(); await choose('radio', /باغ پس از باران/); await next();
  await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }).waitFor();
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click(); await next();
  await page.getByRole('heading', { name: 'بازبینی و میزان کشف' }).waitFor();
  await choose('radio', /کمی آشنا، کمی تازه/); await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const resultRows = page.locator('.guided-result-layer li');
  const resultRecords = await resultRows.evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute('data-note-id'),
    layer: row.closest('.guided-result-layer')?.getAttribute('data-layer'),
  })));
  const resultIds = resultRecords.map(item => item.id);
  assert.ok(resultIds.length > 0 && resultIds.every(id => notes.some(note => note.id === id)), 'Guided result must use real note UUIDs from FastAPI');
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(page, `Guided result ${width}px`);
    if (width === 320 || width === 390 || width === 1440) await screenshot(`guided-result-${width}`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم' }).click();
  const login = page.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
  await login.waitFor();
  assert.equal(await login.getAttribute('aria-modal'), 'true', 'Login dialog should be modal');
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Anonymous Save must preserve the result');
  assert.equal(responses.some(item => item.url.includes('/fragrance-concepts') && item.method === 'POST'), false, 'Anonymous Save must not make a private concept POST');
  await login.getByRole('button', { name: 'دریافت کد' }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await login.getByRole('button', { name: 'بستن' }).evaluate(element => element === document.activeElement), true, 'Login dialog focus must wrap within the dialog');
  await verifyResponsive('login dialog');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login.getByPlaceholder('09123456789').fill('۰۹۱۲۳۴۵۶۷۸۹');
  const smsResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/challenges'));
  await login.getByRole('button', { name: 'دریافت کد' }).click();
  assert.equal((await smsResponse).status(), 503, 'Unconfigured SMS provider should report service unavailable');
  await login.getByRole('alert').getByText('این سرویس در حال حاضر در دسترس نیست.').waitFor();
  await screenshot('guided-save-sms-unavailable-1440');
  await login.getByRole('button', { name: 'بستن' }).click();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();

  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  const imported = page.locator('.composition-note');
  await imported.first().waitFor();
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const importedRecords = await imported.evaluateAll(items => items.map(item => ({ id: item.getAttribute('data-selected-note-id'), layer: item.querySelector('select')?.value })));
  assert.deepEqual(importedRecords.map(item => item.id), resultIds, 'Creative import should preserve ordered result note IDs');
  const expectedLayers = resultRecords.map(item => item.layer);
  assert.deepEqual(importedRecords.map(item => item.layer), expectedLayers, 'Creative import should preserve conceptual layers');
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), 'رایحهٔ من');
  assert.ok(importedRecords.every(item => notes.some(note => note.id === item.id)), 'Creative import must resolve all IDs from the live note catalog');
  await verifyResponsive('imported Creative Studio');
  await screenshot('creative-guided-import-1440');
  assert.equal(responses.some(item => item.url.includes('/fragrance-concepts') && item.method === 'POST'), false, 'Handoff must not save automatically');

  await page.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/account');
  await page.getByRole('heading', { name: 'حساب من' }).waitFor();
  await page.locator('#main').getByRole('link', { name: 'ورود' }).waitFor();
  await verifyResponsive('anonymous account');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('account-anonymous-390');

  const unknownProduct = await page.goto(`${frontendOrigin}/shop/not-a-uuid`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'این صفحه پیدا نشد' }).waitFor();
  assert.ok([200, 404].includes(unknownProduct?.status() || 0), 'Invalid product route did not render a valid response');
  const robotContents = await page.locator('meta[name="robots"]').evaluateAll(metas => metas.map(meta => meta.getAttribute('content') || ''));
  assert.ok(robotContents.length > 0 && robotContents.every(content => /noindex/.test(content)), 'Not-found response should not be indexed');
  assert.equal(await page.locator('.product-editorial-card').count(), 0, 'Invalid product route must not fabricate a product');
  await screenshot('invalid-product-route-390');

  const errorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errorReport = watchPage(errorPage, (status, url) =>
    (status === 503 && url.includes('/api/v1/fragrance-notes?')) ||
    (status === 401 && url.endsWith('/api/v1/auth/session')),
  );
  let failFirstNoteRequest = true;
  await errorPage.route('**/api/v1/fragrance-notes?*', async route => {
    if (failFirstNoteRequest) {
      failFirstNoteRequest = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Isolated QA-only failure fixture' }) });
    } else {
      await route.continue();
    }
  });
  await errorPage.goto(`${frontendOrigin}/studio/creative`, { waitUntil: 'domcontentloaded' });
  const apiError = errorPage.locator('#studio-panel-0 [role="alert"]');
  await apiError.waitFor();
  await apiError.getByRole('button', { name: 'تلاش دوباره' }).waitFor();
  await errorPage.screenshot({ path: join(outputDir, 'creative-api-error-390.png'), fullPage: true, animations: 'disabled' });
  const retryResponse = errorPage.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?') && response.status() === 200);
  await apiError.getByRole('button', { name: 'تلاش دوباره' }).click();
  assert.equal((await retryResponse).status(), 200, 'Retry must call the real FastAPI catalog');
  await errorPage.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  assertNoBrowserErrors(errorReport, 'Creative API error/retry');
  await errorPage.close();

  await page.goto(`${frontendOrigin}/cart`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'سبد خرید' }).waitFor();
  await page.getByText(/در سرور ثبت نمی‌شود/).waitFor();
  await verifyResponsive('cart placeholder');
  await page.goto(`${frontendOrigin}/checkout`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'تسویه‌حساب نمایشی' }).waitFor();
  await page.getByText(/هیچ سفارش یا پرداختی ثبت نمی‌شود/).waitFor();
  await verifyResponsive('checkout placeholder');

  await runIsolatedAccountJourney(browser, notes[0]);

  assertNoBrowserErrors(report, 'integrated journey');
  assert.ok(families.length > 0 && notes.length > 0);
  console.log(`Integrated QA PASS: ${families.length} live families, ${notes.length} live notes, ${products.length} demonstration products; ${resultIds.length} real Guided notes transferred with layers; anonymous Save made no private POST; SMS 503 shown honestly; invalid product rendered noindex not-found UI (HTTP ${unknownProduct.status()}).`);
} finally {
  await browser.close();
}

async function runIsolatedAccountJourney(browser, realNote) {
  const accountPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const accountReport = watchPage(accountPage, (status, url) => status === 403 && url.includes('/api/v1/fragrance-concepts/'));
  const userId = '00000000-0000-4000-8000-000000000901';
  const makeConcept = (index, name = `مفهوم آزمایش ${index}`) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name,
    notes: [{ note_id: realNote.id, layer: 'top', position: 0 }],
  });
  const concepts = Array.from({ length: 21 }, (_, index) => makeConcept(index + 1000));
  let csrfRequests = 0;
  let duplicateRequests = 0;

  await accountPage.route(`${apiBase}/auth/csrf`, route => {
    csrfRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrf_token: `isolated-csrf-${csrfRequests}` }) });
  });
  await accountPage.route(`${apiBase}/users/me`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: userId, mobile_e164: '+989120000901', role: 'customer' }),
  }));
  await accountPage.route(`${apiBase}/fragrance-concepts**`, async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;
    if (method === 'GET' && pathname.endsWith('/fragrance-concepts')) {
      const offset = Number(url.searchParams.get('offset') || 0);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(concepts.slice(offset, offset + 20)) });
    }
    if (method === 'POST' && pathname.endsWith('/duplicate')) {
      duplicateRequests += 1;
      if (duplicateRequests === 1) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'csrf_invalid', detail: 'isolated stale CSRF fixture' }) });
      const duplicate = makeConcept(999, 'مفهوم کپی‌شده');
      concepts.unshift(duplicate);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(duplicate) });
    }
    if (method === 'DELETE' && pathname.match(/\/fragrance-concepts\/[^/]+$/)) {
      const id = pathname.split('/').at(-1);
      const index = concepts.findIndex(item => item.id === id);
      if (index >= 0) concepts.splice(index, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
  await accountPage.route(`${apiBase}/auth/session`, async route => {
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: userId, role: 'customer' }) });
  });

  try {
    await accountPage.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
    await accountPage.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
    await accountPage.locator('article').nth(19).waitFor();
    assert.equal(await accountPage.locator('article').count(), 20, 'Account should render the first page of concepts');
    await accountPage.getByRole('button', { name: 'نمایش بیشتر' }).click();
    await accountPage.locator('article').nth(20).waitFor();
    assert.equal(await accountPage.locator('article').count(), 21, 'Account pagination should append the next concept page');

    const firstCard = accountPage.locator('article').first();
    await firstCard.getByRole('button', { name: 'کپی' }).click();
    await accountPage.getByRole('status').getByText('مفهوم کپی شد.').waitFor();
    assert.equal(duplicateRequests, 2, 'A stale CSRF response should renew and retry once through the shared API client');
    assert.ok(csrfRequests >= 2, 'The CSRF token should be renewed after the isolated 403');
    assert.equal(await accountPage.locator('article').count(), 20, 'Duplicating should reload the first page of the list');
    await accountPage.locator('article').first().getByRole('heading', { name: 'مفهوم کپی‌شده' }).waitFor();

    accountPage.on('dialog', dialog => dialog.accept());
    await accountPage.locator('article').first().getByRole('button', { name: 'حذف' }).click();
    await accountPage.getByRole('status').getByText('مفهوم حذف شد.').waitFor();
    assert.equal(await accountPage.locator('article').count(), 20, 'Confirmed delete should remove the concept from the list');

    await accountPage.getByRole('button', { name: 'خروج' }).click();
    await accountPage.locator('#main').getByRole('link', { name: 'ورود' }).waitFor();
    assertNoBrowserErrors(accountReport, 'isolated account fixture journey');
    console.log('Isolated account fixture PASS: 20+1 pagination, duplicate with CSRF renewal, confirmed delete, and logout.');
  } finally {
    await accountPage.close();
  }
}

