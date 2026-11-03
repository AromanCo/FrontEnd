const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/;
const MAX_REMOVAL_WAIT_MS = 5000;

export function isTestContainerId(value) {
  return typeof value === 'string' && CONTAINER_ID_PATTERN.test(value);
}

export function captureTestContainerId(runResult, cidFileContents = '') {
  const stdoutId = typeof runResult?.stdout === 'string' ? runResult.stdout.trim() : '';
  const cidFileId = typeof cidFileContents === 'string' ? cidFileContents.trim() : '';
  const stdoutIsId = isTestContainerId(stdoutId);
  const cidFileIsId = isTestContainerId(cidFileId);
  if (cidFileId && !cidFileIsId) throw new Error('Docker run cidfile did not contain a valid test container identity.');
  if (stdoutIsId && cidFileIsId && stdoutId !== cidFileId) {
    throw new Error('Docker run returned conflicting test container identities.');
  }
  const id = cidFileIsId ? cidFileId : stdoutIsId ? stdoutId : '';
  if (!id) throw new Error('Docker run did not provide a test container identity; cleanup cannot safely target a container.');
  return id;
}

function inspectState(result, containerId) {
  if (!result || result.error || typeof result.status !== 'number') {
    throw new Error('Docker inspection was unavailable during test container cleanup.');
  }
  if (result.status === 0) {
    let inspected;
    try { inspected = JSON.parse(result.stdout); } catch { throw new Error('Docker inspection returned malformed output during test container cleanup.'); }
    if (!Array.isArray(inspected) || inspected.length !== 1 || inspected[0]?.Id !== containerId) {
      throw new Error('Docker inspection did not confirm the exact test container identity.');
    }
    return 'present';
  }

  const output = typeof result.stderr === 'string' ? result.stderr.trim() : '';
  const escapedId = containerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^Error: No such (?:object|container): ${escapedId}$`, 'i').test(output)) return 'absent';
  throw new Error('Docker inspection failed during test container cleanup.');
}

function commandFailed(result) {
  return !result || Boolean(result.error) || result.status !== 0;
}

async function waitForRemoval({ containerId, docker, timeoutMs, pollIntervalMs, now, sleep }) {
  const deadline = now() + timeoutMs;
  while (true) {
    if (inspectState(docker(['inspect', containerId], true), containerId) === 'absent') return;
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(pollIntervalMs, remaining));
  }
  throw new Error('Test PostgreSQL container remained present after the cleanup deadline.');
}

export async function cleanupTestContainer({
  containerId,
  docker,
  timeoutMs = 5000,
  pollIntervalMs = 100,
  now = () => performance.now(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
} = {}) {
  if (containerId === undefined || containerId === null || containerId === '') return;
  if (!isTestContainerId(containerId)) {
    throw new Error('Test PostgreSQL container identity is invalid.');
  }
  if (typeof docker !== 'function') throw new Error('Docker cleanup operation is unavailable.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > MAX_REMOVAL_WAIT_MS
    || !Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0 || pollIntervalMs > MAX_REMOVAL_WAIT_MS) {
    throw new Error('Test PostgreSQL cleanup timing configuration is invalid.');
  }

  if (inspectState(docker(['inspect', containerId], true), containerId) === 'absent') return;

  const stopped = docker(['stop', '--time', '3', containerId], true);
  if (commandFailed(stopped)) {
    const removed = docker(['rm', '--force', containerId], true);
    if (commandFailed(removed)) {
      throw new Error('Docker stop and forced removal failed for the test PostgreSQL container.');
    }
    await waitForRemoval({ containerId, docker, timeoutMs, pollIntervalMs, now, sleep });
    throw new Error('Docker stop failed; forced removal was verified for the test PostgreSQL container.');
  }

  await waitForRemoval({ containerId, docker, timeoutMs, pollIntervalMs, now, sleep });
}
