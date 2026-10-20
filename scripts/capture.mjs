import { mkdir } from 'node:fs/promises';
import { apiBase, assertNoBrowserErrors, checkLayout, frontendOrigin, openBrowser, openLoadedStudio, watchPage } from './browser-utils.mjs';

const catalogResponse = await fetch(`${apiBase}/products?limit=1`);
if (!catalogResponse.ok) throw new Error(`Seeded catalog is unavailable: HTTP ${catalogResponse.status}`);
const [firstProduct] = await catalogResponse.json();
if (!firstProduct?.name) throw new Error('The backend catalog has no seeded products');

const browser = await openBrowser();
const widths = [320, 390, 768, 1440];
await mkdir('artifacts/screenshots', { recursive: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const report = watchPage(page, (status, url) => status === 401 && url.endsWith('/api/v1/auth/session'));
    const shot = async (name) => {
      await page.evaluate(() => document.fonts.ready);
      await checkLayout(page, `${name} ${width}px`);
      assertNoBrowserErrors(report, `${name} ${width}px`);
      await page.screenshot({ path: `artifacts/screenshots/${name}-${width}.png`, fullPage: true });
      console.log(`${name} ${width}px: verified and captured`);
    };
    try {
      for (const [route, name] of [['/', 'home'], ['/shop', 'shop']]) {
        await page.goto(`${frontendOrigin}${route}`, { waitUntil: 'domcontentloaded' });
        await page.getByText(firstProduct.name, { exact: true }).first().waitFor({ timeout: 10000 });
        await shot(name);
      }
      const notes = await openLoadedStudio(page);
      if (!['اسطوخودوس', 'باران', 'بخور'].every(name => notes.some(note => note.name === name))) {
        throw new Error('Expected demonstration notes are absent from the API');
      }
      await shot('studio');
      const mobile = width <= 900;
      const tab = async name => { if (mobile) await page.getByRole('tab', { name }).click(); };
      const select = async note => {
        await tab('نت‌ها');
        await page.locator(`[data-note-id="${note.id}"]`).click();
      };
      await select(notes[0]);
      await page.getByText('1 از ۶ نت انتخاب شده').waitFor();
      await shot('studio-selected');
      await select(notes[1]);
      await select(notes[2]);
      await tab('ترکیب');
      await page.locator(`[data-selected-note-id="${notes[0].id}"] select`).selectOption('top');
      await page.locator(`[data-selected-note-id="${notes[2].id}"] select`).selectOption('base');
      for (const [note, layer] of [[notes[0], 'top'], [notes[1], 'heart'], [notes[2], 'base']]) {
        const value = await page.locator(`[data-selected-note-id="${note.id}"] select`).inputValue();
        if (value !== layer) throw new Error(`Layer assignment failed for ${note.name}`);
      }
      await shot('studio-layers');
      for (const note of notes.slice(3, 6)) await select(note);
      await tab('ترکیب');
      await page.getByText('6 از ۶ نت انتخاب شده').waitFor();
      await shot('studio-six');
      await page.locator('#studio-panel-1 input').fill('باغ آزمون');
      await tab('نتیجه');
      await page.locator('#studio-panel-2').getByRole('heading', { name: 'باغ آزمون' }).waitFor();
      await shot('studio-result');
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
