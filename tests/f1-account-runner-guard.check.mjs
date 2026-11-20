import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

const frontend = resolve(import.meta.dirname, '..');

test('F1 logout waits for the account login link, not the duplicated header link', () => {
  const journey = readFileSync(resolve(frontend, 'scripts/f1-account-journey.mjs'), 'utf8');
  assert.match(journey, /page\.locator\('#main'\)\.getByRole\('link', \{ name: 'ورود', exact: true \}\)\.waitFor\(\)/);
  assert.doesNotMatch(journey, /page\.getByRole\('link', \{ name: 'ورود', exact: true \}\)\.waitFor\(\)/);
});

for (const supplied of [undefined, 'yes', 'postgres', 'isolated-postgres-fakesms']) {
  test(`F1 account runner refuses unapproved execution acknowledgment ${JSON.stringify(supplied)}`, () => {
    const env = { ...process.env };
    if (supplied === undefined) delete env.AROMAN_F1_ACCOUNT_EPHEMERAL_ACK;
    else env.AROMAN_F1_ACCOUNT_EPHEMERAL_ACK = supplied;
    const result = spawnSync(process.execPath, ['scripts/real-stack-runner.mjs', 'f1-account'], {
      cwd: frontend, env, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /F1 account rehearsal is separately approval-gated/);
    assert.doesNotMatch(result.stderr, /Docker run|alembic upgrade|postgresql:\/\//);
  });
}
