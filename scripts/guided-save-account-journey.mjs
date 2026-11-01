import assert from 'node:assert/strict';
import {
  assertNoBrowserErrors,
  frontendOrigin,
  openBrowser,
  watchPage,
} from './browser-utils.mjs';
import {
  apiOrigin, conceptCreateIsValid, fixtureMobile, fixtureOtp,
  installGuidedSaveFixture, layerOrder, notes, normalizedSelections, sameConceptRecord,
  statusAllowsWatcher, syntheticFixtureLabel,
} from './guided-save-fixture.mjs';

const browser = await openBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const browserReport = watchPage(page, statusAllowsWatcher);

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
  const visibleName = (await page.locator('.guided-result-name').textContent())?.trim() || '';
  const visibleSelections = await page.locator('.guided-result-layer li').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.closest('.guided-result-layer')?.getAttribute('data-layer') || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-note-id') || '', layer, position };
    });
  });
  assert.ok(visibleName, 'Guided result must display a concept name');
  assert.ok(visibleSelections.length > 0 && visibleSelections.length <= 6, 'Guided result must contain one to six notes');
  assert.ok(visibleSelections.every(item => notes.some(note => note.id === item.note_id)), 'Displayed recommendation must use fixture catalog UUIDs');
  assert.ok(visibleSelections.every(item => layerOrder.includes(item.layer)), 'Displayed recommendation must use valid layers');

  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
  await loginDialog.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Guided result should remain mounted behind login');
  assert.equal(fixture.conceptCreates, 0, 'Anonymous Save must not create a concept');

  await loginDialog.getByLabel('شماره موبایل').fill(fixtureMobile);
  const challengeResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/challenges' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'دریافت کد' }).click();
  const challengeResponse = await challengeResponsePromise;
  assert.equal(challengeResponse.status(), 202, 'Synthetic challenge should be accepted');
  const challengeBody = await challengeResponse.json();
  assert.equal(Object.hasOwn(challengeBody, 'code') || Object.hasOwn(challengeBody, 'otp'), false, 'Challenge response must not expose OTP');
  await loginDialog.getByLabel('کد شش رقمی').fill(fixtureOtp);
  const verifyResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/auth/verify' && response.request().method() === 'POST',
  );
  await loginDialog.getByRole('button', { name: 'تأیید و ورود' }).click();
  assert.equal((await verifyResponsePromise).status(), 200, 'Fixture OTP should verify');
  await loginDialog.waitFor({ state: 'detached' });
  await page.getByText('وارد شدید. برای ذخیرهٔ این پیشنهاد، دوباره دکمهٔ ذخیره را بزنید.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' }).isVisible(), true, 'Successful login must preserve Guided result');
  assert.equal(fixture.conceptCreates, 0, 'Login must not automatically save the concept');
  const browserSessionCookie = (await context.cookies(`${apiOrigin}/api/v1/auth/session`))
    .find(cookie => cookie.name === 'aroman_session');
  const cookieContractMatches = Boolean(browserSessionCookie) && browserSessionCookie.httpOnly &&
    browserSessionCookie.sameSite === 'Lax' && browserSessionCookie.path === '/api/v1';
  assert.equal(cookieContractMatches, true, 'Browser must receive the verification cookie with its API path and security attributes');
  const csrfWasRotated = fixture.csrfValues.length >= 2 && fixture.csrfValues[0] !== fixture.csrfValues[1];
  assert.equal(csrfWasRotated, true, 'Authenticated refresh should rotate the verification CSRF token');

  const saveResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'ذخیرهٔ مفهوم', exact: true }).click();
  const saveResponse = await saveResponsePromise;
  assert.equal(saveResponse.status(), 201, 'Explicit Save retry should create a validated concept');
  const savedPayload = saveResponse.request().postDataJSON();
  const payloadMatchesGuided = conceptCreateIsValid(savedPayload, visibleName, visibleSelections);
  assert.equal(payloadMatchesGuided, true, 'Save payload must contain only the visible name and exact note selections');
  assert.equal(fixture.conceptCreates, 1, 'Exactly one concept create should be accepted');
  await page.getByText('مفهوم رایحهٔ شما ذخیره شد.').waitFor();
  const savedButton = page.getByRole('button', { name: 'ذخیره شد', exact: true });
  await savedButton.waitFor();
  assert.equal(await savedButton.isDisabled(), true, 'Saved result should prevent duplicate Save actions');
  assert.equal(fixture.conceptCreates, 1, 'Saved result must not create duplicates');

  const accountListPromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/v1/fragrance-concepts' &&
    response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'دیدن مفاهیم ذخیره‌شده' }).click();
  await page.waitForURL(`${frontendOrigin}/account`);
  await page.getByRole('heading', { name: 'مفاهیم من' }).waitFor();
  const accountList = await accountListPromise;
  assert.equal(accountList.status(), 200, 'Account should list saved concepts');
  const listedConcepts = await accountList.json();
  const accountContainsSavedRecord = Array.isArray(listedConcepts) && listedConcepts.length === 1 &&
    sameConceptRecord(listedConcepts[0], fixture.savedConcept);
  assert.equal(accountContainsSavedRecord, true, 'Account should return the exact in-memory saved concept');
  await page.getByRole('heading', { name: visibleName, exact: true }).waitFor();
  await page.locator('article').getByText(`${visibleSelections.length} نت`, { exact: true }).waitFor();

  const conceptId = fixture.savedConcept?.id;
  assert.equal(typeof conceptId, 'string', 'Created concept must have an ID');
  const savedConceptResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/fragrance-concepts/${conceptId}` &&
    response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'باز کردن و ویرایش' }).click();
  await page.waitForURL(`${frontendOrigin}/studio/creative?concept=${conceptId}`);
  const savedConceptResponse = await savedConceptResponsePromise;
  assert.equal(savedConceptResponse.status(), 200, 'Creative Studio should fetch the saved record by ID');
  const reopenedRecord = await savedConceptResponse.json();
  assert.equal(sameConceptRecord(reopenedRecord, fixture.savedConcept), true, 'Concept GET should return the same stored record');
  await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
  const compositionPanel = page.locator('#studio-panel-1');
  await compositionPanel.waitFor({ state: 'visible' });
  await page.getByLabel('نام مفهوم').waitFor();
  assert.equal(await page.getByLabel('نام مفهوم').inputValue(), visibleName, 'Creative Studio should restore the saved concept name');
  const reopenedSelections = await compositionPanel.locator('.composition-note').evaluateAll(rows => {
    const positions = new Map();
    return rows.map(row => {
      const layer = row.querySelector('select')?.value || '';
      const position = positions.get(layer) || 0;
      positions.set(layer, position + 1);
      return { note_id: row.getAttribute('data-selected-note-id') || '', layer, position };
    });
  });
  const reopenedMatchesSaved = JSON.stringify(normalizedSelections(reopenedSelections)) ===
    JSON.stringify(normalizedSelections(fixture.savedConcept.notes));
  assert.equal(reopenedMatchesSaved, true, 'Creative Studio should restore exact saved note IDs, layers, and within-layer order');
  assert.ok(fixture.apiRequests.some(call => call.path === `/api/v1/fragrance-concepts/${conceptId}` && call.method === 'GET'), 'Saved record should be fetched by ID');
  assert.equal(fixture.apiRequests.some(call => call.method === 'PUT' || call.method === 'DELETE' || call.path.endsWith('/duplicate')), false, 'Reopening must not edit, delete, or duplicate the concept');
  assert.equal(fixture.conceptCreates, 1, 'Reopening must not create another concept');
  assert.equal(fixture.challengeRequests, 1, 'The journey should issue one challenge request');
  assert.equal(fixture.verificationRequests, 1, 'The journey should issue one OTP verification request');
  assert.equal(fixture.unexpectedApiCalls.length, 0, 'Every API request must match the isolated fixture contract');
  assertNoBrowserErrors(browserReport, 'Guided Save/account/reopen browser journey');

  console.log(
    `Guided Save/account/reopen PASS (${syntheticFixtureLabel}) — challenge: ${fixture.challengeRequests}, verify: ${fixture.verificationRequests}, concept create: ${fixture.conceptCreates}, concept reads: ${fixture.conceptReads}, unexpected API calls: ${fixture.unexpectedApiCalls.length}.`,
  );
} finally {
  await browser.close();
}
