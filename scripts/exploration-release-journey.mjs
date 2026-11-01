import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { families, notes } from './guided-save-fixture.mjs';

if (process.env.AROMAN_RELEASE_SCOPE !== 'exploration') {
  throw new Error('Build and run this journey with AROMAN_RELEASE_SCOPE=exploration.');
}
const origin = 'http://127.0.0.1:3317';
const apiOrigin = 'http://127.0.0.1:18761';
process.env.FRONTEND_ORIGIN = origin;
const { openBrowser } = await import('./browser-utils.mjs');
const productId = '00000000-0000-4000-8000-000000000101';
const product = {
  id: productId, slug: 'synthetic-demo', name: 'محصول ساختگی آزمون', description: 'فقط دادهٔ ساختگی آزمون.',
  is_demo: true, brand_id: families[0].id, family_id: families[0].id,
};
const allowedCatalog = new Set([
  'GET /api/v1/products', `GET /api/v1/products/${productId}/variants`,
  'GET /api/v1/brands', 'GET /api/v1/fragrance-families', 'GET /api/v1/fragrance-notes',
]);
const serverApiCalls = [];
const browserApiCalls = [];
const unexpectedExternalRequests = [];
const json = (response, status, payload) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
};
const apiServer = createServer((request, response) => {
  const url = new URL(request.url || '/', apiOrigin);
  const call = { method: request.method || 'GET', path: url.pathname };
  serverApiCalls.push(call);
  if (!allowedCatalog.has(`${call.method} ${call.path}`)) {
    json(response, 404, { detail: 'Unexpected request rejected by isolated loopback fixture' });
    return;
  }
  let payload;
  if (url.pathname === '/api/v1/products') payload = [product];
  else if (url.pathname === `/api/v1/products/${productId}/variants`) payload = [{
    id: '00000000-0000-4000-8000-000000000102', product_id: productId, sku: 'SYNTHETIC',
    label: 'گونهٔ نمایشی', volume_ml: 30, is_demo: true,
  }];
  else if (url.pathname === '/api/v1/brands') payload = [];
  else if (url.pathname === '/api/v1/fragrance-families') payload = families;
  else payload = notes;
  json(response, 200, payload);
});

await new Promise(resolve => apiServer.listen(18761, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3317'], {
  env: {
    ...process.env,
    AROMAN_RELEASE_SCOPE: 'exploration',
    AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    NEXT_PUBLIC_AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before ready. ${serverLog}`);
    try { if ((await fetch(origin)).status < 500) { ready = true; break; } } catch { /* wait for loopback listener */ }
    await delay(500);
  }
  assert.ok(ready, `Next.js production server did not start. ${serverLog}`);
  browser = await openBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') || url.origin === apiOrigin) {
      const call = { method: request.method(), path: url.pathname };
      browserApiCalls.push(call);
      if (url.origin !== apiOrigin || !allowedCatalog.has(`${call.method} ${call.path}`)) {
        await route.fulfill({ status: 599, json: { detail: 'Unexpected browser API request rejected by fixture' } });
        return;
      }
      if (url.pathname === '/api/v1/fragrance-families') {
        await route.fulfill({ status: 200, json: families });
      } else if (url.pathname === '/api/v1/fragrance-notes') {
        const q = (url.searchParams.get('q') || '').toLocaleLowerCase('fa');
        const familyId = url.searchParams.get('family_id');
        const filtered = notes.filter(note => (!familyId || note.family_id === familyId) &&
          (!q || `${note.name} ${note.slug}`.toLocaleLowerCase('fa').includes(q)));
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Number(url.searchParams.get('limit') || 100);
        await route.fulfill({ status: 200, json: filtered.slice(offset, offset + limit) });
      } else if (url.pathname.endsWith('/products')) {
        await route.fulfill({ status: 200, json: [product] });
      } else if (url.pathname.endsWith('/variants')) {
        await route.fulfill({ status: 200, json: [{
          id: '00000000-0000-4000-8000-000000000102', product_id: productId, sku: 'SYNTHETIC',
          label: 'گونهٔ نمایشی', volume_ml: 30, is_demo: true,
        }] });
      } else {
        await route.fulfill({ status: 200, json: [] });
      }
      return;
    }
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
      return;
    }
    unexpectedExternalRequests.push(`${request.method()} ${url.href}`);
    await route.abort('blockedbyclient');
  });

  const home = await page.goto(origin);
  assert.equal(home.status(), 200, 'Home must return 200 from the production Next.js server');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await page.locator('header.site-header a[href="/login"], header.site-header a[href="/account"]').count(), 0);
  assert.equal(await page.locator('header.site-header a[href="/cart"]').count(), 0);
  const shop = await page.goto(`${origin}/shop`);
  assert.equal(shop.status(), 200, 'Catalog must return 200');
  const detail = await page.goto(`${origin}/shop/${productId}`);
  assert.equal(detail.status(), 200, 'Product detail route must remain accessible');
  await page.getByRole('heading', { name: 'محصول ساختگی آزمون' }).waitFor();
  await page.getByText(/این ورودی برای کاوش در کاتالوگ است/).waitFor();

  // Creative Studio: select synthetic catalog content and exercise advisory apply/undo.
  const creative = await page.goto(`${origin}/studio/creative?concept=${randomUUID()}`);
  assert.equal(creative.status(), 200, 'Creative Studio deep link must remain accessible');
  await page.getByRole('heading', { name: 'روایت رایحه‌ی شما' }).waitFor();
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const chosenNote = notes[0];
  await page.locator(`#studio-panel-0 [data-note-id="${chosenNote.id}"]`).click();
  await page.setViewportSize({ width: 700, height: 900 });
  await page.getByRole('tab', { name: /ترکیب/ }).click();
  await page.locator(`[data-selected-note-id="${chosenNote.id}"]`).waitFor();
  assert.equal(await page.getByRole('button', { name: /ذخیره مفهوم|ذخیره تغییرات/ }).count(), 0);
  assert.equal(await page.getByRole('dialog', { name: /ورود/ }).count(), 0);
  const advisor = page.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
  const advisorDisclosure = advisor.locator('summary');
  if (!(await advisorDisclosure.evaluate(element => element.parentElement.open))) await advisorDisclosure.click();
  await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
  const suggestion = advisor.getByRole('region', { name: 'پیشنهاد برای کاوش' });
  const noGuidance = advisor.getByText('برای این ترکیب پیشنهاد ویرایشی دیگری نداریم.');
  const outcome = await Promise.race([
    suggestion.waitFor({ state: 'visible' }).then(() => 'suggestion'),
    noGuidance.waitFor({ state: 'visible' }).then(() => 'no-guidance'),
  ]);
  if (outcome === 'suggestion') {
    await advisor.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }).click();
    await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی' }).waitFor();
    await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی' }).click();
    await page.locator(`[data-selected-note-id="${chosenNote.id}"]`).waitFor();
  }
  assert.equal(await advisor.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).count(), 0, 'Account fork action must be absent');
  assert.equal(await advisor.getByRole('button', { name: /ذخیره مفهوم|ذخیره تغییرات/ }).count(), 0);

  // Guided Studio: answer the questionnaire and transfer its draft in memory.
  const guided = await page.goto(`${origin}/studio/guided`);
  assert.equal(guided.status(), 200, 'Guided Studio must return 200');
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
  await page.getByRole('heading', { name: 'دمای حسی' }).waitFor();
  await choose('radio', /نرم و متعادل/); await next();
  await page.getByRole('heading', { name: 'یک تصویر برای خیال' }).waitFor();
  await choose('radio', /باغ پس از باران/); await next();
  await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }).waitFor();
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click(); await next();
  await page.getByRole('heading', { name: 'بازبینی و میزان کشف' }).waitFor();
  await choose('radio', /کمی آشنا، کمی تازه/); await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'ذخیرهٔ مفهوم' }).count(), 0, 'Guided Save action must be absent');
  const expectedTransfer = await page.locator('.guided-result-layer li').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-note-id'),
    layer: item.closest('.guided-result-layer')?.getAttribute('data-layer'),
  })));
  assert.ok(expectedTransfer.length > 0 && expectedTransfer.every(item => notes.some(note => note.id === item.id)));
  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor({ state: 'attached' });
  if (expectedTransfer.length > 0) await page.locator('.composition-note').first().waitFor({ state: 'visible' });
  const actualTransfer = await page.locator('.composition-note').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-selected-note-id'), layer: item.querySelector('select')?.value,
  })));
  assert.deepEqual(actualTransfer, expectedTransfer, 'Guided selections and layers must transfer to Creative Studio');
  assert.equal(await page.getByRole('button', { name: /ذخیره مفهوم|ذخیره تغییرات/ }).count(), 0);
  assert.equal(await page.getByRole('dialog', { name: /ورود/ }).count(), 0);

  for (const route of ['/login', '/login/', '/login/nested', '/account', '/account/', '/account/nested', '/cart', '/cart/', '/cart/nested', '/checkout', '/checkout/', '/checkout/nested']) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 404, `${route} should be unavailable after Next.js slash normalization`);
  }
  const excludedPost = await fetch(`${origin}/checkout/nested/`, { method: 'POST', body: 'synthetic=1' });
  assert.equal(excludedPost.status, 404, 'Non-GET requests to excluded routes must also be blocked');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  const mobileNav = page.getByRole('navigation', { name: 'ناوبری موبایل' });
  assert.equal(await mobileNav.getByRole('link', { name: 'حساب من' }).count(), 0);
  assert.equal(await mobileNav.getByRole('link', { name: 'سبد خرید' }).count(), 0);
  assert.equal(await mobileNav.getByRole('link', { name: 'کشف رایحه‌ها' }).count(), 1);

  const privatePath = /\/auth\/|\/users\/|\/fragrance-concepts/;
  assert.equal(browserApiCalls.some(call => privatePath.test(call.path)), false,
    `Browser made an authentication, user, or saved-concept request: ${JSON.stringify(browserApiCalls)}`);
  assert.equal(browserApiCalls.every(call => allowedCatalog.has(`${call.method} ${call.path}`)), true,
    `Browser API calls must be GETs to approved synthetic catalog paths: ${JSON.stringify(browserApiCalls)}`);
  assert.equal(serverApiCalls.some(call => privatePath.test(call.path)), false,
    `Next.js server generated a private API call: ${JSON.stringify(serverApiCalls)}`);
  assert.equal(serverApiCalls.every(call => allowedCatalog.has(`${call.method} ${call.path}`)), true,
    `Next.js server API calls must be GETs to approved synthetic catalog paths: ${JSON.stringify(serverApiCalls)}`);
  assert.deepEqual(unexpectedExternalRequests, [], `Browser attempted public/external network access: ${JSON.stringify(unexpectedExternalRequests)}`);
  assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join('; ')}`);
  assert.ok(browserApiCalls.length > 0, 'Browser should load the synthetic catalog fixture');
  assert.ok(serverApiCalls.length > 0, 'Next.js server should load catalog through loopback fixture');
  await context.close();
  console.log(`PASS production Next.js exploration journey: Creative advisor ${outcome}; Guided result transferred ${actualTransfer.length} notes; restricted routes (including POST) returned 404; only isolated catalog API requests observed.`);
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(3000)]);
  }
  await new Promise(resolve => apiServer.close(resolve));
}
