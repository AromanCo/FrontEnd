import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--no-proxy-server'],
});
const routes = [['/', 'home'], ['/shop', 'shop'], ['/studio/creative', 'studio']];
const widths = [320, 390, 768, 1440];
await mkdir('artifacts/screenshots', { recursive: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [route, name] of routes) {
      await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      if (name === 'studio') await page.getByRole('heading', { name: 'کتابخانه نت‌ها' }).waitFor();
      const layout = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      if (layout.dir !== 'rtl' || layout.scrollWidth > layout.viewport || errors.length) {
        throw new Error(`${name} ${width}px failed: ${JSON.stringify({ layout, errors })}`);
      }
      await page.screenshot({ path: `artifacts/screenshots/${name}-${width}.png`, fullPage: true });
      console.log(`${name} ${width}px: RTL, no overflow, no page errors`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
