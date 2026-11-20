import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const frontend = resolve(import.meta.dirname, '..');
const runner = resolve(frontend, 'scripts/real-stack-runner.mjs');
const runnerSource = readFileSync(runner, 'utf8');
const journeySource = readFileSync(resolve(frontend, 'scripts/f3-continuity-journey.mjs'), 'utf8');
const acknowledgment = 'f3-isolated-postgres-fakesms-only';

for (const value of [undefined, 'yes', 'f2-isolated-postgres-fakesms-only', 'isolated-postgres-fakesms-only']) {
  test(`F3 refuses an unapproved one-time acknowledgment ${JSON.stringify(value)}`, () => {
    const env = { ...process.env };
    delete env.AROMAN_F3_CONTINUITY_EPHEMERAL_ACK;
    if (value) env.AROMAN_F3_CONTINUITY_EPHEMERAL_ACK = value;
    const result = spawnSync(process.execPath, [runner, 'f3-continuity'], {
      cwd: frontend, env, encoding: 'utf8', timeout: 5000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /F3 saved-source rehearsal is separately approval-gated/);
    assert.doesNotMatch(result.stderr + result.stdout, /Docker run|Backend checkout unavailable/);
  });
}

test('F3 acknowledgment cannot bypass the exact pinned Backend revision', () => {
  const result = spawnSync(process.execPath, [runner, 'f3-continuity'], {
    cwd: frontend,
    env: {
      ...process.env,
      AROMAN_F3_CONTINUITY_EPHEMERAL_ACK: acknowledgment,
      AROMAN_TEST_BACKEND_DIR: frontend, // Intentionally wrong checkout.
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Backend checkout must be at the pinned SHA/);
  assert.doesNotMatch(result.stderr + result.stdout, /Docker run/);
});

test('F3 remains limited to disposable PG17, loopback, FakeSMS and isolated full-release test scope', () => {
  assert.match(runnerSource, /mode === 'f3-continuity'/);
  assert.ok(runnerSource.includes(acknowledgment));
  assert.match(runnerSource, /\['f2-concepts', 'f3-continuity'\]\.includes\(mode\) \? f2ConceptBackendSha/);
  assert.match(runnerSource, /'f3-continuity'\]\.includes\(mode\) \? 'postgres'/);
  assert.ok(runnerSource.includes("'./f3-continuity-journey.mjs'"));
  for (const invariant of [
    "'postgres:17'", "'--tmpfs', '/var/lib/postgresql/data:rw,size=256m'",
    "'--publish', '127.0.0.1::5432'", "'--label', 'aroman.real-stack=test-owned'",
    "SMS_PROVIDER: 'fake'", "FAKE_SMS_ENABLED: 'true'",
  ]) assert.ok(runnerSource.includes(invariant), `Missing runner safety invariant: ${invariant}`);
});

test('F3 journey compares the saved PostgreSQL original and fork, and never silently writes', () => {
  assert.match(journeySource, /canonicalNotes\(sourceAfter\.notes\), canonicalNotes\(sourceBefore\.notes\)/);
  assert.match(journeySource, /'Original source is unchanged in real PostgreSQL'/);
  assert.match(journeySource, /'Fork transfer must remain in memory until explicit Save'/);
  assert.match(journeySource, /\['POST'\], 'Fork creates exactly one new concept; no source PUT'/);
  assert.match(journeySource, /isExpectedAbortedSessionGet\(request, reason, apiBase\)/);
  assert.doesNotMatch(journeySource, /page\.route\(|route\.fulfill\(/, 'F3 may not mock auth, saved source, or concept writes');
});
