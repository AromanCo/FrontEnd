import assert from 'node:assert/strict';
import { openBrowser } from './browser-utils.mjs';

export async function runExplorationJourney({ apiOrigin, frontendOrigin }) {
const allowed = new Set([
  'GET /api/v1/brands', 'GET /api/v1/products',
  'GET /api/v1/fragrance-families', 'GET /api/v1/fragrance-notes',
]);
const forbiddenPaths = [
  '/api/v1/auth/challenges', '/api/v1/auth/verify', '/api/v1/auth/session',
  '/api/v1/auth/csrf', '/api/v1/users/me', '/api/v1/fragrance-concepts',
  '/health/ready', '/health/live', '/docs', '/redoc', '/openapi.json', '/unknown-route',
];
const response = (method, path, origin) => fetch(`${apiOrigin}${path}`, {
  method, headers: origin ? { Origin: origin } : {},
  body: method === 'POST' ? '{"synthetic":true}' : undefined,
  redirect: 'manual', signal: AbortSignal.timeout(5000),
});
const productVariantPath = id => `/api/v1/products/${id}/variants`;

// Probe the restricted API independently of browser traffic.
for (const path of forbiddenPaths) {
  const res = await response('GET', path);
  assert.ok([404, 405].includes(res.status), `Restricted GET ${path} returned ${res.status}`);
}
for (const path of ['/api/v1/brands', '/api/v1/products', '/api/v1/fragrance-families', '/api/v1/fragrance-notes']) {
  const res = await response('POST', path);
  assert.ok([404, 405].includes(res.status), `Restricted POST ${path} returned ${res.status}`);
  const options = await response('OPTIONS', path, frontendOrigin);
  assert.ok([404, 405].includes(options.status), `Restricted OPTIONS ${path} returned ${options.status}`);
}
for (const path of ['/api/v1/auth/challenges', '/api/v1/auth/verify', '/api/v1/users/me', '/api/v1/fragrance-concepts']) {
  const res = await response('POST', path);
  assert.ok([404, 405].includes(res.status), `Restricted sensitive POST ${path} returned ${res.status}`);
}
const preflight = await response('OPTIONS', '/api/v1/fragrance-notes', frontendOrigin);
assert.equal(preflight.headers.get('access-control-allow-origin'), null, 'OPTIONS must not receive an allow-origin header');
const catalogCors = await response('GET', '/api/v1/fragrance-notes', frontendOrigin);
assert.equal(catalogCors.status, 200);
assert.equal(catalogCors.headers.get('access-control-allow-origin'), frontendOrigin);
assert.equal(catalogCors.headers.get('access-control-allow-credentials'), 'true');
assert.match(catalogCors.headers.get('vary') || '', /Origin/);
const unrelatedCors = await response('GET', '/api/v1/fragrance-notes', 'http://unrelated.invalid');
assert.equal(unrelatedCors.status, 200);
assert.equal(unrelatedCors.headers.get('access-control-allow-origin'), null);
assert.equal(unrelatedCors.headers.get('access-control-allow-credentials'), null);

const productResponse = await response('GET', '/api/v1/products');
const products = await productResponse.json();
assert.equal(productResponse.status, 200);
assert.equal(products.length, 3);
const product = products.find(item => item.slug === 'aroman-garden-demo');
assert.ok(product, 'Demonstration product was not returned by the actual catalog API');
assert.equal(product.is_demo, true);
const brandResponse = await response('GET', '/api/v1/brands');
assert.equal(brandResponse.status, 200);
assert.equal((await brandResponse.json()).length, 3);
const variantsResponse = await response('GET', productVariantPath(product.id));
const variants = await variantsResponse.json();
assert.equal(variantsResponse.status, 200);
assert.equal(variants.length, 1);
assert.equal(variants[0].is_demo, true);
const familyResponse = await response('GET', '/api/v1/fragrance-families');
const families = await familyResponse.json();
assert.equal(families.length, 6);
const noteResponse = await response('GET', '/api/v1/fragrance-notes');
const notes = await noteResponse.json();
assert.equal(notes.length, 24);
assert.ok(notes.some(note => note.slug === 'rose' && note.is_demo));

const browserCalls = [];
const external = [];
const errors = [];
const routeViolations = [];
const routeFailures = [];
let browser = null;
let context = null;
let page = null;
let smartPage = null;
let journeyFailure = null;
try {
  browser = await openBrowser();
  context = await browser.newContext({ serviceWorkers: 'block' });
  page = await context.newPage();
  const watchPageErrors = target => target.on('pageerror', error => errors.push(error.message));
  watchPageErrors(page);
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const apiPath = url.pathname === '/api/v1' || url.pathname.startsWith('/api/v1/');
    const sensitivePath = /^\/api\/v1\/(?:auth|users|fragrance-concepts)(?:\/|$)/.test(url.pathname);
    const deny = async reason => {
      routeViolations.push({ method: req.method(), origin: url.origin, path: url.pathname, reason });
      try { await route.abort('blockedbyclient'); }
      catch (error) { routeFailures.push(`${req.method()} ${url.origin}${url.pathname}: ${String(error)}`); }
    };

    if (sensitivePath) {
      if (url.origin !== apiOrigin && url.origin !== frontendOrigin && !['data:', 'blob:'].includes(url.protocol)) {
        external.push(`${req.method()} ${url.origin}${url.pathname}`);
      }
      await deny('sensitive API path requested from browser');
      return;
    }
    if (apiPath) {
      if (url.origin !== apiOrigin) {
        if (url.origin !== frontendOrigin) external.push(`${req.method()} ${url.origin}${url.pathname}`);
        await deny(`API path used an unapproved origin; expected ${apiOrigin}`);
        return;
      }
      const key = `${req.method()} ${url.pathname}`;
      browserCalls.push(key);
      const isVariantRead = req.method() === 'GET' && url.pathname === productVariantPath(product.id);
      if (!allowed.has(key) && !isVariantRead) {
        await deny('unapproved API method or path');
        return;
      }
      await route.continue(); // Approved catalog traffic reaches the real restricted FastAPI process.
      return;
    }
    if (url.origin === frontendOrigin || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
      return;
    }
    external.push(`${req.method()} ${url.origin}${url.pathname}`);
    await deny('unexpected external browser request');
  });

  assert.equal(process.env.AROMAN_RELEASE_SCOPE, 'exploration', 'Runtime must select exploration after a full-scope build');
  const home = await page.goto(frontendOrigin);
  assert.equal(home.status(), 200);
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  for (const path of ['/login', '/account', '/cart', '/checkout']) {
    const res = await fetch(`${frontendOrigin}${path}`, { redirect: 'manual' });
    assert.equal(res.status, 404, `Frontend ${path} must be unavailable`);
  }
  assert.equal(await page.locator('header.site-header a[href="/login"], header.site-header a[href="/account"], header.site-header a[href="/cart"]').count(), 0);

  const shop = await page.goto(`${frontendOrigin}/shop`);
  assert.equal(shop.status(), 200);
  await page.getByText('باغ آرومان — نمونه').waitFor();
  const detail = await page.goto(`${frontendOrigin}/shop/${product.id}`);
  assert.equal(detail.status(), 200);
  await page.getByRole('heading', { name: 'باغ آرومان — نمونه' }).waitFor();

  await page.goto(`${frontendOrigin}/studio/guided`);
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  const choose = async (role, name) => {
    const control = page.getByRole(role, { name });
    if (!(await control.isChecked())) await control.locator('xpath=..').click();
    assert.equal(await control.isChecked(), true, `Guided selection was not applied: ${String(name)}`);
  };
  const transition = async heading => {
    try {
      await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 15000 });
    } catch (error) {
      const headings = await page.locator('h1:visible').allTextContents();
      const alerts = await page.getByRole('alert').allTextContents();
      throw new Error(`Guided step transition to "${heading}" failed. Visible headings: ${JSON.stringify(headings)}. Alerts: ${JSON.stringify(alerts)}. ${error.message}`);
    }
  };
  const next = async heading => {
    try {
      await page.getByRole('button', { name: 'ادامه', exact: true }).click();
    } catch (error) {
      const headings = await page.locator('h1:visible').allTextContents();
      const alerts = await page.getByRole('alert').allTextContents();
      throw new Error(`Could not advance Guided step toward "${heading}". Visible headings: ${JSON.stringify(headings)}. Alerts: ${JSON.stringify(alerts)}. ${error.message}`);
    }
    await transition(heading);
  };
  await choose('radio', /آرام و آسوده/);
  await next('جهان‌های رایحه');
  const family = page.locator(`input[name="familyIds"][value="${families[0].id}"]`);
  await family.check({ force: true });
  assert.equal(await family.isChecked(), true, 'A real catalog family must be selected before advancing');
  await next('دمای حسی');
  await choose('radio', /نرم و متعادل/);
  await next('یک تصویر برای خیال');
  await choose('radio', /گوشه‌ای پر از گل/);
  await next('نت‌هایی که به دلتان می‌نشینند');
  const noteItems = page.locator('#guided-note-list .guided-note-item');
  await noteItems.first().waitFor();
  assert.equal(await noteItems.count(), 24, 'Guided must render all 24 real seeded notes');
  const likedNote = notes.find(note => note.slug === 'rose');
  const avoidedNote = notes.find(note => note.slug === 'lemon');
  const noteRow = slug => noteItems.filter({ has: page.getByText(notes.find(note => note.slug === slug).name, { exact: true }) });
  const likeButton = noteRow('rose').getByRole('button', { name: 'دوست دارم', exact: true });
  await likeButton.click();
  assert.equal(await likeButton.getAttribute('aria-pressed'), 'true', 'A real catalog note must be added to the liked list');
  const avoidButton = noteRow('lemon').getByRole('button', { name: 'کنار بگذار', exact: true });
  await avoidButton.click();
  assert.equal(await avoidButton.getAttribute('aria-pressed'), 'true', 'A real catalog note must be added to the avoided list');
  await next('بازبینی و میزان کشف');
  await choose('radio', /کمی آشنا، کمی تازه/);
  await page.getByRole('button', { name: 'دیدن پیشنهاد من', exact: true }).click();
  await transition('این تصویرِ رایحهٔ شماست');
  const resultNotes = await page.locator('.guided-result-layer li').count();
  assert.ok(resultNotes > 0);
  assert.equal(await page.getByRole('button', { name: 'ذخیرهٔ مفهوم' }).count(), 0);
  const transferred = await page.locator('.guided-result-layer li').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-note-id'),
    layer: item.closest('.guided-result-layer')?.getAttribute('data-layer'),
  })));
  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  const actualTransfer = await page.locator('.composition-note').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-selected-note-id'),
    layer: item.querySelector('select')?.value,
  })));
  assert.deepEqual(actualTransfer, transferred, 'Guided note selections and layers must transfer in browser memory');
  assert.equal(await page.getByRole('button', { name: /ذخیره مفهوم|ذخیره تغییرات/ }).count(), 0);

  // A separate, fresh tab gives Smart Perfumer a deterministic one-note composition.
  smartPage = await context.newPage();
  watchPageErrors(smartPage);
  await smartPage.setViewportSize({ width: 900, height: 900 });
  await smartPage.goto(`${frontendOrigin}/studio/creative`);
  await smartPage.getByRole('heading', { name: 'روایت رایحه‌ی شما' }).waitFor();
  await smartPage.locator('#studio-panel-0[data-note-status="ready"][data-note-count="24"]').waitFor();
  const realNote = notes.find(note => note.slug === 'rose');
  await smartPage.locator(`#studio-panel-0 [data-note-id="${realNote.id}"]`).click();
  await smartPage.getByRole('tab', { name: /ترکیب/ }).click();
  await smartPage.locator(`[data-selected-note-id="${realNote.id}"]`).waitFor();
  const compositionState = () => smartPage.locator('#studio-panel-1').evaluate(panel => [...panel.querySelectorAll('.composition-note')].map(item => ({
    id: item.getAttribute('data-selected-note-id'),
    layer: item.querySelector('select')?.value,
  })));
  const originalComposition = await compositionState();
  assert.deepEqual(originalComposition, [{ id: realNote.id, layer: 'heart' }], 'Smart Perfumer source must be exactly one actual seeded note in its initial layer');
  const advisor = smartPage.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
  const summary = advisor.locator('summary');
  if (!(await summary.evaluate(element => element.parentElement.open))) await summary.click();
  await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
  const proposal = advisor.getByRole('region', { name: 'پیشنهاد برای کاوش' });
  await proposal.waitFor({ state: 'visible' });
  assert.deepEqual(await compositionState(), originalComposition, 'Requesting Smart Perfumer guidance must not mutate the composition');
  const proposedLayers = await proposal.locator('.blend-advisor-layer').evaluateAll(rows => Object.fromEntries(rows.map(row => [
    row.querySelector('dt')?.textContent?.trim(), row.querySelector('dd')?.textContent?.trim(),
  ])));
  assert.equal(proposedLayers['آغازین'], realNote.name, 'The real seeded note should be proposed in the empty top layer');
  assert.equal(proposedLayers['میانی'], 'بدون نت');
  assert.equal(proposedLayers['پایه'], 'بدون نت');
  await advisor.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی', exact: true }).click();
  await advisor.getByText(/چیدمان پیشنهادی در ترکیب مفهومی اعمال شد/).waitFor();
  const appliedComposition = await compositionState();
  assert.deepEqual(appliedComposition, [{ id: realNote.id, layer: 'top' }], 'Apply must move the selected seeded note into the proposed top layer');
  await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی', exact: true }).click();
  await smartPage.locator('#studio-panel-1 [data-selected-note-id="' + realNote.id + '"] select').waitFor();
  assert.deepEqual(await compositionState(), originalComposition, 'Undo must restore the exact original seeded-note composition');
  assert.equal(await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی', exact: true }).count(), 0, 'Undo action must be consumed after restoration');
  assert.equal(await smartPage.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).count(), 0);
  assert.equal(await smartPage.getByRole('dialog', { name: /ورود/ }).count(), 0);

  const forbidden = /\/api\/v1\/(auth|users|fragrance-concepts)(\/|$)/;
  assert.equal(browserCalls.some(call => forbidden.test(call)), false, `Forbidden browser API request: ${browserCalls.join(', ')}`);
  assert.equal(browserCalls.every(call => allowed.has(call) || call === `GET ${productVariantPath(product.id)}`), true,
    `Browser made an unapproved API request: ${browserCalls.join(', ')}`);
  assert.ok(browserCalls.length > 0, 'Browser made no real catalog HTTP requests');
  assert.deepEqual(routeViolations, [], `Browser API request violations: ${JSON.stringify(routeViolations)}`);
  assert.deepEqual(routeFailures, [], `Playwright could not block one or more violating requests: ${routeFailures.join('; ')}`);
  assert.deepEqual(external, [], `Unexpected external browser traffic: ${external.join(', ')}`);
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  console.log(`PASS restricted exploration journey: ${browserCalls.length} real catalog browser requests; Guided selected ${likedNote.name} and avoided ${avoidedNote.name}; ${transferred.length} note/layer selections transferred; Smart Perfumer applied ${realNote.name} heart→top and Undo restored heart; direct forbidden APIs rejected; exact-origin credentialed CORS verified.`);
  return browserCalls;
} catch (error) {
  const details = [
    routeViolations.length ? `Recorded API request violations: ${JSON.stringify(routeViolations)}` : '',
    external.length ? `Recorded external requests: ${JSON.stringify(external)}` : '',
    routeFailures.length ? `Route blocking failures: ${routeFailures.join('; ')}` : '',
  ].filter(Boolean).join('\n');
  journeyFailure = error instanceof Error ? error : new Error(String(error));
  if (details) journeyFailure.message += `\n${details}`;
  throw journeyFailure;
} finally {
  const cleanupErrors = [];
  for (const [label, close] of [
    ['Smart Perfumer page', () => smartPage?.close()],
    ['Guided page', () => page?.close()],
    ['browser context', () => context?.close()],
    ['browser', () => browser?.close()],
  ]) {
    try { await close(); }
    catch (error) { cleanupErrors.push(`${label}: ${String(error)}`); }
  }
  if (cleanupErrors.length) {
    const message = `Browser resource cleanup failed: ${cleanupErrors.join('; ')}`;
    if (journeyFailure instanceof Error) journeyFailure.message += `\n${message}`;
    else throw new Error(message);
  }
}
}
