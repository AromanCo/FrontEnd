import assert from 'node:assert/strict';
import { apiBase, assertNoBrowserErrors, checkLayout, openBrowser, openLoadedStudio, watchPage } from './browser-utils.mjs';

const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
let injectingNoteFailure = false;
const report = watchPage(page, (status, url) =>
  (status === 401 && (url.endsWith('/api/v1/auth/session') || url.includes('/api/v1/fragrance-concepts'))) ||
  (status === 503 && (url.endsWith('/api/v1/auth/challenges') || (injectingNoteFailure && url.includes('/api/v1/fragrance-notes?')))),
);
const notesPanel = page.locator('#studio-panel-0');
const selectedPanel = page.locator('#studio-panel-1');
const resultPanel = page.locator('#studio-panel-2');
const tab = name => page.getByRole('tab', { name });
const select = async note => {
  await tab('نت‌ها').click();
  await page.locator(`[data-note-id="${note.id}"]`).click();
};
const count = async value => page.getByRole('status', { name: `${value} از ۶ نت انتخاب شده` }).waitFor();
try {
  const notes = await openLoadedStudio(page);
  assert.equal(notes.length, 24);
  assert.deepEqual(notes.slice(0, 3).map(note => note.name), ['اسطوخودوس', 'باران', 'بخور']);
  assert.equal(await notesPanel.locator('[data-note-id]').count(), 24);
  await checkLayout(page, 'initial mobile Studio');
  const noteHeight = (await page.locator(`[data-note-id="${notes[0].id}"]`).boundingBox())?.height;
  assert.ok(noteHeight >= 48, `Note touch target is ${noteHeight}px`);
  console.log('Loaded 24 real seeded notes; mobile note targets are at least 48px');

  const initialBottle = await resultPanel.locator('.bottle').evaluate(element => element.style.getPropertyValue('--bottle-color'));
  await select(notes[0]);
  await count(1);
  injectingNoteFailure = true;
  await page.route('**/api/v1/fragrance-notes?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Injected network failure for retry test' }) }));
  await page.getByPlaceholder('جستجو میان نت‌ها…').fill(notes[0].name);
  await notesPanel.locator('[role="alert"]').getByRole('button', { name: 'تلاش دوباره' }).waitFor({ timeout: 10000 });
  await count(1);
  await page.unroute('**/api/v1/fragrance-notes?*');
  injectingNoteFailure = false;
  const retryResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?') && new URL(response.url()).searchParams.get('q') === notes[0].name);
  await notesPanel.locator('[role="alert"]').getByRole('button', { name: 'تلاش دوباره' }).click();
  assert.equal((await retryResponse).status(), 200);
  await page.locator('#studio-panel-0[data-note-status="ready"][data-note-count="1"]').waitFor({ timeout: 10000 });
  await count(1);
  const retryClearResponse = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?') && !new URL(response.url()).searchParams.has('q'));
  await page.getByPlaceholder('جستجو میان نت‌ها…').fill('');
  assert.equal((await retryClearResponse).status(), 200);
  await page.locator('#studio-panel-0[data-note-count="24"]').waitFor({ timeout: 10000 });
  console.log('Injected note request failure displayed an error; retry loaded real API data and preserved the selection');
  await tab('ترکیب').click();
  await selectedPanel.locator(`[data-selected-note-id="${notes[0].id}"] select`).selectOption('top');
  const moveTarget = await selectedPanel.getByRole('button', { name: `جابجایی ${notes[0].name} به پایین` }).boundingBox();
  assert.ok(moveTarget && moveTarget.width >= 44 && moveTarget.height >= 44, `Layer reorder touch target is ${JSON.stringify(moveTarget)}`);
  const topBottle = await resultPanel.locator('.bottle').evaluate(element => element.style.getPropertyValue('--bottle-color'));
  assert.notEqual(topBottle, initialBottle);
  await select(notes[1]);
  await select(notes[2]);
  await tab('ترکیب').click();
  await selectedPanel.locator(`[data-selected-note-id="${notes[2].id}"] select`).selectOption('base');
  for (const [note, layer] of [[notes[0], 'top'], [notes[1], 'heart'], [notes[2], 'base']]) {
    assert.equal(await selectedPanel.locator(`[data-selected-note-id="${note.id}"] select`).inputValue(), layer);
  }
  const baseBottle = await resultPanel.locator('.bottle').evaluate(element => element.style.getPropertyValue('--bottle-color'));
  assert.notEqual(baseBottle, topBottle);
  await selectedPanel.locator(`[data-selected-note-id="${notes[1].id}"]`).getByRole('button', { name: 'حذف' }).click();
  await count(2);
  await select(notes[3]);
  await count(3);
  for (const note of notes.slice(4, 7)) await select(note);
  await count(6);
  await page.locator(`[data-note-id="${notes[7].id}"]`).click();
  await page.getByRole('status').filter({ hasText: 'برای افزودن نت تازه، یکی را از ترکیب بردارید.' }).waitFor();
  await count(6);
  await tab('نت‌ها').click();
  console.log('Top/heart/base assignment, removal, replacement, six-note cap, and live bottle changes passed');

  const searchName = notes[0].name;
  const searchResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/fragrance-notes?') && new URL(response.url()).searchParams.get('q') === searchName,
  );
  await page.getByPlaceholder('جستجو میان نت‌ها…').fill(searchName);
  assert.equal((await searchResponse).status(), 200);
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor({ timeout: 10000 });
  assert.equal(await notesPanel.locator('[data-note-id]').count(), 1);
  const clearResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/fragrance-notes?') && !new URL(response.url()).searchParams.has('q') && !new URL(response.url()).searchParams.has('family_id'),
  );
  await page.getByPlaceholder('جستجو میان نت‌ها…').fill('');
  await clearResponse;
  await page.locator('#studio-panel-0[data-note-count="24"]').waitFor({ timeout: 10000 });
  const familyResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/fragrance-notes?') && new URL(response.url()).searchParams.get('family_id') === notes[0].family_id,
  );
  await page.getByRole('combobox', { name: 'خانواده رایحه' }).selectOption(notes[0].family_id);
  assert.equal((await familyResponse).status(), 200);
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor({ timeout: 10000 });
  assert.ok((await notesPanel.locator('[data-note-id]').count()) > 0);
  const resetResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/fragrance-notes?') && !new URL(response.url()).searchParams.has('family_id'),
  );
  await page.getByRole('combobox', { name: 'خانواده رایحه' }).selectOption('');
  await resetResponse;
  await page.locator('#studio-panel-0[data-note-count="24"]').waitFor({ timeout: 10000 });
  const showAllNotes = notesPanel.getByRole('button', { name: /نمایش .* نت دیگر/ });
  if (await showAllNotes.isVisible()) await showAllNotes.click();
  const lastNote = page.locator(`[data-note-id="${notes.at(-1).id}"]`);
  await lastNote.scrollIntoViewIfNeeded();
  assert.equal(await lastNote.isVisible(), true);
  assert.equal(await notesPanel.evaluate(element => getComputedStyle(element.querySelector('[data-note-id]').parentElement).overflowY), 'visible');
  await count(6);
  console.log('Real search/family filters, selection retention, and final mobile note accessibility passed');

  await tab('ترکیب').click();
  await selectedPanel.locator('input').fill('باغ آزمون مرورگر');
  await tab('نتیجه').click();
  await resultPanel.getByRole('heading', { name: 'باغ آزمون مرورگر' }).waitFor();
  assert.match(await resultPanel.textContent(), /آغازین.*میانی.*پایه/);
  await checkLayout(page, 'mobile result');
  await tab('ترکیب').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await tab('نتیجه').getAttribute('aria-selected'), 'true');
  console.log('Mobile tabs, rename, sensory summary, RTL, and no overflow passed');

  const refreshedNotes = page.waitForResponse(response => response.url().includes('/api/v1/fragrance-notes?'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal((await refreshedNotes).status(), 200);
  await page.locator('#studio-panel-0[data-note-count="24"]').waitFor({ timeout: 10000 });
  await count(0);
  assert.equal(await selectedPanel.locator('input').inputValue(), 'رایحه من');
  console.log('Refresh correctly resets unsaved local composition; no persistence was promised');

  await select(notes[0]);
  await count(1);
  await page.getByRole('button', { name: 'ذخیره مفهوم' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'ورود برای ذخیره' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'بستن' }).click();
  await count(1);
  await page.getByRole('button', { name: 'ذخیره مفهوم' }).first().click();
  const smsResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/challenges'));
  await dialog.getByPlaceholder('09123456789').fill('۰۹۱۲۳۴۵۶۷۸۹');
  await dialog.getByRole('button', { name: 'دریافت کد' }).click();
  assert.equal((await smsResponse).status(), 503);
  await dialog.getByText('این سرویس در حال حاضر در دسترس نیست.').waitFor();
  await dialog.getByRole('button', { name: 'بستن' }).click();
  await count(1);
  const protectedStatuses = await page.evaluate(async base => {
    const get = await fetch(`${base}/fragrance-concepts`, { credentials: 'include' });
    const post = await fetch(`${base}/fragrance-concepts`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ناامن', notes: [] }),
    });
    return [get.status, post.status];
  }, apiBase);
  assert.deepEqual(protectedStatuses, [401, 401]);
  assertNoBrowserErrors(report, 'mobile Studio journey');
  console.log('Unauthenticated save preserved the concept; SMS returned 503; protected GET/POST returned 401');
  console.log('Browser journey PASS');
} finally {
  await browser.close();
}
