import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { assertNoBrowserErrors, checkLayout, openBrowser, openLoadedStudio, watchPage } from './browser-utils.mjs';

const widths = [320, 390, 768, 1440];
const browser = await openBrowser();
const screenshotDir = process.env.QA_RESPONSIVE_SCREENSHOT_DIR || 'artifacts/guided-studio/m1c2c/responsive';
await mkdir(screenshotDir, { recursive: true });

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, hasTouch: width <= 768 });
    const report = watchPage(page, (status, url) => status === 401 && url.endsWith('/api/v1/auth/session'));
    try {
      const notes = await openLoadedStudio(page);
      assert.equal(notes.length, 24);
      assert.equal(await page.locator('[data-note-id]').count(), 24);
      await checkLayout(page, `Studio ${width}px`);

      const grid = page.locator('.faceted-note-grid');
      const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
      const expectedColumns = width >= 641 && width <= 900 ? 3 : 2;
      assert.equal(columns, expectedColumns, `${width}px grid should have ${expectedColumns} columns`);

      const firstCard = page.locator(`[data-note-id="${notes[0].id}"]`);
      const card = await firstCard.boundingBox();
      const nameSize = await firstCard.locator('.faceted-note-name').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      assert.ok(card && card.width >= 125 && card.height >= 100, `${width}px note card is too small: ${JSON.stringify(card)}`);
      assert.ok(nameSize >= 12, `${width}px Persian note name is too small: ${nameSize}px`);
      assert.ok(card.height >= 44, `${width}px note target is below 44px`);

      if (width <= 900) {
        const tabs = page.getByRole('tablist', { name: 'گام‌های استودیو' });
        assert.equal(await tabs.evaluate(element => getComputedStyle(element).position), 'relative');
        assert.equal(await tabs.getByRole('tab', { name: /نت‌ها/ }).isVisible(), true);
        if (width <= 768) await page.screenshot({ path: `${screenshotDir}/studio-notes-${width}.png`, fullPage: true });

        await firstCard.click();
        await page.getByRole('status', { name: '1 از ۶ نت انتخاب شده' }).waitFor();
        const noteCount = tabs.getByRole('tab', { name: /نت‌ها/ }).locator('.studio-tab-count');
        assert.match(await noteCount.textContent(), /۱\/۶/);

        const lastNote = page.locator(`[data-note-id="${notes.at(-1).id}"]`);
        await lastNote.scrollIntoViewIfNeeded();
        assert.equal(await lastNote.isVisible(), true, `${width}px final note must remain reachable`);
        const continueButton = page.getByRole('button', { name: /رفتن به ترکیب/ });
        assert.equal(await continueButton.isVisible(), true, `In-flow composition action is missing at ${width}px`);
        const [lastRect, continueRect] = await Promise.all([lastNote.boundingBox(), continueButton.boundingBox()]);
        assert.ok(lastRect && continueRect && continueRect.y >= lastRect.y + lastRect.height, `Composition action must follow the final note in flow at ${width}px`);
        await continueButton.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${screenshotDir}/studio-continue-${width}.png` });
        await continueButton.click();
        assert.equal(await page.locator('#studio-panel-1').getAttribute('data-active'), 'true');
        await tabs.getByRole('tab', { name: /نت‌ها/ }).focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await tabs.getByRole('tab', { name: /ترکیب/ }).getAttribute('aria-selected'), 'true');
      } else {
        await assertNoBrowserErrors(report, `Studio ${width}px`);
      }
      assertNoBrowserErrors(report, `Studio ${width}px`);
      console.log(`${width}px: ${columns} columns, ${nameSize}px note labels, real 24-note API, no overflow${width <= 900 ? ', in-flow continue action and keyboard path verified' : ''}`);
    } finally {
      await page.close();
    }
  }
  console.log('Responsive Studio browser journey PASS');
} finally {
  await browser.close();
}
