import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const frontend = resolve(import.meta.dirname, '..');
const runner = resolve(frontend, 'scripts/real-stack-runner.mjs');
const ack = 'f5-isolated-postgres-fakesms-only';

function runGuard(value) {
  const env = {
    ...process.env,
    AROMAN_TEST_BACKEND_DIR: frontend,
    AROMAN_F3_CONTINUITY_EPHEMERAL_ACK: 'f3-isolated-postgres-fakesms-only',
  };
  delete env.AROMAN_F5_MVP_EPHEMERAL_ACK;
  if (value !== undefined) env.AROMAN_F5_MVP_EPHEMERAL_ACK = value;
  const result = spawnSync(process.execPath, [runner, 'f5-mvp'], {
    cwd: frontend, env, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  return result.stderr + result.stdout;
}

for (const value of [undefined, 'yes', 'f3-isolated-postgres-fakesms-only']) {
  test('F5 rejects acknowledgment ' + JSON.stringify(value) + ' before Backend or Docker access', () => {
    const output = runGuard(value);
    assert.match(output, /F5 MVP rehearsal is separately approval-gated/);
    assert.doesNotMatch(output, /Docker run|Backend checkout must be at the pinned SHA/);
  });
}

test('F5 acknowledgment cannot override the exact Backend pin', () => {
  const output = runGuard(ack);
  assert.match(output, /Backend checkout must be at the pinned SHA/);
  assert.doesNotMatch(output, /Docker run/);
});
