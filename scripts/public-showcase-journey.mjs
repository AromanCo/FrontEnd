#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:3201';
const apiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL || '/api/v1';
const catalogOrigin = new URL(apiBase, origin).origin;
const systemChrome = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(existsSync);
const browser = await chromium.launch({ ...(systemChrome ? { executablePath: systemChrome } : {}), headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const browserApiRequests = [];
const recordApiRequest = request => {
  const url = new URL(request.url());
  const isDataRequest = ['fetch', 'xhr'].includes(request.resourceType());
  const isWriteRequest = !['GET', 'HEAD'].includes(request.method());
  const isPotentialApiPath = url.pathname.startsWith('/api/') || /\/(?:auth|users|fragrance-concepts|orders)(?:\/|$)/.test(url.pathname);
  if (isWriteRequest || (isDataRequest && url.origin !== new URL(origin).origin) || isPotentialApiPath) {
    browserApiRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
  }
};
page.on('pageerror', error => errors.push(error.message));
desktopPage.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(`mobile console: ${message.text()} (${message.location().url})`); });
desktopPage.on('console', message => { if (message.type() === 'error') errors.push(`desktop console: ${message.text()} (${message.location().url})`); });
for (const [targetPage, label] of [[page, 'mobile'], [desktopPage, 'desktop']]) {
  targetPage.on('response', response => { if (response.status() >= 400) errors.push(`${label} HTTP ${response.status()} ${response.url()}`); });
}
if (/^https?:\/\//i.test(apiBase)) {
  await page.route(`${apiBase.replace(/\/api\/v1$/, '')}/**`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await desktopPage.route(`${apiBase.replace(/\/api\/v1$/, '')}/**`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}
page.on('request', recordApiRequest);
desktopPage.on('request', recordApiRequest);
async function expectAdvisorControlsVisible(targetPage) {
  const advisor = targetPage.locator('#smart-perfumer');
  await advisor.waitFor({ state: 'visible' });
  await targetPage.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === true);
  assert.equal(await advisor.locator('details').evaluate(details => details.open), true, 'Smart Perfumer details should be expanded');
  const requestButton = advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' });
  assert.ok(await requestButton.isVisible(), 'Smart Perfumer request control should be visible');
  assert.ok(await requestButton.isEnabled(), 'Smart Perfumer request control should be enabled');
  assert.equal(await advisor.locator('summary').evaluate(summary => summary === document.activeElement), true, 'Smart Perfumer summary should receive focus after navigation');
}
try {
  for (const [path, heading] of [
    ['/', 'رایحه‌ای که'], ['/shop', 'کشف محصولات'], ['/studio/guided', ''], ['/studio/creative', 'روایت رایحه'],
    ['/account', 'حساب کاربری'], ['/login', 'ورود به آرومان'], ['/cart', 'سبد خرید'], ['/checkout', 'تسویه‌حساب'],
  ]) {
    const response = await page.goto(new URL(path, origin).href, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `${path} should be public`);
    if (heading) await page.getByRole('heading', { name: new RegExp(heading) }).waitFor();
    if (['/account', '/login', '/cart', '/checkout'].includes(path)) await page.locator('main').getByText(/پیش‌نمایش/).first().waitFor();
  }
  await page.goto(new URL('/', origin).href);
  await desktopPage.goto(new URL('/', origin).href, { waitUntil: 'domcontentloaded' });
  await page.goto(new URL('/shop', origin).href);
  await page.getByRole('heading', { name: 'محصول ساختگی کاتالوگ عمومی' }).waitFor();
  const desktop = desktopPage.getByRole('navigation', { name: 'ناوبری اصلی' });
  for (const href of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    assert.ok(await desktop.locator(`a[href="${href}"]`).first().isVisible(), `desktop navigation should expose ${href}`);
  }
  await desktop.getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(desktopPage);
  const desktopSummary = desktopPage.locator('#smart-perfumer summary');
  await desktopSummary.click();
  await desktopPage.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === false);
  await desktopSummary.click();
  await desktopPage.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === true);
  await desktopPage.setViewportSize({ width: 390, height: 844 });
  await desktopPage.getByRole('tab', { name: /نت‌ها/ }).click();
  await desktopPage.getByRole('tab', { name: /ترکیب/ }).click();
  await desktopPage.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === true);
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  const mobile = page.getByRole('navigation', { name: 'ناوبری موبایل' });
  for (const path of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    const link = mobile.locator(`a[href="${path}"]`).first();
    assert.ok(await link.isVisible(), `mobile navigation should visibly expose ${path}`);
  }
  await mobile.getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(page);
  const mobileSummary = page.locator('#smart-perfumer summary');
  await mobileSummary.click();
  await page.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === false);
  await mobileSummary.click();
  await page.waitForFunction(() => document.querySelector('#smart-perfumer details')?.open === true);
  await page.goto(new URL('/studio/creative?from=guided', origin).href);
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  await page.getByRole('navigation', { name: 'ناوبری موبایل' }).getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(page);
  assert.equal(new URL(page.url()).searchParams.get('from'), 'guided', 'in-place Smart Perfumer navigation should preserve Guided transfer route context');
  const initialHashPage = await context.newPage();
  initialHashPage.on('pageerror', error => errors.push(error.message));
  initialHashPage.on('console', message => { if (message.type() === 'error') errors.push(`initial-hash console: ${message.text()} (${message.location().url})`); });
  initialHashPage.on('response', response => { if (response.status() >= 400) errors.push(`initial-hash HTTP ${response.status()} ${response.url()}`); });
  initialHashPage.on('request', recordApiRequest);
  await initialHashPage.goto(new URL('/studio/creative?from=guided#smart-perfumer', origin).href, { waitUntil: 'domcontentloaded' });
  await expectAdvisorControlsVisible(initialHashPage);
  assert.equal(new URL(initialHashPage.url()).searchParams.get('from'), 'guided', 'initial hash activation should preserve Guided transfer route context');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    assert.ok(dimensions.content <= dimensions.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
  }
  const permittedCatalogRoute = /^\/api\/v1\/(?:brands|fragrance-families|products|fragrance-notes|products\/[0-9a-f-]{36}\/variants)$/i;
  assert.ok(browserApiRequests.length > 0, 'public showcase journey must observe at least one catalog API request');
  assert.ok(browserApiRequests.every(({ method, origin: requestOrigin, path }) => method === 'GET' && requestOrigin === catalogOrigin && permittedCatalogRoute.test(path)), `unexpected browser API requests: ${JSON.stringify(browserApiRequests)}`);
  assert.deepEqual(errors, []);
  console.log(`PASS public showcase browser journey: all public routes and desktop/mobile links available; Smart Perfumer hash, initial-hash, repeated-toggle, rerender, and Guided-context checks passed; no horizontal overflow at 320, 390, 768, or 1440px; ${browserApiRequests.length} browser API requests across both contexts were permitted catalog GETs only at ${catalogOrigin}; no browser errors.`);
} finally {
  await context.close();
  await desktopPage.close();
  await browser.close();
}
