import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTestContainerId, cleanupTestContainer } from '../scripts/real-stack-container-cleanup.mjs';

const id = 'a'.repeat(64);
const present = () => ({ status: 0, stdout: JSON.stringify([{ Id: id }]), stderr: '' });
const absent = () => ({ status: 1, stdout: '', stderr: `Error: No such object: ${id}` });
const ok = () => ({ status: 0, stdout: '', stderr: '' });
const failed = (stderr = 'Docker operation failed') => ({ status: 1, stdout: '', stderr });

function mockDocker(results) {
  const calls = [];
  return {
    calls,
    run(args, allowFailure) {
      calls.push({ args, allowFailure });
      const result = results.shift();
      assert.ok(result, `unexpected Docker call: ${args.join(' ')}`);
      return result;
    },
  };
}

function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async milliseconds => { current += milliseconds; },
    current: () => current,
  };
}

test('accepts immediate removal after stopping the exact test container', async () => {
  const mock = mockDocker([present(), ok(), absent()]);
  await cleanupTestContainer({ containerId: id, docker: mock.run });
  assert.deepEqual(mock.calls.map(call => call.args), [
    ['inspect', id], ['stop', '--time', '3', id], ['inspect', id],
  ]);
  assert.ok(mock.calls.every(call => call.allowFailure === true));
});

test('polls briefly until --rm removal becomes visible', async () => {
  const mock = mockDocker([present(), ok(), present(), present(), absent()]);
  const clock = fakeClock();
  await cleanupTestContainer({ containerId: id, docker: mock.run, timeoutMs: 500, pollIntervalMs: 100, ...clock });
  assert.equal(clock.current(), 200);
  assert.equal(mock.calls.filter(call => call.args[0] === 'inspect').length, 4);
});

test('fails closed when the exact container remains after the polling deadline', async () => {
  const mock = mockDocker([present(), ok(), present(), present(), present()]);
  const clock = fakeClock();
  await assert.rejects(
    cleanupTestContainer({ containerId: id, docker: mock.run, timeoutMs: 200, pollIntervalMs: 100, ...clock }),
    /remained present after the cleanup deadline/,
  );
  assert.equal(clock.current(), 200);
  assert.equal(mock.calls.filter(call => call.args[0] === 'inspect').length, 4);
});

test('rejects cleanup timing values above the enforced five-second maximum', async () => {
  const mock = mockDocker([]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run, timeoutMs: 5001 }), /timing configuration is invalid/);
  assert.equal(mock.calls.length, 0);
});

test('fails closed when initial Docker inspection is unavailable', async () => {
  const mock = mockDocker([{ status: null, error: new Error('timeout'), stderr: '', stdout: '' }]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /inspection was unavailable/);
  assert.equal(mock.calls.length, 1);
});

test('does not treat unexpected inspection errors as container absence', async () => {
  const mock = mockDocker([failed('permission denied')]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /inspection failed/);
  assert.equal(mock.calls.length, 1);
});

test('empty, malformed, and mismatched successful inspect output fail closed', async () => {
  for (const stdout of ['', '{malformed', JSON.stringify([{ Id: 'b'.repeat(64) }])]) {
    const mock = mockDocker([{ status: 0, stdout, stderr: '' }]);
    await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /inspection (?:returned malformed output|did not confirm)/);
    assert.equal(mock.calls.length, 1);
  }
});

test('only an exact recognized absent-container response verifies removal', async () => {
  const mock = mockDocker([{ status: 1, stdout: '', stderr: `Error: No such object: ${'b'.repeat(64)}` }]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /inspection failed/);
});

test('does not ignore Docker stop failure even when forced removal is verified', async () => {
  const mock = mockDocker([present(), failed('stop failed'), ok(), absent()]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /Docker stop failed/);
  assert.deepEqual(mock.calls.map(call => call.args), [
    ['inspect', id], ['stop', '--time', '3', id], ['rm', '--force', id], ['inspect', id],
  ]);
});

test('fails closed when Docker forced removal fails', async () => {
  const mock = mockDocker([present(), failed('stop failed'), failed('remove failed')]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /stop and forced removal failed/);
  assert.equal(mock.calls.length, 3);
});

test('missing identity is a no-op and invalid identity is rejected before Docker access', async () => {
  const mock = mockDocker([]);
  await cleanupTestContainer({ docker: mock.run });
  await cleanupTestContainer({ containerId: null, docker: mock.run });
  await assert.rejects(cleanupTestContainer({ containerId: 'aroman-real-stack-name', docker: mock.run }), /identity is invalid/);
  assert.equal(mock.calls.length, 0);
});

test('partial Docker startup can recover its exact ID from the per-run cidfile', async () => {
  const partialStart = { status: null, error: new Error('CLI timeout'), stdout: '' };
  const recoveredId = captureTestContainerId(partialStart, `${id}\n`);
  assert.equal(recoveredId, id);
  const mock = mockDocker([present(), ok(), absent()]);
  await cleanupTestContainer({ containerId: recoveredId, docker: mock.run });
  assert.ok(mock.calls.every(call => call.args.includes(id)));
});

test('conflicting or malformed cidfile identities cannot be used for cleanup', async () => {
  assert.throws(() => captureTestContainerId({ stdout: id }, 'not-a-container-id'), /cidfile did not contain/);
  assert.throws(() => captureTestContainerId({ stdout: id }, 'b'.repeat(64)), /conflicting test container identities/);
  assert.throws(() => captureTestContainerId({ status: 1, stdout: '', stderr: `No such object: ${id}` }), /did not provide a test container identity/);
});

test('cleanup can be called more than once without repeating stop or removal', async () => {
  const mock = mockDocker([present(), ok(), absent(), absent()]);
  await cleanupTestContainer({ containerId: id, docker: mock.run });
  await cleanupTestContainer({ containerId: id, docker: mock.run });
  assert.equal(mock.calls.filter(call => call.args[0] === 'stop').length, 1);
  assert.equal(mock.calls.filter(call => call.args[0] === 'rm').length, 0);
});

test('all Docker operations target only the validated test container ID', async () => {
  const unrelatedId = 'b'.repeat(64);
  const mock = mockDocker([present(), failed('stop failed'), ok(), absent()]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), /Docker stop failed/);
  for (const { args } of mock.calls) {
    assert.ok(args.includes(id));
    assert.ok(!args.includes(unrelatedId));
  }
});

test('cleanup errors do not echo database URLs or Docker diagnostic contents', async () => {
  const secretUrl = 'postgresql://test-user:synthetic-password@127.0.0.1/testdb';
  const mock = mockDocker([present(), failed(secretUrl), failed(secretUrl)]);
  await assert.rejects(cleanupTestContainer({ containerId: id, docker: mock.run }), error => {
    assert.match(error.message, /forced removal failed/);
    assert.ok(!error.message.includes(secretUrl));
    assert.ok(!error.message.includes('synthetic-password'));
    return true;
  });
});
