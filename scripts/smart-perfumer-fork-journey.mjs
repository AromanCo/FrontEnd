import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const api = process.env.API_ORIGIN || 'http://localhost:8000';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = join(process.cwd(), 'artifacts/smart-perfumer/v1', `saved-fork-${stamp}`);
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const writes = [];
const savedId = '00000000-0000-4000-8000-000000000799';
const createdId = '00000000-0000-4000-8000-000000000798';
let noteRecords = [];
const originalSavedRecord = { id: savedId, name: 'مفهوم اصلی', notes: [] };

const json = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
page.on('pageerror', error => pageErrors.push(error.message));
page.on('request', request => {
  if (request.url().includes('/api/v1/fragrance-concepts') && ['PUT', 'DELETE'].includes(request.method())) {
    writes.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
  }
});

try {
  await mkdir(output, { recursive: true });

  // Obtain the saved fixture's note ID from the real public catalog before
  // installing isolated auth/concept fixtures. Family and note requests from
  // the application continue to the real FastAPI service below.
  const catalogResponse = await fetch(`${api}/api/v1/fragrance-notes?limit=100&offset=0`);
  assert.equal(catalogResponse.status, 200, 'Seeded FastAPI notes endpoint is available');
  noteRecords = await catalogResponse.json();
  assert.ok(noteRecords.length >= 2, 'Seeded API provides notes for the fork journey');
  originalSavedRecord.notes = [{ note_id: noteRecords[0].id, layer: 'heart', position: 0 }];

  await page.route(`${api}/api/v1/auth/session`, route => json(route, { user_id: '00000000-0000-4000-8000-000000000701', role: 'customer' }));
  await page.route(`${api}/api/v1/auth/csrf`, route => json(route, { csrf_token: 'isolated-smart-perfumer-fork-csrf' }));
  await page.route(`${api}/api/v1/users/me`, route => json(route, { id: '00000000-0000-4000-8000-000000000701', mobile_e164: '+989121234567', role: 'customer' }));

  const familyResponses = [];
  const noteResponses = [];
  await page.route(`${api}/api/v1/fragrance-families**`, async route => {
    const response = await route.fetch();
    familyResponses.push(response.status());
    await route.fulfill({ response });
  });
  await page.route(`${api}/api/v1/fragrance-notes**`, async route => {
    const response = await route.fetch();
    noteResponses.push(response.status());
    await route.fulfill({ response });
  });
  await page.route(`${api}/api/v1/fragrance-concepts/${savedId}`, route => json(route, structuredClone(originalSavedRecord)));
  await page.route(`${api}/api/v1/fragrance-concepts`, async route => {
    if (route.request().method() === 'POST') {
      writes.push({ method: 'POST', url: route.request().url(), body: route.request().postDataJSON() });
      await json(route, { id: createdId, ...route.request().postDataJSON() }, 201);
      return;
    }
    if (route.request().method() === 'GET') return json(route, []);
    await route.continue();
  });
  await page.route(`${api}/api/v1/fragrance-concepts/${savedId}`, async route => {
    if (route.request().method() === 'PUT') {
      writes.push({ method: 'PUT', url: route.request().url(), body: route.request().postDataJSON() });
      return json(route, { ...originalSavedRecord });
    }
    if (route.request().method() === 'GET') return json(route, structuredClone(originalSavedRecord));
    await route.continue();
  });

  await page.goto(`${origin}/studio/creative?concept=${savedId}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('نام مفهوم').waitFor();
  await page.waitForFunction(() => document.querySelector('.composition-note select')?.value === 'heart');
  await page.locator('button.studio-save-top').getByText('ذخیره تغییرات', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), originalSavedRecord.name);
  assert.ok(familyResponses.length > 0 && familyResponses.every(status => status === 200), 'Application family catalog requests are real successful API responses');
  assert.ok(noteResponses.length > 0 && noteResponses.every(status => status === 200), 'Application note catalog requests are real successful API responses');
  assert.equal(await page.locator('.studio-grid > .studio-panel').count(), 3);

  const advisor = page.getByRole('region', { name: 'پیشنهاد خلاق آرومان' });
  const summary = advisor.locator('summary');
  if (!(await summary.evaluate(element => element.parentElement.open))) await summary.click();
  await advisor.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }).click();
  await advisor.getByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 }).waitFor();
  assert.equal(await page.locator('.composition-note select').inputValue(), 'heart', 'Saved original is unchanged during preview');
  assert.deepEqual(writes, [], 'Preview causes no concept writes');
  await page.screenshot({ path: join(output, 'saved-concept-advisor-preview.png'), fullPage: true, animations: 'disabled' });

  await advisor.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).click();
  const dialog = page.getByRole('dialog', { name: 'ساخت نسخهٔ مستقل' });
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /ذخیره‌شدهٔ اصلی.*باقی می‌ماند|نسخه.*ذخیره/);
  assert.deepEqual(writes, [], 'Opening fork confirmation causes no concept writes');
  await dialog.getByRole('button', { name: 'ساخت نسخهٔ مستقل' }).click();
  await page.waitForURL('**/studio/creative?from=advisor');
  await page.getByText('نسخهٔ مستقل برای ویرایش آماده است؛ نسخهٔ اصلی محفوظ مانده و این پیش‌نویس هنوز ذخیره نشده است.').waitFor();
  await page.getByLabel('نام مفهوم').waitFor();
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), originalSavedRecord.name, 'Fork preserves the full original concept name');
  const importedNote = page.locator('.composition-note');
  assert.equal(await importedNote.count(), 1, 'Fork keeps the exact selected note count');
  assert.equal(await importedNote.getAttribute('data-selected-note-id'), noteRecords[0].id, 'Fork preserves actual catalog UUID');
  assert.equal(await importedNote.locator('select').inputValue(), 'top', 'Proposed layer is imported');
  assert.ok(await page.getByRole('button', { name: 'ذخیره مفهوم' }).count() >= 1, 'Detached editor exposes explicit creation Save');
  assert.equal(await page.getByRole('button', { name: 'ذخیره تغییرات' }).count(), 0);
  assert.deepEqual(writes, [], 'Fork and route detachment are not automatic saves');
  await page.screenshot({ path: join(output, 'advisor-fork-unsaved-draft.png'), fullPage: true, animations: 'disabled' });

  await page.locator('button.studio-save-top').getByText('ذخیره مفهوم', { exact: true }).click();
  await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.', { exact: true }).waitFor();
  assert.equal(writes.length, 1, 'Only the explicit Save creates a concept');
  assert.equal(writes[0].method, 'POST', 'Fork Save uses concept creation');
  assert.equal(writes[0].url, `${api}/api/v1/fragrance-concepts`);
  assert.deepEqual(writes[0].body, {
    name: originalSavedRecord.name,
    notes: [{ note_id: noteRecords[0].id, layer: 'top', position: 0 }],
  });
  assert.deepEqual(originalSavedRecord, {
    id: savedId,
    name: 'مفهوم اصلی',
    notes: [{ note_id: noteRecords[0].id, layer: 'heart', position: 0 }],
  }, 'Original fixture remains unchanged');
  assert.ok(!writes.some(write => write.method === 'PUT' && write.url.endsWith(savedId)), 'No update targets the original saved concept');

  // Full navigation simulates refresh/direct entry: the root provider has no
  // in-memory transfer, so the route must stay locked until the user exits.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').filter({ hasText: /انتقال نسخهٔ مستقل در حافظهٔ این برگه پیدا نشد/ }).waitFor();
  await page.locator('.studio-grid[inert]').waitFor({ state: 'attached' });
  assert.equal(await page.getByRole('button', { name: 'ذخیره مفهوم' }).isDisabled(), true);
  await page.screenshot({ path: join(output, 'advisor-fork-expired-recovery.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'ترک انتقال و شروع استودیوی تازه' }).click();
  await page.waitForURL(`${origin}/studio/creative`);
  await page.locator('.studio-grid:not([inert])').waitFor();
  assert.deepEqual(writes.map(write => write.method), ['POST'], 'Expired-route recovery does not issue further concept writes');
  assert.deepEqual(pageErrors, [], pageErrors.join('\n'));

  console.log(`PASS: real FastAPI catalog returned ${noteRecords.length} notes; saved-concept/auth and concept write endpoints were isolated Playwright fixtures.`);
  console.log(`PASS: App Router detached ${savedId} to ${page.url()} for expired recovery; original fixture remains unchanged; explicit fork Save used POST only.`);
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
