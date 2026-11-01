import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const root = process.env.SMART_PERFUMER_SCREENSHOT_DIR || 'artifacts/smart-perfumer/v1';
const output = join(process.cwd(), root, `visual-polish-${stamp}`);
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
const conceptWrites = [];
let realNotes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.url().includes('/api/v1/fragrance-concepts') && request.method() !== 'GET') conceptWrites.push(request.method());
});

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const advisor = page.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
const requestButton = advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' });
const getLayer = note => page.getByLabel(`لایه ${note.name}`);

async function requestSuggestion() {
  const disclosure = advisor.locator('summary');
  if (!(await disclosure.evaluate(element => element.parentElement.open))) await disclosure.click();
  await requestButton.click();
  await page.getByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 }).waitFor();
  await advisor.getByRole('region', { name: 'ترکیب فعلی' }).waitFor();
  await advisor.getByRole('region', { name: 'پیشنهاد برای کاوش' }).waitFor();
  await advisor.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }).waitFor({ state: 'visible' });
  await advisor.getByRole('button', { name: 'ترکیب فعلی را نگه می‌دارم' }).waitFor({ state: 'visible' });
}

async function assertNoOverflow(width) {
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    panel: document.querySelector('#studio-panel-1')?.scrollWidth,
    direction: document.documentElement.dir,
  }));
  assert.equal(layout.direction, 'rtl');
  assert.ok(layout.document <= width, `No horizontal document overflow at ${width}px: ${JSON.stringify(layout)}`);
  assert.ok((layout.panel ?? 0) <= width, `Composition panel does not overflow at ${width}px: ${JSON.stringify(layout)}`);
  const clipped = await advisor.locator('.blend-advisor-preview, .blend-advisor-version, .blend-advisor-actions').evaluateAll(elements => elements.some(element => {
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > innerWidth + 1 || box.width <= 0;
  }));
  assert.equal(clipped, false, `Advisor content stays inside viewport at ${width}px`);
  const textClip = await advisor.locator('.blend-advisor-rationale, .blend-advisor-changes, .blend-advisor-layer dt, .blend-advisor-layer dd, .blend-advisor-button').evaluateAll(elements => elements.some(element => {
    const style = getComputedStyle(element);
    return ((style.overflowX === 'hidden' || style.overflowX === 'clip') && element.scrollWidth > element.clientWidth + 1)
      || ((style.overflowY === 'hidden' || style.overflowY === 'clip') && element.scrollHeight > element.clientHeight + 1);
  }));
  assert.equal(textClip, false, `Advisor text and controls are not clipped at ${width}px`);
  const actionOverlap = await advisor.locator('.blend-advisor-actions > button').evaluateAll(elements => {
    if (elements.length < 2) return false;
    const [first, second] = elements.map(element => element.getBoundingClientRect());
    return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
  });
  assert.equal(actionOverlap, false, `Advisor actions do not overlap at ${width}px`);
}

try {
  await mkdir(output, { recursive: true });
  const notesResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?') && response.request().method() === 'GET');
  await page.goto(`${origin}/studio/creative`, { waitUntil: 'domcontentloaded' });
  const response = await notesResponse;
  assert.equal(response.status(), 200, 'Creative Studio must load notes from the real public catalog');
  realNotes = await response.json();
  assert.ok(Array.isArray(realNotes) && realNotes.length >= 2, 'Real catalog response must contain notes for the journey');
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const note = realNotes[0];
  const secondNote = realNotes.at(-1);

  await page.setViewportSize({ width: 320, height: 800 });
  const menuButton = page.getByRole('button', { name: 'باز کردن فهرست' });
  await menuButton.waitFor({ state: 'visible' });
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('navigation', { name: 'ناوبری موبایل' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'بستن فهرست' }).click();
  await page.getByRole('button', { name: new RegExp(escapeRegExp(note.name)) }).click();
  const continueButton = page.getByRole('button', { name: /رفتن به ترکیب، .* از ۶ نت انتخاب شده/ });
  await continueButton.waitFor({ state: 'visible' });
  const continueBox = await continueButton.boundingBox();
  const firstCardBox = await page.locator(`#studio-panel-0 [data-note-id="${note.id}"]`).boundingBox();
  assert.ok(continueBox && firstCardBox && continueBox.y < firstCardBox.y, 'Composition action appears before the long note list after the first selection');
  await page.locator('#studio-panel-0').getByRole('button', { name: /نمایش .* نت دیگر/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'نمایش نت‌های کمتر' }).waitFor();
  const lastNote = page.locator(`[data-note-id="${secondNote.id}"]`);
  assert.equal(await lastNote.isVisible(), true, 'A note beyond the initial mobile disclosure remains discoverable');
  await lastNote.click();
  await page.getByRole('tab', { name: 'ترکیب' }).click();
  await page.locator('#studio-panel-1[data-active="true"]').waitFor();
  const selectedSummary = page.locator(`#studio-panel-1 [data-selected-note-id="${secondNote.id}"]`);
  await selectedSummary.getByRole('button', { name: 'حذف' }).click();
  await selectedSummary.waitFor({ state: 'detached' });
  assert.equal(await page.locator(`#studio-panel-1 [data-selected-note-id="${note.id}"]`).count(), 1, 'Selected notes outside the initial list can be removed from their summary');
  await page.getByRole('tab', { name: 'نت‌ها' }).click();
  await page.locator('#studio-panel-0[data-active="true"]').waitFor();
  await page.locator('#studio-panel-0').getByRole('button', { name: 'نمایش نت‌های کمتر' }).click();
  assert.equal(await page.locator('#studio-panel-0 .faceted-note-frame:visible').count(), 10, 'Mobile disclosure initially exposes ten notes');
  assert.equal(await page.locator('#studio-panel-0 .faceted-note-frame').count(), realNotes.length, 'All API-loaded notes remain in the catalog DOM');
  await page.screenshot({ path: join(output, 'note-library-320.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('tab', { name: 'ترکیب' }).click();
  console.log('320px header menu keyboard access and expanded-note selection/removal passed with real catalog records.');

  const originalLayer = await getLayer(note).inputValue();
  const writesBeforeAdvisor = [...conceptWrites];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width <= 900) {
      if (width === 390) {
        await page.getByRole('tab', { name: 'نت‌ها' }).click();
        await page.locator('#studio-panel-0[data-active="true"]').waitFor();
        assert.equal(await page.locator('#studio-panel-0 .faceted-note-frame:visible').count(), 10, 'Mobile Note Library remains compact at 390px');
        await page.screenshot({ path: join(output, 'note-library-390.png'), fullPage: true, animations: 'disabled' });
      }
      const compositionTab = page.getByRole('tab', { name: 'ترکیب' });
      await compositionTab.click();
      await page.locator('#studio-panel-1[data-active="true"]').waitFor();
    } else {
      const panels = await page.locator('.studio-grid > .studio-panel').count();
      assert.equal(panels, 3, 'Desktop Studio retains its three coordinated panels');
    }
    await assertNoOverflow(width);

    const currentLayer = await getLayer(note).inputValue();
    assert.equal(currentLayer, originalLayer, `Original arrangement is stable before request at ${width}px`);
    await requestSuggestion();
    assert.equal(await getLayer(note).inputValue(), originalLayer, `Requesting guidance does not mutate the active composition at ${width}px`);
    await assertNoOverflow(width);
    await page.screenshot({ path: join(output, `advisor-preview-${width}.png`), fullPage: true, animations: 'disabled' });

    await advisor.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }).click();
    await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی' }).waitFor();
    await assertNoOverflow(width);
    await page.screenshot({ path: join(output, `advisor-applied-${width}.png`), fullPage: true, animations: 'disabled' });
    await advisor.getByRole('button', { name: 'بازگشت به ترکیب قبلی' }).click();
    assert.equal(await getLayer(note).inputValue(), originalLayer, `Undo restores original arrangement at ${width}px`);
    assert.deepEqual(conceptWrites, writesBeforeAdvisor, `Advisor preview/apply/undo performs no concept write at ${width}px`);
    console.log(`PASS: ${width}px advisor preview, applied/Undo state, RTL and overflow checks.`);
  }
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`PASS: real FastAPI catalog supplied ${realNotes.length} notes; selected ${note.name} (${note.id}); no concept writes; mobile composition tab explicitly visible before capture.`);
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
