import { chromium, firefox, webkit } from 'playwright';

export const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
export const apiBase = process.env.AROMAN_BROWSER_API_BASE_URL || 'http://localhost:8000/api/v1';
export const browserEngine = process.env.BROWSER_ENGINE || 'chromium';

export function openBrowser() {
  if (browserEngine === 'chromium') {
    return chromium.launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--no-proxy-server'],
    });
  }
  if (browserEngine === 'firefox') return firefox.launch({ headless: true });
  if (browserEngine === 'webkit') return webkit.launch({ headless: true });
  throw new Error(`Unsupported BROWSER_ENGINE "${browserEngine}"; expected chromium, firefox, or webkit`);
}

export function watchPage(page, allowedHttp = () => false) {
  const errors = [];
  const apiResponses = [];
  page.on('pageerror', error => errors.push(`Page error: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`Console error: ${message.text()}`);
    }
  });
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/v1/')) apiResponses.push({ status, url });
    if (status >= 400 && !allowedHttp(status, url) && !(status === 404 && url.endsWith('/favicon.ico'))) {
      errors.push(`HTTP ${status}: ${url}`);
    }
  });
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText || 'unknown';
    if (request.url().includes('/api/v1/') || reason !== 'net::ERR_ABORTED') {
      errors.push(`Request failed (${reason}): ${request.url()}`);
    }
  });
  return { errors, apiResponses };
}

export function assertNoBrowserErrors(report, label) {
  if (report.errors.length) throw new Error(`${label}: ${report.errors.join('; ')}`);
  const statusCounts = report.apiResponses.reduce((counts, response) => {
    counts[response.status] = (counts[response.status] || 0) + 1;
    return counts;
  }, {});
  console.log(`${label}: ${report.apiResponses.length} API responses; HTTP status counts ${JSON.stringify(statusCounts)}`);
}

export async function checkLayout(page, label) {
  const layout = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (layout.dir !== 'rtl' || layout.scrollWidth > layout.viewport) {
    throw new Error(`${label}: invalid layout ${JSON.stringify(layout)}`);
  }
  return layout;
}

export async function openLoadedStudio(page, expectedCount = 24) {
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/v1/fragrance-notes?') && response.request().method() === 'GET',
    { timeout: 15000 },
  );
  await page.goto(`${frontendOrigin}/studio/creative`, { waitUntil: 'domcontentloaded' });
  const response = await responsePromise;
  if (response.status() !== 200) throw new Error(`Studio notes returned HTTP ${response.status()}: ${response.url()}`);
  const notes = await response.json();
  if (!Array.isArray(notes) || notes.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} seeded notes, got ${Array.isArray(notes) ? notes.length : 'a non-array response'}`);
  }
  try {
    await page.locator(`#studio-panel-0[data-note-status="ready"][data-note-count="${expectedCount}"]`).waitFor({ timeout: 10000 });
  } catch {
    const panel = await page.locator('#studio-panel-0').textContent();
    throw new Error(`Studio never rendered the loaded note library. Panel: ${panel?.slice(-300)}`);
  }
  await page.locator(`[data-note-id="${notes[notes.length - 1].id}"]`).waitFor({ state: 'attached' });
  if (await page.getByText('در حال دریافت نت‌ها…').count()) {
    throw new Error('Studio still displays the loading message after the note library rendered');
  }
  return notes;
}
