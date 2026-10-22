import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const screenshotDir = join(process.cwd(), process.env.QA_SCREENSHOT_DIR || 'artifacts/guided-studio/m1c2c');
const browserPath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const responses = [];
const mobileNotesOnly = process.env.GUIDED_SCREENSHOTS_MOBILE_NOTES_ONLY === '1';
let apiFamilies = null;
let apiNotes = null;
page.on('pageerror', error => errors.push(`Page error: ${error.message}`));
page.on('console', message => {
  // Chromium emits a generic resource message for HTTP failures; the response
  // listener below records the URL and status with enough context to diagnose it.
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`Console error: ${message.text()}`);
});
page.on('response', response => {
  const url = response.url();
  if (new URL(url).pathname.endsWith('/favicon.ico')) return;
  if (!url.includes('/api/v1/')) return;
  responses.push({ status: response.status(), url });
  if (response.status() >= 400 && !(response.status() === 401 && url.endsWith('/auth/session'))) errors.push(`HTTP ${response.status()}: ${url}`);
});

const screenshot = async name => {
  if (mobileNotesOnly && !['step-05-note-affinity-selected-320', 'step-05-note-affinity-selected-390'].includes(name)) return;
  await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true, animations: 'disabled' });
};
const checkLayout = async width => {
  const state = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, dir: document.documentElement.dir }));
  assert.equal(state.width, width);
  assert.equal(state.dir, 'rtl');
  assert.ok(state.scrollWidth <= width, `Horizontal overflow at ${width}px: ${JSON.stringify(state)}`);
};
const choose = async (role, name) => {
  const control = page.getByRole(role, { name });
  if (await control.isChecked()) return;
  await control.locator('xpath=..').click();
  const handle = await control.elementHandle();
  await page.waitForFunction(element => element.checked, handle);
};
const next = async () => page.getByRole('button', { name: /ادامه|دیدن پیشنهاد من/ }).click();

try {
  await mkdir(screenshotDir, { recursive: true });
  const familiesResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-families?'));
  const notesResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?'));
  await page.goto(`${origin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  const [familyResponse, noteResponse] = await Promise.all([familiesResponse, notesResponse]);
  apiFamilies = await familyResponse.json();
  apiNotes = await noteResponse.json();
  if (familyResponse.status() !== 200 || noteResponse.status() !== 200) {
    throw new Error(`Catalog API unavailable (families ${familyResponse.status()}, notes ${noteResponse.status()}); no demo fallback is used.`);
  }
  if (!Array.isArray(apiFamilies) || !apiFamilies.length || !Array.isArray(apiNotes) || !apiNotes.length) {
    throw new Error('FastAPI returned an empty or invalid family/note catalog; screenshots were not captured as loaded states.');
  }
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  await page.locator('input[name="feeling"]').first().waitFor();
  await screenshot('step-01-feeling-1440');

  await choose('radio', /آرام و آسوده/); await next();
  await page.getByRole('heading', { name: 'جهان‌های رایحه' }).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(width);
    await screenshot(`step-02-families-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const chosenFamily = apiFamilies[0];
  await page.locator(`input[name="familyIds"][value="${chosenFamily.id}"]`).check({ force: true });
  await next();
  await page.getByRole('heading', { name: 'دمای حسی' }).waitFor(); await screenshot('step-03-temperature-1440');
  await choose('radio', /نرم و متعادل/); await next();
  await page.getByRole('heading', { name: 'یک تصویر برای خیال' }).waitFor(); await screenshot('step-04-scene-1440');
  await choose('radio', /باغ پس از باران/); await next();
  await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }).waitFor();
  assert.equal(await page.locator('.guided-note-item').count(), apiNotes.length);
  const search = page.getByRole('searchbox');
  await search.fill(apiNotes[0].name);
  assert.equal(await page.locator('.guided-note-item').count(), 1, 'Note search did not filter the real catalog');
  await search.fill('');
  const firstFamilyId = apiFamilies[0].id;
  const familyFilter = page.locator('select').filter({ has: page.locator(`option[value="${firstFamilyId}"]`) });
  await familyFilter.selectOption(firstFamilyId);
  assert.equal(await page.locator('.guided-note-item').count(), apiNotes.filter(note => note.family_id === firstFamilyId).length, 'Family filter did not match API catalog');
  await familyFilter.selectOption('');
  const firstNoteRow = page.locator('.guided-note-item').first();
  await firstNoteRow.getByRole('button', { name: 'دوست دارم' }).click();
  assert.equal(await firstNoteRow.getByRole('button', { name: 'دوست دارم' }).getAttribute('aria-pressed'), 'true');
  const initiallyHiddenNoteName = await page.locator('.guided-note-item').nth(10).locator('strong').textContent();
  await search.fill(initiallyHiddenNoteName);
  const hiddenSelectedRow = page.locator('.guided-note-item').filter({ hasText: initiallyHiddenNoteName });
  await hiddenSelectedRow.getByRole('button', { name: 'دوست دارم' }).click();
  await search.fill('');
  const hiddenNoteRemoval = page.getByRole('button', { name: `حذف ${initiallyHiddenNoteName} از دوست دارم` });
  assert.equal(await hiddenNoteRemoval.count(), 1, 'A selected note beyond the initial ten must remain identifiable in the selected summary');
  await screenshot('step-05-note-affinity-selected-1440');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await checkLayout(width);
    const firstAction = await firstNoteRow.getByRole('button', { name: 'دوست دارم' }).boundingBox();
    assert.ok(firstAction && firstAction.height >= 44, `Note action is below 44px at ${width}px: ${JSON.stringify(firstAction)}`);
    const removeBox = await hiddenNoteRemoval.boundingBox();
    assert.ok(removeBox && removeBox.width >= 44 && removeBox.height >= 44, `Selected-note removal target is below 44×44px at ${width}px: ${JSON.stringify(removeBox)}`);
    if (width <= 390) {
      assert.equal(await page.locator('.guided-note-item:visible').count(), 10, `Expected 10 collapsed notes at ${width}px`);
      const moreButton = page.getByRole('button', { name: 'نمایش نت‌های بیشتر' });
      assert.ok(await moreButton.isVisible(), `Load-more control is unavailable at ${width}px`);
      await moreButton.focus();
      await moreButton.press('Enter');
      assert.equal(await page.locator('.guided-note-item:visible').count(), apiNotes.length, `Load-more did not reveal all notes at ${width}px`);
      await familyFilter.selectOption(firstFamilyId);
      assert.equal(await page.locator('.guided-note-item:visible').count(), apiNotes.filter(note => note.family_id === firstFamilyId).length, 'Family filtering must still use all loaded API notes');
      await familyFilter.selectOption('');
      assert.equal(await page.locator('.guided-note-item:visible').count(), 10, 'Changing filters should reset the mobile list to its initial size');
    }
    const finalNote = page.locator('.guided-note-item').last();
    if (width <= 390) {
      const overflowY = await page.locator('.guided-note-list').evaluate(element => getComputedStyle(element).overflowY);
      assert.equal(overflowY, 'visible', `Mobile note list must not be a nested scroller at ${width}px`);
      const finalMore = page.getByRole('button', { name: 'نمایش نت‌های بیشتر' });
      await finalMore.focus();
      await finalMore.press('Space');
      assert.equal(await page.locator('.guided-note-item:visible').count(), apiNotes.length, `Final catalog notes did not become reachable at ${width}px`);
    }
    await finalNote.scrollIntoViewIfNeeded();
    assert.equal(await finalNote.isVisible(), true, `Final note is inaccessible at ${width}px`);
    if (width <= 390) await page.getByRole('button', { name: 'نمایش نت‌های کمتر' }).click();
    const dimensions = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, listHeight: document.querySelector('.guided-note-list')?.getBoundingClientRect().height }));
    console.log(`${width}px Step 5: like ${firstAction.height.toFixed(0)}×${firstAction.width.toFixed(0)}px; remove ${removeBox.height.toFixed(0)}×${removeBox.width.toFixed(0)}px; page ${dimensions.scrollHeight}px; list ${dimensions.listHeight?.toFixed(0)}px; notes ${await page.locator('.guided-note-item:visible').count()}/${apiNotes.length} visible`);
    await screenshot(`step-05-note-affinity-selected-${width}`);
  }
  const initiallyHiddenAvoidedName = await page.locator('.guided-note-item').nth(11).locator('strong').textContent();
  if (initiallyHiddenAvoidedName) {
    await search.fill(initiallyHiddenAvoidedName);
    const hiddenAvoidedRow = page.locator('.guided-note-item').filter({ hasText: initiallyHiddenAvoidedName });
    await hiddenAvoidedRow.getByRole('button', { name: 'کنار بگذار' }).click();
    await search.fill('');
    const hiddenAvoidedRemoval = page.getByRole('button', { name: `حذف ${initiallyHiddenAvoidedName} از فهرست کنارگذاشته‌ها` });
    assert.equal(await hiddenAvoidedRemoval.count(), 1, 'A selected avoided note beyond the initial ten must remain identifiable in the summary');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      const box = await hiddenAvoidedRemoval.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, `Avoided-note removal target is below 44×44px at ${width}px: ${JSON.stringify(box)}`);
    }
    await page.setViewportSize({ width: 768, height: 850 });
    const likedRemove = page.getByRole('button', { name: `حذف ${initiallyHiddenNoteName} از دوست دارم` });
    await likedRemove.scrollIntoViewIfNeeded();
    const likedBox = await likedRemove.boundingBox();
    const avoidedBox = await hiddenAvoidedRemoval.boundingBox();
    assert.ok(likedBox && avoidedBox);
    const overlap = likedBox.x < avoidedBox.x + avoidedBox.width && likedBox.x + likedBox.width > avoidedBox.x && likedBox.y < avoidedBox.y + avoidedBox.height && likedBox.y + likedBox.height > avoidedBox.y;
    assert.equal(overlap, false, 'Adjacent selected-note removal targets overlap at 768px');
    const likedClientRect = await likedRemove.evaluate(element => { const { x, y, height } = element.getBoundingClientRect(); return { x, y, height }; });
    await page.mouse.click(likedClientRect.x + 2, likedClientRect.y + likedClientRect.height / 2);
    assert.equal(await page.getByRole('button', { name: `حذف ${initiallyHiddenNoteName} از دوست دارم` }).count(), 0, 'Pointer activation at the target edge did not remove the intended liked note');
    assert.equal(await hiddenAvoidedRemoval.count(), 1, 'Edge activation also changed the neighboring avoided note');
    const lastNoteAction = page.locator('.guided-note-item').last().getByRole('button', { name: 'کنار بگذار' });
    const firstLikedName = await firstNoteRow.locator('strong').textContent();
    const firstLikedRemoval = page.getByRole('button', { name: `حذف ${firstLikedName} از دوست دارم` });
    await lastNoteAction.focus();
    await page.keyboard.press('Tab');
    assert.equal(await firstLikedRemoval.evaluate(element => element === document.activeElement), true, 'Tab did not reach the selected-note remove button after the catalog controls');
    assert.equal(await firstLikedRemoval.evaluate(element => getComputedStyle(element).outlineWidth), '3px', 'Keyboard focus outline is not visible on the removal target');
    await firstLikedRemoval.press('Enter');
    assert.equal(await firstLikedRemoval.count(), 0, 'Enter did not remove the selected liked note');
    await hiddenAvoidedRemoval.focus();
    await hiddenAvoidedRemoval.press('Space');
    assert.equal(await hiddenAvoidedRemoval.count(), 0, 'Space did not remove the selected avoided note');
    assert.equal((await page.locator('.guided-affinity-counts').textContent()).includes('۰ از ۳'), true, 'Removing liked/avoided notes did not update selection counts');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await firstNoteRow.getByRole('button', { name: 'کنار بگذار' }).click();
  assert.equal(await firstNoteRow.getByRole('button', { name: 'کنار بگذار' }).getAttribute('aria-pressed'), 'true');
  assert.equal((await page.locator('.guided-affinity-counts').textContent()).includes('۱ از ۳'), true);
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click();
  assert.equal(await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).getAttribute('aria-pressed'), 'true');
  assert.equal((await page.locator('.guided-affinity-counts').textContent()).includes('۰ از ۳'), true);
  await next();
  await page.getByRole('heading', { name: 'بازبینی و میزان کشف' }).waitFor(); await screenshot('step-06-review-1440');
  await choose('radio', /کمی آشنا، کمی تازه/); await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const resultItems = page.locator('.guided-result-layer li');
  const actualSelectionNames = await resultItems.locator('strong').allTextContents();
  const actualSelectionIds = await resultItems.evaluateAll(items => items.map(item => item.getAttribute('data-note-id')));
  assert.ok(actualSelectionNames.length > 0 && actualSelectionNames.length <= 4, `Unexpected recommendation count: ${actualSelectionNames.length}`);
  assert.ok(actualSelectionNames.every(name => apiNotes.some(note => note.name === name)), 'Result contains a note absent from FastAPI response');
  assert.ok(actualSelectionIds.every(id => apiNotes.some(note => note.id === id)), 'Result contains a note UUID absent from FastAPI response');
  await screenshot('result-ready-1440');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(width);
    await screenshot(`result-ready-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم' }).click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
  await loginDialog.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Anonymous Save must keep the result mounted');
  assert.equal(responses.some(item => item.url.includes('/fragrance-concepts')), false, 'Anonymous Save must not POST before login');
  await screenshot('result-save-login-1440');
  await loginDialog.getByRole('button', { name: 'بستن' }).click();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Closing login must preserve the result');
  const restartOpener = page.getByRole('button', { name: 'شروع دوباره' });
  await restartOpener.focus();
  await restartOpener.click();
  const restartDialog = page.getByRole('alertdialog');
  const cancelRestart = restartDialog.getByRole('button', { name: 'ادامهٔ مسیر' });
  const confirmRestart = restartDialog.getByRole('button', { name: 'پاک‌کردن و شروع دوباره' });
  assert.equal(await cancelRestart.evaluate(element => element === document.activeElement), true, 'Focus did not enter restart dialog');
  assert.equal(await page.locator('.guided-content').getAttribute('inert'), '', 'Background is not inert while restart dialog is open');
  await cancelRestart.press('Tab');
  assert.equal(await confirmRestart.evaluate(element => element === document.activeElement), true, 'Tab escaped the restart dialog');
  await confirmRestart.press('Tab');
  assert.equal(await cancelRestart.evaluate(element => element === document.activeElement), true, 'Tab did not wrap within the restart dialog');
  await cancelRestart.press('Escape');
  assert.equal(await restartOpener.evaluate(element => element === document.activeElement), true, 'Dialog cancellation did not restore focus to its opener');
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Cancel should preserve the current result');
  await page.getByRole('button', { name: 'مرور پاسخ‌ها' }).click();
  assert.equal(await page.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }).isChecked(), true, 'Cancel changed the saved in-memory questionnaire answers');
  await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  await page.getByRole('button', { name: 'شروع دوباره' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'پاک‌کردن و شروع دوباره' }).click();
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'حال‌وهوای شما' }).evaluate(element => element === document.activeElement), true, 'Confirmed restart did not focus Step 1');
  console.log(`Loaded ${apiFamilies.length} real families and ${apiNotes.length} real notes; result uses API note names. Review/edit/restart passed.`);

  await choose('radio', /آرام و آسوده/); await next();
  await page.locator(`input[name="familyIds"][value="${chosenFamily.id}"]`).check({ force: true }); await next();
  await choose('radio', /نرم و متعادل/); await next();
  await choose('radio', /گوشه‌ای پر از گل/); await next();
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click(); await next();
  await choose('radio', /کمی آشنا، کمی تازه/); await next();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();
  const expectedTransfer = await page.locator('.guided-result-layer li').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-note-id'),
    layer: item.closest('.guided-result-layer')?.getAttribute('data-layer'),
  })));
  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق' }).click();
  await page.waitForURL('**/studio/creative?from=guided');
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  await page.locator('.composition-note').first().waitFor();
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const actualTransfer = await page.locator('.composition-note').evaluateAll(items => items.map(item => ({
    id: item.getAttribute('data-selected-note-id'),
    layer: item.querySelector('select')?.value,
  })));
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), 'رایحهٔ من');
  assert.deepEqual(actualTransfer, expectedTransfer, 'Creative Studio must receive the same real UUIDs and layers');
  assert.ok(actualTransfer.every(item => apiNotes.some(note => note.id === item.id)), 'Transferred notes must resolve from the actual API catalog');
  await screenshot('creative-imported-guided-1440');
  assert.equal(responses.some(item => item.url.includes('/fragrance-concepts')), false, 'Handoff must not save automatically');
  console.log('Anonymous Save opened login without POST; same-tab transfer imported API UUIDs, concept name and layers without saving');

  // The handoff has been consumed; return to a fresh Guided visit for the no-match check below.
  await page.goto(`${origin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();

  const smallFamily = apiFamilies.find(family => apiNotes.filter(note => note.family_id === family.id).length > 0 && apiNotes.filter(note => note.family_id === family.id).length <= 3);
  if (smallFamily) {
    await choose('radio', /آرام و آسوده/); await next();
    await page.getByRole('heading', { name: 'جهان‌های رایحه' }).waitFor();
    await page.locator(`input[name="familyIds"][value="${smallFamily.id}"]`).check({ force: true }); await next();
    await page.getByRole('heading', { name: 'دمای حسی' }).waitFor(); await choose('radio', /نرم و متعادل/); await next();
    await page.getByRole('heading', { name: 'یک تصویر برای خیال' }).waitFor(); await choose('radio', /باغ پس از باران/); await next();
    await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }).waitFor();
    for (const note of apiNotes.filter(item => item.family_id === smallFamily.id)) {
      const row = page.locator('.guided-note-item').filter({ hasText: note.name });
      await row.getByRole('button', { name: 'کنار بگذار' }).click();
    }
    await next(); await page.getByRole('heading', { name: 'بازبینی و میزان کشف' }).waitFor();
    await choose('radio', /نزدیک به انتخاب‌هایم/); await next();
    await page.getByRole('heading', { name: 'این بار، انتخاب‌ها را کمی تغییر دهیم' }).waitFor();
    await screenshot('result-no-match-1440');
  } else {
    console.log('No family with <=3 notes exists in this catalog; no-match screenshot skipped without fabricating catalog data.');
  }
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.ok(responses.some(item => item.url.includes('/fragrance-families?') && item.status === 200));
  assert.ok(responses.some(item => item.url.includes('/fragrance-notes?') && item.status === 200));
  assert.ok(!responses.some(item => item.url.includes('/fragrance-concepts')), 'M1-C.2B must not call private concept endpoints');
  console.log('Guided Studio browser journey PASS');
} finally {
  await browser.close();
}
