import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { assertNoBrowserErrors, checkLayout, frontendOrigin, openBrowser, openLoadedStudio, watchPage } from './browser-utils.mjs';

const widths = [320, 390, 768, 1440];
const output = 'artifacts/visual-alignment';
await mkdir(output, { recursive: true });
const browser = await openBrowser();

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, hasTouch: width <= 768 });
    const report = watchPage(page, (status, url) => status === 401 && url.endsWith('/api/v1/auth/session'));
    const suffix = `${width}`;
    const mobile = width <= 900;
    const save = async name => {
      await page.evaluate(() => document.fonts.ready);
      await checkLayout(page, `${name} ${width}px`);
      assertNoBrowserErrors(report, `${name} ${width}px`);
      await page.screenshot({ path: `${output}/${name}-${suffix}.png`, fullPage: true });
      console.log(`Captured verified ${name} at ${width}px`);
    };
    const tab = async name => { if (mobile) await page.getByRole('tab', { name }).click(); };

    try {
      await page.goto(frontendOrigin, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'کشف عطرها' }).waitFor();
      await page.getByRole('link', { name: 'ساخت رایحه شخصی' }).waitFor();
      await save('homepage');

      const notes = await openLoadedStudio(page);
      assert.equal(notes.length, 24, 'visual capture requires the real 24-note seeded API response');
      assert.deepEqual(notes.slice(0, 3).map(note => note.name), ['اسطوخودوس', 'باران', 'بخور']);
      await save('studio-notes');

      const select = async note => {
        await tab('نت‌ها');
        await page.locator(`[data-note-id="${note.id}"]`).click();
      };
      await select(notes[0]);
      await page.getByRole('status', { name: '1 از ۶ نت انتخاب شده' }).waitFor();
      await save('studio-selected');

      await select(notes[1]);
      await select(notes[2]);
      await tab('ترکیب');
      await page.locator(`[data-selected-note-id="${notes[0].id}"] select`).selectOption('top');
      await page.locator(`[data-selected-note-id="${notes[1].id}"] select`).selectOption('heart');
      await page.locator(`[data-selected-note-id="${notes[2].id}"] select`).selectOption('base');
      for (const [note, layer] of [[notes[0], 'top'], [notes[1], 'heart'], [notes[2], 'base']]) {
        assert.equal(await page.locator(`[data-selected-note-id="${note.id}"] select`).inputValue(), layer);
      }
      await save('studio-layers');

      for (const note of notes.slice(3, 6)) await select(note);
      await tab('ترکیب');
      await page.getByRole('status', { name: '6 از ۶ نت انتخاب شده' }).waitFor();
      await save('studio-six');

      await page.locator('#studio-panel-1 input').fill('باغ آزمون');
      await tab('نتیجه');
      await page.locator('#studio-panel-2').getByRole('heading', { name: 'باغ آزمون' }).waitFor();
      await save('studio-result');
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
