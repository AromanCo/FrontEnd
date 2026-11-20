import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { isExpectedAbortedSessionGet, watchPage } from '../scripts/browser-utils.mjs';

const frontend = resolve(import.meta.dirname, '..');
const runner = resolve(frontend, 'scripts/real-stack-runner.mjs');
const source = readFileSync(runner, 'utf8');
const journey = readFileSync(resolve(frontend, 'scripts/f2-concept-journey.mjs'), 'utf8');
const expectedAck = 'f2-isolated-postgres-fakesms-only';

for (const acknowledgment of [undefined, 'yes', 'isolated-postgres-fakesms-only', 'postgres', 'f2-isolated-postgres-fakesms']) {
  test(`F2 runner refuses unapproved execution acknowledgment ${JSON.stringify(acknowledgment)}`, () => {
    const env = { ...process.env };
    delete env.AROMAN_F2_CONCEPT_EPHEMERAL_ACK;
    delete env.AROMAN_F1_ACCOUNT_EPHEMERAL_ACK;
    if (acknowledgment !== undefined) env.AROMAN_F2_CONCEPT_EPHEMERAL_ACK = acknowledgment;
    const result = spawnSync(process.execPath, [runner, 'f2-concepts'], {
      cwd: frontend,
      env,
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /F2 saved-concept rehearsal is separately approval-gated/);
    assert.doesNotMatch(result.stderr + result.stdout, /Docker run|Backend checkout unavailable/);
  });
}

test('F2 runner is pinned to disposable PostgreSQL, private FakeSMS and a distinct approval gate', () => {
  assert.match(source, /mode === 'f2-concepts'/);
  assert.ok(source.includes(expectedAck));
  assert.ok(source.includes('f2ConceptBackendSha'));
  assert.ok(source.includes("'./f2-concept-journey.mjs'"));
  assert.ok(source.includes("'postgres:17'"));
  assert.ok(source.includes("'--tmpfs', '/var/lib/postgresql/data:rw,size=256m'"));
  assert.ok(source.includes("'--publish', '127.0.0.1::5432'"));
  assert.ok(source.includes("'--label', 'aroman.real-stack=test-owned'"));
});

test('F2 acknowledgment cannot bypass exact Backend revision verification', () => {
  const result = spawnSync(process.execPath, [runner, 'f2-concepts'], {
    cwd: frontend,
    env: {
      ...process.env,
      AROMAN_F2_CONCEPT_EPHEMERAL_ACK: expectedAck,
      AROMAN_TEST_BACKEND_DIR: frontend, // Valid Git checkout, deliberately wrong project SHA.
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Backend checkout must be at the pinned SHA/);
  assert.doesNotMatch(result.stderr + result.stdout, /Docker run/);
});

test('F2 mobile Creative reopen reveals Composition and waits for loaded name before editing', () => {
  const reopen = journey.indexOf('const openLink =');
  const tab = journey.indexOf("const compositionTab = page.getByRole('tablist'", reopen);
  const visible = journey.indexOf("await compositionPanel.waitFor({ state: 'visible' });", tab);
  const name = journey.indexOf("const nameField = compositionPanel.getByRole('textbox'", visible);
  const loaded = journey.indexOf('await page.waitForFunction(', name);
  const edit = journey.indexOf('await nameField.fill(editedName);', loaded);
  assert.ok(reopen >= 0 && reopen < tab && tab < visible && visible < name && name < loaded && loaded < edit);
  assert.match(journey.slice(tab, edit), /aria-selected/);
  assert.match(journey.slice(name, edit), /#studio-panel-1 input\[aria-label="نام مفهوم"\]/);
});

test('F2 Guided family selection clicks the visible label card rather than its clipped checkbox', () => {
  const familyStep = journey.indexOf("await continueStep('جهان‌های رایحه');");
  const nextStep = journey.indexOf("await continueStep('دمای حسی');", familyStep);
  assert.ok(familyStep >= 0 && nextStep > familyStep);
  const selection = journey.slice(familyStep, nextStep);
  assert.match(selection, /await selectOption\('checkbox', \/گلی\/\);/);
  assert.doesNotMatch(selection, /\.check\(\{\s*force:\s*true\s*\}\)/);
  assert.match(journey, /control\.locator\('xpath=\.\.'\)\.click\(\)/);
});

test('F2 only tolerates an aborted GET to this run\'s exact auth-session URL', () => {
  const api = 'http://localhost:48912/api/v1';
  const page = new EventEmitter();
  const report = watchPage(page, () => false,
    (request, reason) => isExpectedAbortedSessionGet(request, reason, api));
  const fail = (url, method, errorText) => page.emit('requestfailed', {
    url: () => url,
    method: () => method,
    failure: () => ({ errorText }),
  });

  fail(`${api}/auth/session`, 'GET', 'net::ERR_ABORTED');
  assert.deepEqual(report.errors, [], 'Only the exact cancelled session read may be tolerated');

  fail(`${api}/auth/session`, 'POST', 'net::ERR_ABORTED');
  fail(`${api}/users/me`, 'GET', 'net::ERR_ABORTED');
  fail(`${api}/auth/session`, 'GET', 'net::ERR_CONNECTION_RESET');
  fail('http://localhost:48913/api/v1/auth/session', 'GET', 'net::ERR_ABORTED');
  page.emit('response', { url: () => `${api}/auth/session`, status: () => 500 });
  assert.equal(report.errors.length, 5, 'Mutations, other paths/origins, network errors and HTTP 500 stay fatal');
  assert.match(report.errors[0], /Request failed \(net::ERR_ABORTED\)/);
  assert.match(report.errors[4], /HTTP 500/);
  assert.match(journey, /isExpectedAbortedSessionGet\(request, reason, apiBase\)/);
});
