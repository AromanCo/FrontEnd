import assert from 'node:assert/strict';
import {
  assertNoBrowserErrors,
  frontendOrigin,
  openBrowser,
  watchPage,
} from './browser-utils.mjs';
import {
  conceptCreateIsValid,
  fixtureMobile,
  fixtureOtp,
  installGuidedSaveFixture,
  layerOrder,
  notes,
  normalizedSelections,
  statusAllowsWatcher,
  syntheticFixtureLabel,
} from './guided-save-fixture.mjs';

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const browserReport = watchPage(page, statusAllowsWatcher);

async function readComposition() {
  return page.locator('#studio-panel-1').evaluate(panel => {
    const name = panel.querySelector('input[aria-label="نام مفهوم"]')?.value || '';
    const selections = [];
    for (const layerSection of panel.querySelectorAll('.composition-layer[data-layer]')) {
      const layer = layerSection.getAttribute('data-layer') || '';
      [...layerSection.querySelectorAll('.composition-note')].forEach((row, position) => {
        selections.push({
          note_id: row.getAttribute('data-selected-note-id') || '',
          layer,
          position,
        });
      });
    }
    return { name, selections };
  });
}

function assertValidSnapshot(snapshot, message) {
  assert.ok(snapshot.name.trim(), `${message}: concept name should be present`);
  assert.ok(snapshot.selections.length > 0 && snapshot.selections.length <= 6, `${message}: expected one to six notes`);
  assert.ok(snapshot.selections.every(item => notes.some(note => note.id === item.note_id)), `${message}: every note ID must be in the synthetic catalog`);
  assert.ok(snapshot.selections.every(item => layerOrder.includes(item.layer)), `${message}: every layer must be valid`);
  for (const layer of layerOrder) {
    const positions = snapshot.selections.filter(item => item.layer === layer).map(item => item.position);
    assert.deepEqual(positions, positions.map((_, index) => index), `${message}: positions in ${layer} must be contiguous and ordered`);
  }
}

try {
  const fixture = await installGuidedSaveFixture(context);
  const initialSession = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/session' && response.status() === 401,
  );
  await page.goto(`${frontendOrigin}/studio/guided`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'حال‌وهوای شما' }).waitFor();
  await initialSession;

  const selectOption = async (role, name) => {
    const control = page.getByRole(role, { name });
    if (!(await control.isChecked())) await control.locator('xpath=..').click();
    assert.equal(await control.isChecked(), true, `Guided choice was not selected: ${name}`);
  };
  const continueStep = async (nextHeading, buttonName = 'ادامه') => {
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await page.getByRole('heading', { name: nextHeading }).waitFor();
  };

  await selectOption('radio', /آرام و آسوده/);
  await continueStep('جهان‌های رایحه');
  await page.getByRole('checkbox', { name: /گلی/ }).check({ force: true });
  await continueStep('دمای حسی');
  await selectOption('radio', /نرم و متعادل/);
  await continueStep('یک تصویر برای خیال');
  await selectOption('radio', /گوشه‌ای پر از گل/);
  await continueStep('نت‌هایی که به دلتان می‌نشینند');
  await page.getByRole('button', { name: /فعلاً انتخابی ندارم/ }).click();
  await continueStep('بازبینی و میزان کشف');
  await selectOption('radio', /کمی آشنا، کمی تازه/);
  await page.getByRole('button', { name: 'دیدن پیشنهاد من', exact: true }).click();
  await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).waitFor();

  const guidedName = (await page.locator('.guided-result-name').textContent())?.trim() || '';
  const guidedSelections = await page.locator('.guided-result-layer li').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.closest('.guided-result-layer')?.getAttribute('data-layer') || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-note-id') || '', layer, position };
    });
  });
  const guidedSnapshot = { name: guidedName, selections: guidedSelections };
  assertValidSnapshot(guidedSnapshot, 'Guided result');

  await page.getByRole('button', { name: 'رفتن به استودیوی خلاق', exact: true }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?from=guided`);
  await page.getByText('پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.').waitFor();
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  await page.locator('#studio-panel-1').waitFor({ state: 'visible' });
  const importedSnapshot = await readComposition();
  assert.equal(importedSnapshot.name, guidedSnapshot.name, 'Guided transfer must preserve the concept name');
  assert.deepEqual(normalizedSelections(importedSnapshot.selections), normalizedSelections(guidedSnapshot.selections), 'Guided transfer must preserve IDs, layers, and layer-local order');
  assert.equal(fixture.conceptCreates, 0, 'Importing a Guided composition must not create a concept');
  assert.equal(fixture.conceptUpdates, 0, 'Importing a Guided composition must not update a concept');

  await page.getByLabel('نام مفهوم').fill('روایت ویرایش‌شدهٔ آزمون');
  const firstTopNote = guidedSnapshot.selections.find(item => item.layer === 'top');
  assert.ok(firstTopNote, 'Deterministic Guided fixture should provide a top-layer note for the move');
  const movedNote = notes.find(note => note.id === firstTopNote.note_id);
  assert.ok(movedNote, 'The moved note must resolve to a synthetic catalog fixture');
  await page.getByLabel(`لایه ${movedNote.name}`).selectOption('heart');
  let postMove = await readComposition();
  const heartRows = await page.locator('#studio-panel-1 .composition-layer[data-layer="heart"] .composition-note').count();
  assert.ok(heartRows >= 2, 'After moving the top note, the deterministic fixture must allow an in-layer reorder');
  const secondHeartNoteId = await page.locator('#studio-panel-1 .composition-layer[data-layer="heart"] .composition-note').nth(1).getAttribute('data-selected-note-id');
  const secondHeartNote = notes.find(note => note.id === secondHeartNoteId);
  assert.ok(secondHeartNote, 'Second heart-layer note should resolve from the catalog fixture');
  await page.getByRole('button', { name: `جابجایی ${secondHeartNote.name} به بالا`, exact: true }).click();
  const editedSnapshot = await readComposition();
  assertValidSnapshot(editedSnapshot, 'Edited Creative composition');
  assert.equal(editedSnapshot.name, 'روایت ویرایش‌شدهٔ آزمون', 'Edited name should be read from the actual UI');
  assert.deepEqual(
    [...editedSnapshot.selections].map(item => item.note_id).sort(),
    [...guidedSnapshot.selections].map(item => item.note_id).sort(),
    'Editing must preserve the exact set of selected note IDs',
  );
  assert.notDeepEqual(editedSnapshot, guidedSnapshot, 'The saved snapshot must differ from the original Guided result');
  assert.notDeepEqual(normalizedSelections(editedSnapshot.selections), normalizedSelections(guidedSnapshot.selections), 'Move and reorder must change layer/order data');
  assert.notDeepEqual(postMove, editedSnapshot, 'The UI reorder action must change the in-layer order');

  await page.locator('.studio-save-top').click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیره' });
  await loginDialog.waitFor();
  assert.equal(fixture.conceptCreates, 0, 'Anonymous Save must not write a concept');
  assert.deepEqual(await readComposition(), editedSnapshot, 'Opening login must preserve the edited composition');

  await loginDialog.getByLabel('شماره موبایل').fill(fixtureMobile);
  const challengePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'دریافت کد' }).click();
  const challenge = await challengePromise;
  assert.equal(challenge.status(), 202);
  assert.equal(fixture.conceptCreates, 0);
  await loginDialog.getByLabel('کد شش رقمی').fill(fixtureOtp);
  const verifyPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyPromise).status(), 200);
  await loginDialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.', { exact: true }).waitFor();
  assert.deepEqual(await readComposition(), editedSnapshot, 'Login must preserve edits and require a second explicit Save');
  assert.equal(fixture.conceptCreates, 0, 'Login must not automatically create a concept');

  const createPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST',
    { timeout: 6000 },
  );
  await page.locator('.studio-save-top').click();
  let createResponse;
  try {
    createResponse = await createPromise;
  } catch {
    const state = await page.evaluate(() => ({
      notices: [...document.querySelectorAll('[role="status"], [role="alert"]')].map(item => item.textContent),
      buttonDisabled: document.querySelector('.studio-save-top')?.disabled,
    }));
    throw new Error(`Explicit Save did not issue POST; UI state ${JSON.stringify(state)}, API methods ${fixture.apiRequests.map(call => `${call.method} ${call.path}`).join(', ')}`);
  }
  assert.equal(createResponse.status(), 201, 'Explicit retry should create the edited concept');
  const savedPayload = createResponse.request().postDataJSON();
  assert.equal(conceptCreateIsValid(savedPayload, editedSnapshot.name, editedSnapshot.selections), true, 'POST must contain the UI-edited name and exact note IDs, layers, and contiguous positions');
  assert.deepEqual(normalizedSelections(savedPayload.notes), normalizedSelections(editedSnapshot.selections), 'Create payload should match the post-edit UI snapshot');
  assert.equal(fixture.conceptCreates, 1, 'Exactly one create should occur');
  await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.').waitFor();
  await page.locator('.studio-save-top').getByText('ذخیره تغییرات', { exact: true }).waitFor();
  assert.equal(fixture.conceptCreates, 1, 'Successful save must not duplicate the record');

  const accountListResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'GET',
  );
  await page.goto(`${frontendOrigin}/account`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
  const accountListResponse = await accountListResponsePromise;
  assert.equal(accountListResponse.status(), 200, 'Account should receive HTTP 200 for the saved-concept list');
  const accountConcepts = await accountListResponse.json();
  assert.ok(Array.isArray(accountConcepts), 'Account list response should be an array');
  assert.equal(accountConcepts.length, 1, 'Account should list the single created concept');
  assert.equal(accountConcepts[0].name, editedSnapshot.name, 'Actual account API response should contain the edited name');
  assert.deepEqual(normalizedSelections(accountConcepts[0].notes), normalizedSelections(editedSnapshot.selections), 'Actual account API response should preserve edited note IDs, layers, and positions');
  await page.getByRole('heading', { name: editedSnapshot.name, exact: true }).waitFor();
  const accountListCall = fixture.apiRequests.find(call => call.path === '/api/v1/fragrance-concepts' && call.method === 'GET');
  assert.ok(accountListCall, 'Account must request the saved concept list');

  const conceptId = accountConcepts[0].id;
  const reopenedResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${conceptId}` && response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'باز کردن و ویرایش', exact: true }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?concept=${conceptId}`);
  const reopenedResponse = await reopenedResponsePromise;
  assert.equal(reopenedResponse.status(), 200, 'Reopen should fetch the saved concept by ID with HTTP 200');
  const reopenedFromApi = await reopenedResponse.json();
  assert.equal(reopenedFromApi.name, editedSnapshot.name, 'Reopen API response should retain the edited name');
  assert.deepEqual(normalizedSelections(reopenedFromApi.notes), normalizedSelections(editedSnapshot.selections), 'Reopen API response should retain edited IDs, layers, and positions');

  const expectedRestored = normalizedSelections(editedSnapshot.selections);
  await page.waitForFunction(({ name, selections }) => {
    const panel = document.querySelector('#studio-panel-1');
    const currentName = panel?.querySelector('input[aria-label="نام مفهوم"]')?.value;
    if (!panel || currentName !== name) return false;
    const current = [];
    for (const section of panel.querySelectorAll('.composition-layer[data-layer]')) {
      const layer = section.getAttribute('data-layer') || '';
      [...section.querySelectorAll('.composition-note')].forEach((row, position) => {
        current.push({ note_id: row.getAttribute('data-selected-note-id') || '', layer, position });
      });
    }
    return JSON.stringify(current) === JSON.stringify(selections);
  }, { name: editedSnapshot.name, selections: expectedRestored });

  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const getByIdCall = fixture.apiRequests.find(call => call.path === `/api/v1/fragrance-concepts/${conceptId}` && call.method === 'GET');
  assert.ok(getByIdCall, 'Reopen must fetch the saved concept by ID');
  const reopenedUI = await readComposition();
  assert.equal(reopenedUI.name, editedSnapshot.name, 'Creative Studio should display the saved edited name');
  assert.deepEqual(normalizedSelections(reopenedUI.selections), normalizedSelections(editedSnapshot.selections), 'Creative Studio should reopen exact saved IDs, layers, and within-layer order');

  const writes = fixture.apiRequests.filter(call => call.path === '/api/v1/fragrance-concepts' && call.method === 'POST');
  assert.equal(writes.length, 1, 'Exactly one concept POST should be issued');
  assert.equal(fixture.conceptUpdates, 0, 'No concept update should be issued');
  assert.equal(fixture.conceptDeletes, 0, 'No concept delete should be issued');
  assert.equal(fixture.unexpectedApiCalls.length, 0, 'Every API request must be handled by the isolated fixture');
  assertNoBrowserErrors(browserReport, 'Guided-to-Creative edit/save/reopen journey');

  console.log(
    `Guided→Creative edit/save/reopen PASS (${syntheticFixtureLabel}) — API requests: ${fixture.apiRequests.length} total; families: ${fixture.apiRequests.filter(call => call.path === '/api/v1/fragrance-families').length}, notes: ${fixture.apiRequests.filter(call => call.path === '/api/v1/fragrance-notes').length}, challenges: ${fixture.challengeRequests}, verifications: ${fixture.verificationRequests}, concept POST: ${writes.length}, PUT: ${fixture.conceptUpdates}, DELETE: ${fixture.conceptDeletes}, concept reads: ${fixture.conceptReads}, unexpected API calls: ${fixture.unexpectedApiCalls.length}.`,
  );
} finally {
  await browser.close();
}
