import assert from 'node:assert/strict';
import {
  assertNoBrowserErrors,
  frontendOrigin,
  openBrowser,
  watchPage,
} from './browser-utils.mjs';
import {
  apiOrigin,
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

const failFirstSave = process.argv.includes('--fail-first-save');
const expireFirstSave = process.argv.includes('--expire-first-save');
const deferFirstSave = process.argv.includes('--defer-first-save');
assert.ok([failFirstSave, expireFirstSave, deferFirstSave].filter(Boolean).length <= 1, 'Save modes must run separately');
const expectedPostAttempts = failFirstSave || expireFirstSave ? 2 : 1;
const mode = failFirstSave ? '503 retry' : expireFirstSave ? '401 reauthentication' : deferFirstSave ? 'pending duplicate prevention' : 'happy path';
let allowedSave503Responses = 0;
let allowedSave401Responses = 0;
const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const browserReport = watchPage(page, (status, url) => {
  if (statusAllowsWatcher(status, url)) return true;
  if (failFirstSave && status === 503 && new URL(url).pathname === '/api/v1/fragrance-concepts' && allowedSave503Responses === 0) {
    allowedSave503Responses += 1;
    return true;
  }
  if (expireFirstSave && status === 401 && new URL(url).pathname === '/api/v1/fragrance-concepts' && allowedSave401Responses === 0) {
    allowedSave401Responses += 1;
    return true;
  }
  return false;
});
const conceptPostRequests = [];
page.on('request', request => {
  if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/fragrance-concepts') {
    conceptPostRequests.push(request);
  }
});

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
  const fixture = await installGuidedSaveFixture(context, { failFirstSave, expireFirstSave, deferFirstSave });
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

  const completeLogin = async expectedPosts => {
    const previousCsrf = fixture.csrfValues.at(-1);
    await loginDialog.getByLabel('شماره موبایل').fill(fixtureMobile);
    const challengePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST',
    );
    await loginDialog.getByRole('button', { name: 'دریافت کد' }).click();
    const challenge = await challengePromise;
    assert.equal(challenge.status(), 202);
    assert.equal(fixture.conceptCreates, expectedPosts, 'Requesting an OTP must not save');
    await loginDialog.getByLabel('کد شش رقمی').fill(fixtureOtp);
    const verifyPromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST',
    );
    await loginDialog.getByRole('button', { name: 'تأیید و ورود' }).click();
    assert.equal((await verifyPromise).status(), 200);
    await loginDialog.waitFor({ state: 'detached' });
    await page.getByText('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.', { exact: true }).waitFor();
    assert.deepEqual(await readComposition(), editedSnapshot, 'Login must preserve edits and require a second explicit Save');
    assert.equal(fixture.conceptCreates, expectedPosts, 'Login must not automatically create a concept');
    assert.equal(conceptPostRequests.length, expectedPosts, 'No automatic POST may follow authentication');
    assert.notEqual(fixture.csrfValues.at(-1), previousCsrf, 'Authentication must obtain a fresh CSRF token');
  };
  await completeLogin(0);

  const postPayloads = [];
  const submitSave = async () => {
    const responsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.locator('.studio-save-top').click();
    return responsePromise;
  };

  if (failFirstSave || expireFirstSave) {
    const failureStatus = expireFirstSave ? 401 : 503;
    const failedSaveResponse = await submitSave();
    assert.equal(failedSaveResponse.status(), failureStatus, `The first valid Save must receive the injected HTTP ${failureStatus}`);
    const failedPayload = failedSaveResponse.request().postDataJSON();
    postPayloads.push(failedPayload);
    assert.equal(conceptCreateIsValid(failedPayload, editedSnapshot.name, editedSnapshot.selections), true, 'Failed POST payload must exactly match the edited UI snapshot');
    assert.deepEqual(normalizedSelections(failedPayload.notes), normalizedSelections(editedSnapshot.selections));
    assert.equal(fixture.conceptCreates, 1, 'First failure should count as one POST attempt');
    assert.equal(fixture.successfulConceptCreates, 0, `HTTP ${failureStatus} must not create a concept`);
    assert.equal(fixture.injectedSaveFailures, failFirstSave ? 1 : 0, 'Synthetic 503 count must match the mode');
    assert.equal(fixture.injectedSessionExpiries, expireFirstSave ? 1 : 0, 'Synthetic 401 count must match the mode');
    assert.equal(fixture.savedConcept, null, 'Failed Save must leave the concept store empty');
    assert.equal(Object.hasOwn(await failedSaveResponse.json(), 'id'), false, 'Failed response must not contain a concept ID');

    if (expireFirstSave) {
      await loginDialog.waitFor();
      await page.getByRole('alert').getByText('برای ادامه وارد حساب شوید.', { exact: true }).waitFor();
      assert.deepEqual(await readComposition(), editedSnapshot, 'Session expiry must preserve name, note IDs, layers, and order behind reauthentication');
      assert.equal(await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.', { exact: true }).count(), 0, 'Expired Save must not display success');
      assert.equal(fixture.conceptCreates, 1, 'Opening reauthentication must not retry Save');
      assert.equal(allowedSave401Responses, 1, 'Exactly the injected Save 401 is allowed');
      await completeLogin(1);
      assert.equal(fixture.savedConcept, null, 'Reauthentication must leave the concept store empty');
      assert.equal(fixture.successfulConceptCreates, 0, 'Reauthentication requires an explicit Save retry');
    }

    const emptyListResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'GET',
    );
    const emptyList = await page.evaluate(async endpoint => {
      const response = await fetch(endpoint, { credentials: 'include' });
      return { status: response.status, body: await response.json() };
    }, `${apiOrigin}/api/v1/fragrance-concepts?limit=50&offset=0`);
    const emptyListResponse = await emptyListResponsePromise;
    assert.equal(emptyListResponse.status(), 200, 'Authenticated saved-concept list should return HTTP 200 after failure');
    assert.equal(emptyList.status, 200);
    assert.deepEqual(emptyList.body, [], 'Saved-concept list should remain empty after the failed Save');
    assert.equal(fixture.savedConcept, null, 'The isolated API fixture must still contain no concept');

    if (failFirstSave) await page.getByText('این سرویس در حال حاضر در دسترس نیست.', { exact: true }).waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector('.studio-save-top');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    assert.deepEqual(await readComposition(), editedSnapshot, `The complete edit must survive the HTTP ${failureStatus}`);
    assert.equal(await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.', { exact: true }).count(), 0, 'Failure must not display successful-save messaging');
    assert.equal(fixture.conceptCreates, 1, 'The UI must not automatically retry after the failed request settles');
    assert.equal(allowedSave503Responses, failFirstSave ? 1 : 0, 'Only the expected 503 may be ignored by browser error monitoring');
  }

  let createResponse;
  if (deferFirstSave) {
    const saveButton = page.locator('.studio-save-top');
    const firstPost = page.waitForRequest(request =>
      new URL(request.url()).pathname === '/api/v1/fragrance-concepts' && request.method() === 'POST',
      { timeout: 15000 },
    );
    const responsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST',
      { timeout: 15000 },
    );
    // Fail promptly if validation responds instead of reaching the deferred gate.
    const pendingPromise = Promise.race([
      fixture.firstSavePending,
      responsePromise.then(response => { throw new Error(`Save responded with HTTP ${response.status()} before the pending gate`); }),
    ]);
    await saveButton.click();
    await firstPost;
    await pendingPromise;
    try {
      await page.waitForFunction(() => document.querySelector('.studio-save-top')?.disabled === true);
      assert.equal(fixture.pendingSave, true, 'The first response must still be held by the fixture');
      assert.equal(fixture.savedConcept, null, 'A pending request must not create a record');
      assert.equal(fixture.successfulConceptCreates, 0);
      const box = await saveButton.boundingBox();
      assert.ok(box, 'Save must remain visible while pending');
      // Real pointer clicks intentionally bypass Playwright's wait-for-enabled behavior.
      // The API response remains deferred until all repeated clicks have completed.
      for (let click = 0; click < 5; click += 1) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      assert.equal(await saveButton.isDisabled(), true, 'Save must stay disabled while the first request is pending');
      assert.deepEqual(await readComposition(), editedSnapshot, 'Repeated pending clicks must preserve the complete edited composition');
      assert.equal(conceptPostRequests.length, 1, 'Repeated clicks must send only one browser POST');
      assert.equal(fixture.conceptCreates, 1, 'The fixture must receive only one POST while pending');
      assert.equal(fixture.savedConcept, null, 'Repeated clicks must not create a record before release');
      assert.equal(fixture.pendingSave, true, 'The response must remain deferred throughout repeated clicks');
      fixture.releaseFirstSave();
      createResponse = await responsePromise;
      assert.equal(fixture.pendingSave, false, 'The deterministic response gate must be released');
    } finally {
      fixture.releaseFirstSave();
    }
  } else {
    createResponse = await submitSave();
  }
  assert.equal(createResponse.status(), 201, expectedPostAttempts === 2 ? 'Second explicit Save should create the edited concept' : 'Explicit Save should create the edited concept');
  const savedPayload = createResponse.request().postDataJSON();
  postPayloads.push(savedPayload);
  assert.equal(conceptCreateIsValid(savedPayload, editedSnapshot.name, editedSnapshot.selections), true, 'POST must contain the UI-edited name and exact note IDs, layers, and contiguous positions');
  assert.deepEqual(normalizedSelections(savedPayload.notes), normalizedSelections(editedSnapshot.selections), 'Create payload should match the post-edit UI snapshot');
  assert.equal(fixture.conceptCreates, expectedPostAttempts, 'POST attempt count should match the selected mode');
  assert.equal(fixture.successfulConceptCreates, 1, 'Exactly one concept creation should succeed');
  assert.equal(fixture.injectedSaveFailures, failFirstSave ? 1 : 0, 'Injected failure count should match the selected mode');
  if (failFirstSave || expireFirstSave) {
    assert.deepEqual(normalizedSelections(postPayloads[0].notes), normalizedSelections(postPayloads[1].notes), 'Both Save attempts should carry the same note data');
    assert.equal(postPayloads[0].name, postPayloads[1].name, 'Both Save attempts should carry the same edited name');
  }
  await page.getByText('مفهوم رایحه با موفقیت ذخیره شد.').waitFor();
  await page.locator('.studio-save-top').getByText('ذخیره تغییرات', { exact: true }).waitFor();
  assert.equal(fixture.conceptCreates, expectedPostAttempts, 'Successful save state must not duplicate the record');

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
  assert.equal(writes.length, expectedPostAttempts, 'Concept POST attempts should match the selected mode');
  assert.equal(conceptPostRequests.length, expectedPostAttempts, 'Browser POST counts must agree with the fixture after reopening');
  assert.equal(fixture.successfulConceptCreates, 1, 'Exactly one successful concept creation should exist');
  assert.equal(fixture.injectedSaveFailures, failFirstSave ? 1 : 0, 'Synthetic 503 failure count should match the selected mode');
  assert.equal(allowedSave503Responses, failFirstSave ? 1 : 0, 'Only the expected first-save 503 is allowed');
  assert.equal(fixture.injectedSessionExpiries, expireFirstSave ? 1 : 0, 'Synthetic session expiry count should match the mode');
  assert.equal(allowedSave401Responses, expireFirstSave ? 1 : 0, 'Only the expected first-save 401 is allowed');
  assert.equal(fixture.challengeRequests, expireFirstSave ? 2 : 1, 'Challenge count must include reauthentication only in expiry mode');
  assert.equal(fixture.verificationRequests, expireFirstSave ? 2 : 1, 'Verification count must include reauthentication only in expiry mode');
  assert.equal(fixture.conceptUpdates, 0, 'No concept update should be issued');
  assert.equal(fixture.conceptDeletes, 0, 'No concept delete should be issued');
  assert.equal(fixture.unexpectedApiCalls.length, 0, 'Every API request must be handled by the isolated fixture');
  assertNoBrowserErrors(browserReport, 'Guided-to-Creative edit/save/reopen journey');

  console.log(
    `Guided→Creative edit/save/reopen ${mode} PASS (${syntheticFixtureLabel}) — API requests: ${fixture.apiRequests.length} total; families: ${fixture.apiRequests.filter(call => call.path === '/api/v1/fragrance-families').length}, notes: ${fixture.apiRequests.filter(call => call.path === '/api/v1/fragrance-notes').length}, challenges: ${fixture.challengeRequests}, verifications: ${fixture.verificationRequests}, concept POST attempts: ${writes.length}, successful creates: ${fixture.successfulConceptCreates}, injected 503 failures: ${fixture.injectedSaveFailures}, injected 401 failures: ${fixture.injectedSessionExpiries}, PUT: ${fixture.conceptUpdates}, DELETE: ${fixture.conceptDeletes}, concept reads: ${fixture.conceptReads}, unexpected API calls: ${fixture.unexpectedApiCalls.length}.`,
  );
} finally {
  await browser.close();
}
