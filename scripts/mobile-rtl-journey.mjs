import assert from 'node:assert/strict';
import { assertNoBrowserErrors, browserEngine, checkLayout, frontendOrigin, openBrowser, watchPage } from './browser-utils.mjs';
import { installGuidedSaveFixture, notes, statusAllowsWatcher } from './guided-save-fixture.mjs';

// Complements responsive-studio-journey: no pixel/grid snapshots, Backend, or Save persistence tests.
const widths = [320, 390, 768, 1440];
const strictAccessibility = process.argv.includes('--strict-a11y');
const failures = [];
const browser = await openBrowser();

async function runViewport(width) {
  const mobile = width <= 768;
  const context = await browser.newContext({
    viewport: { width, height: 844 }, hasTouch: mobile, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const report = watchPage(page, statusAllowsWatcher);
  const externalRequests = [];
  // Fail closed: the shared API route below handles synthetic API calls; only the app may use network.
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === new URL(frontendOrigin).origin) await route.continue();
    else {
      externalRequests.push(route.request().url());
      await route.abort('blockedbyclient');
    }
  });
  const fixture = await installGuidedSaveFixture(context);
  const stage = label => `${browserEngine} ${width}px ${label}`;
  const activate = async locator => {
    await reachable(locator);
    if (mobile) await locator.tap();
    else await locator.click();
  };
  const layout = async label => {
    assert.equal(await page.locator('html').getAttribute('lang'), 'fa', stage(`${label}: Persian language`));
    await checkLayout(page, stage(label));
  };
  const reachable = async locator => {
    assert.equal(await locator.isVisible(), true, stage('essential control must be visible'));
    await locator.click({ trial: true });
    const rect = await locator.boundingBox();
    assert.ok(rect && rect.width > 0 && rect.height > 0 && rect.x >= -1 && rect.x + rect.width <= width + 1,
      stage(`control extends outside the viewport: ${JSON.stringify(rect)}`));
  };
  const keyboardFocus = async (locator, label) => {
    const state = await locator.evaluate(element => {
      const focused = document.activeElement === element;
      let indicator = false;
      for (let node = element; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        // Include the visible label/frame around custom radios and note buttons, not their clipped inputs.
        if (rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
            style.clipPath === 'none' && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 &&
            !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.outlineColor)) indicator = true;
      }
      return { focused, indicator };
    });
    assert.equal(state.focused, true, stage(`${label}: keyboard focus order`));
    assert.equal(state.indicator, true, stage(`${label}: visible keyboard focus`));
  };
  const pointerChoice = async (role, name) => {
    const input = page.getByRole(role, { name });
    await activate(input.locator('xpath=..'));
    assert.equal(await input.isChecked(), true, stage(`Guided ${name}`));
  };
  const next = async heading => {
    await activate(page.getByRole('button', { name: 'ادامه', exact: true }));
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    await layout(heading);
  };
  const tablist = page.getByRole('tablist', { name: 'گام‌های استودیو' });
  const tabs = [
    tablist.getByRole('tab', { name: /نت‌ها/ }),
    tablist.getByRole('tab', { name: /ترکیب/ }),
    tablist.getByRole('tab', { name: /نتیجه/ }),
  ];
  const panel = index => page.locator(`#studio-panel-${index}`);
  const selectedTab = async (index, keyboard = false) => {
    for (let current = 0; current < 3; current += 1) {
      assert.equal(await tabs[current].getAttribute('aria-selected'), String(current === index), stage('selected Studio tab'));
      assert.equal(await tabs[current].getAttribute('tabindex'), current === index ? '0' : '-1', stage('roving tab stop'));
      assert.equal(await tabs[current].getAttribute('aria-controls'), `studio-panel-${current}`);
      assert.equal(await panel(current).isVisible(), current === index, stage('active panel visibility'));
    }
    if (keyboard) await keyboardFocus(tabs[index], 'Studio tab');
    await layout(`Studio tab ${index}`);
  };

  try {
    const anonymous = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/auth/session' && response.status() === 401,
    );
    await page.goto(`${frontendOrigin}/studio/guided`, { waitUntil: 'domcontentloaded' });
    await anonymous;
    await page.getByRole('heading', { name: 'حال‌وهوای شما', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await layout('Guided initial');

    // Real sequential Tab/Enter navigation through the responsive header, without opening API-backed pages.
    const menu = page.getByRole('button', { name: 'باز کردن فهرست', exact: true });
    let navigation;
    if (mobile) {
      await page.getByRole('link', { name: 'سبد خرید', exact: true }).focus();
      await page.keyboard.press('Tab');
      await keyboardFocus(menu, 'mobile menu toggle');
      await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('button', { name: 'بستن فهرست' }).getAttribute('aria-expanded'), 'true');
      navigation = page.getByRole('navigation', { name: 'ناوبری موبایل', exact: true });
      await layout('mobile navigation open');
    } else {
      assert.equal(await menu.isVisible(), false);
      navigation = page.getByRole('navigation', { name: 'ناوبری اصلی', exact: true });
      await page.getByRole('link', { name: 'آرومان، صفحه اصلی', exact: true }).focus();
    }
    const navLabels = [mobile ? 'جستجو و فروشگاه' : 'فروشگاه', 'استودیو خلاق', 'استودیو راهنما'];
    for (const [index, label] of navLabels.entries()) {
      const link = navigation.getByRole('link', { name: label, exact: true });
      await page.keyboard.press('Tab');
      await keyboardFocus(link, label);
      await reachable(link);
      assert.equal(await link.getAttribute('href'), ['/shop', '/studio/creative', '/studio/guided'][index]);
    }
    await page.keyboard.press('Enter');
    if (mobile) assert.equal(await menu.getAttribute('aria-expanded'), 'false');

    const progress = page.getByRole('progressbar', { name: 'پیشرفت استودیوی هدایت‌شده' });
    assert.equal(await progress.getAttribute('aria-valuenow'), '1');
    const continueButton = page.getByRole('button', { name: 'ادامه', exact: true });
    assert.equal(await continueButton.isDisabled(), true, 'Unanswered Guided step must not continue');
    assert.ok((await page.locator('.guided-validation-hint[aria-live="polite"]').textContent()).trim());
    await page.getByRole('heading', { name: 'حال‌وهوای شما', exact: true }).focus();
    await page.keyboard.press('Tab');
    const feeling = page.getByRole('radio', { name: /آرام و آسوده/ });
    await keyboardFocus(feeling, 'Guided feeling radio');
    await page.keyboard.press('Space');
    assert.equal(await feeling.isChecked(), true);
    await next('جهان‌های رایحه');
    await pointerChoice('checkbox', /گلی/);
    await next('دمای حسی');
    await pointerChoice('radio', /نرم و متعادل/);
    await next('یک تصویر برای خیال');
    await pointerChoice('radio', /گوشه‌ای پر از گل/);
    await next('نت‌هایی که به دلتان می‌نشینند');

    const guidedSearch = page.getByRole('searchbox', { name: 'جست‌وجو در نت‌ها', exact: true });
    await page.getByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند', exact: true }).focus();
    await page.keyboard.press('Tab');
    await keyboardFocus(guidedSearch, 'Guided note search');
    await page.keyboard.press('Tab');
    await keyboardFocus(page.getByRole('combobox', { name: 'خانوادهٔ رایحه', exact: true }), 'Guided family filter');
    await guidedSearch.fill('رز');
    const like = page.locator('.guided-note-item').filter({ hasText: 'رز' }).getByRole('button', { name: 'دوست دارم', exact: true });
    await activate(like);
    assert.equal(await like.getAttribute('aria-pressed'), 'true');
    assert.ok((await page.locator('.guided-live-feedback[aria-live="polite"][aria-atomic="true"]').textContent()).includes('رز'));
    await next('بازبینی و میزان کشف');
    await pointerChoice('radio', /کمی آشنا، کمی تازه/);
    const name = `روایت فارسی برای مرور موبایل ${width}`;
    await page.getByRole('textbox', { name: 'برای این تصویر چه نامی دوست دارید؟', exact: true }).fill(name);
    assert.equal(await progress.getAttribute('aria-valuenow'), '6');
    await activate(page.getByRole('button', { name: 'دیدن پیشنهاد من', exact: true }));
    await page.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست', exact: true }).waitFor();
    await layout('Guided result');
    await activate(page.getByRole('button', { name: 'رفتن به استودیوی خلاق', exact: true }));
    await page.waitForURL(`${frontendOrigin}/studio/creative?from=guided`);
    await page.getByRole('status').filter({ hasText: 'پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.' }).waitFor();
    await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor({ state: 'attached' });
    await panel(1).waitFor({ state: 'visible' });
    await layout('Creative imported composition');

    const conceptName = page.getByRole('textbox', { name: 'نام مفهوم', exact: true });
    assert.equal(await conceptName.inputValue(), name);
    const initialCount = await panel(1).locator('.composition-note').count();
    assert.ok(initialCount > 0 && initialCount <= 6);
    await conceptName.fill(`${name}، ویرایش‌شده`);
    await conceptName.focus();
    await page.keyboard.press('Tab');
    const firstRow = panel(1).locator('.composition-note').first();
    const firstId = await firstRow.getAttribute('data-selected-note-id');
    const firstNote = notes.find(note => note.id === firstId);
    assert.ok(firstNote);
    const layer = page.getByRole('combobox', { name: `لایه ${firstNote.name}`, exact: true });
    await keyboardFocus(layer, 'Creative note layer');
    const targetLayer = (await layer.inputValue()) === 'base' ? 'top' : 'base';
    await page.keyboard.press(targetLayer === 'base' ? 'End' : 'Home');
    await page.keyboard.press('Enter');
    assert.equal(await layer.inputValue(), targetLayer, 'Keyboard must change the selected layer');
    await panel(1).locator(`.composition-layer[data-layer="${targetLayer}"] [data-selected-note-id="${firstId}"]`).waitFor();
    // Free one slot, then exercise real note selection without depending on recommendation size.
    await activate(panel(1).locator(`[data-selected-note-id="${firstId}"]`).getByRole('button', { name: 'حذف', exact: true }));
    assert.equal(await panel(1).locator('.composition-note').count(), initialCount - 1);

    if (mobile) {
      await activate(tabs[0]);
      await selectedTab(0);
      for (const [key, index] of [['ArrowLeft', 1], ['ArrowRight', 0], ['End', 2], ['Home', 0], ['ArrowRight', 2], ['ArrowLeft', 0]]) {
        await page.keyboard.press(key);
        await selectedTab(index, true);
      }
      await page.keyboard.press('Tab');
    } else {
      assert.equal(await tablist.isVisible(), false);
      for (let index = 0; index < 3; index += 1) assert.equal(await panel(index).isVisible(), true);
      await page.locator('.studio-save-top').focus();
      await page.keyboard.press('Tab');
    }
    const search = page.getByRole('textbox', { name: 'جستجوی نت', exact: true });
    await keyboardFocus(search, 'Creative note search');
    await page.keyboard.press('Tab');
    const family = page.getByRole('combobox', { name: 'خانواده رایحه', exact: true });
    await keyboardFocus(family, 'Creative family filter');
    const currentIds = await panel(1).locator('.composition-note').evaluateAll(rows => rows.map(row => row.dataset.selectedNoteId));
    const extraNote = notes.find(note => !currentIds.includes(note.id));
    assert.ok(extraNote, 'The synthetic catalog must have an unselected note');
    // Change to a different value, as a native user selection would, and await the actual filtered response.
    await family.selectOption(extraNote.family_id);
    await page.locator('#studio-panel-0[data-note-status="ready"]').waitFor();
    // A visible unselected card avoids duplicating the legacy grid-size/show-more assertions.
    const card = panel(0).locator(`[data-note-id="${extraNote.id}"]`);
    const selectedId = await card.getAttribute('data-note-id');
    assert.ok(notes.some(note => note.id === selectedId));
    await activate(card);
    await page.getByRole('status', { name: `${initialCount} از ۶ نت انتخاب شده`, exact: true }).waitFor();
    assert.equal(await panel(0).locator(`[data-note-id="${selectedId}"]`).getAttribute('aria-pressed'), 'true');
    if (mobile) {
      await activate(panel(0).getByRole('button', { name: /رفتن به ترکیب/ }));
      await selectedTab(1);
    }
    await panel(1).locator(`[data-selected-note-id="${selectedId}"]`).waitFor({ state: 'visible' });
    await layout('Creative note selected');

    // Local validation and dialog checks exercise narrow-width actions without duplicating OTP/Save journeys.
    const save = page.locator('.studio-save-top');
    await conceptName.fill('');
    await activate(save);
    await page.getByRole('alert').filter({ hasText: 'برای مفهوم خود نامی انتخاب کنید.' }).waitFor();
    await conceptName.fill(`${name}، ویرایش‌شده`);
    if (mobile) {
      await activate(tabs[2]);
      await selectedTab(2);
    }
    const previewSave = panel(2).getByRole('button', { name: 'ذخیره مفهوم', exact: false });
    await activate(previewSave);
    const dialog = page.getByRole('dialog', { name: 'ورود برای ذخیره', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    await layout('Save login dialog');
    const close = dialog.getByRole('button', { name: 'بستن', exact: true });
    await page.keyboard.press('Tab');
    await keyboardFocus(close, 'login dialog close');
    await page.keyboard.press('Tab');
    const mobileNumber = dialog.getByRole('textbox', { name: 'شماره موبایل', exact: true });
    await keyboardFocus(mobileNumber, 'labelled mobile input');
    await mobileNumber.fill('09121234567');
    await page.keyboard.press('Tab');
    const challenge = dialog.getByRole('button', { name: 'دریافت کد', exact: true });
    await keyboardFocus(challenge, 'labelled OTP request action');
    await reachable(challenge);
    await page.keyboard.press('Tab');
    await keyboardFocus(close, 'dialog forward focus wrap');
    await page.keyboard.press('Shift+Tab');
    await keyboardFocus(challenge, 'dialog reverse focus wrap');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await previewSave.evaluate(element => document.activeElement === element), true, 'Escape must restore focus to Save');
    await layout('dialog dismissed');

    assert.equal(fixture.conceptCreates, 0, 'Mobile smoke must not create concepts');
    assert.equal(fixture.challengeRequests, 0, 'Mobile smoke must not send OTP requests');
    assert.equal(fixture.verificationRequests, 0);
    assert.deepEqual(fixture.unexpectedApiCalls, []);
    assert.deepEqual(externalRequests, []);
    assertNoBrowserErrors(report, stage('mobile RTL regression'));
    console.log(`${browserEngine} ${width}px PASS: Persian RTL; no page overflow; accessible navigation, Guided controls, transfer, selection/layers, pointer/keyboard tabs, primary actions, labels, live regions, dialog focus; ${fixture.apiRequests.length} synthetic API requests.`);
  } finally {
    await context.close();
  }
}

try {
  for (const width of widths) {
    try { await runViewport(width); }
    catch (error) {
      failures.push(`${width}px: ${error.stack || error}`);
      console.error(failures.at(-1));
    }
  }
  assert.equal(failures.length, 0, `Mobile RTL functional regression failures (all widths attempted):\n${failures.join('\n')}`);
  console.log(`${browserEngine} mobile RTL browser journey${strictAccessibility ? ' (--strict-a11y)' : ''} PASS at ${widths.join(', ')}px; all keyboard-focus checks required and passed. Accessibility smoke only; not a WCAG compliance audit.`);
} finally {
  await browser.close();
}
