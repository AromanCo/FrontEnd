#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:3201';
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
await page.route('https://catalog.example.test/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await desktopPage.route('https://catalog.example.test/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
page.on('request', recordApiRequest);
desktopPage.on('request', recordApiRequest);
async function expectAdvisorControlsVisible(targetPage) {
  const advisor = targetPage.locator('#smart-perfumer');
  await advisor.waitFor({ state: 'visible' });
  assert.equal(await advisor.locator('details').evaluate(details => details.open), true, 'Smart Perfumer details should be expanded');
  const requestButton = advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' });
  assert.ok(await requestButton.isVisible(), 'Smart Perfumer request control should be visible');
  assert.ok(await requestButton.isEnabled(), 'Smart Perfumer request control should be enabled');
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
  const desktop = desktopPage.getByRole('navigation', { name: 'ناوبری اصلی' });
  for (const href of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    assert.ok(await desktop.locator(`a[href="${href}"]`).first().isVisible(), `desktop navigation should expose ${href}`);
  }
  await desktop.getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(desktopPage);
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  const mobile = page.getByRole('navigation', { name: 'ناوبری موبایل' });
  for (const path of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    const link = mobile.locator(`a[href="${path}"]`).first();
    assert.ok(await link.isVisible(), `mobile navigation should visibly expose ${path}`);
  }
  await mobile.getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(page);
  await page.goto(new URL('/studio/creative?from=guided', origin).href);
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  await page.getByRole('navigation', { name: 'ناوبری موبایل' }).getByRole('link', { name: 'اسمارت پرفیومر' }).click();
  await expectAdvisorControlsVisible(page);
  assert.equal(new URL(page.url()).searchParams.get('from'), 'guided', 'in-place Smart Perfumer navigation should preserve Guided transfer route context');
  const permittedCatalogRoute = /^\/api\/v1\/(?:brands|fragrance-families|products|fragrance-notes|products\/[0-9a-f-]{36}\/variants)$/i;
  assert.ok(browserApiRequests.every(({ method, origin: requestOrigin, path }) => method === 'GET' && requestOrigin === 'https://catalog.example.test' && permittedCatalogRoute.test(path)), `unexpected browser API requests: ${JSON.stringify(browserApiRequests)}`);
  assert.deepEqual(errors, []);
  console.log(`PASS public showcase browser journey: all public routes and desktop/mobile links available; Smart Perfumer controls opened from another page and in-place; ${browserApiRequests.length} browser API requests across both contexts were permitted catalog GETs only; no browser errors.`);
} finally {
  await context.close();
  await desktopPage.close();
  await browser.close();
}
