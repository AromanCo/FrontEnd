import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { backendSha } from './backend-pin.mjs';

const frontend = resolve(import.meta.dirname, '..');
const mode = process.argv[2] || 'sqlite';
assert.ok(['sqlite', 'postgres'].includes(mode) && process.argv.length <= 3, 'Usage: real-stack-runner.mjs [sqlite|postgres]');
const backend = resolve(process.env.AROMAN_TEST_BACKEND_DIR || join(frontend, '..', 'Backend'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' });
assert.equal(revision.status, 0, `Backend checkout unavailable: ${revision.stderr}`);
assert.equal(revision.stdout.trim(), backendSha, 'Backend checkout must be at the pinned SHA');

const tsconfigPath = join(frontend, 'tsconfig.json');
const originalTsconfig = await readFile(tsconfigPath, 'utf8');
const children = [];
let containerId;
const python = process.env.AROMAN_TEST_PYTHON || 'python3.12';
const reservePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolvePort(port));
  });
});
const temp = await mkdtemp(join(tmpdir(), 'aroman-real-stack-'));
const nextDist = `.next-real-stack-${randomBytes(6).toString('hex')}`;
let env;
function makeEnv(apiPort, frontendPort, databaseUrl, postgres = null) {
  const apiOrigin = `http://localhost:${apiPort}`;
  const frontendOrigin = `http://localhost:${frontendPort}`;
  return {
    ...process.env,
    ENVIRONMENT: 'test',
    DATABASE_URL: databaseUrl,
    OTP_PEPPER: randomBytes(32).toString('hex'),
    SESSION_PEPPER: randomBytes(32).toString('hex'),
    SMS_PROVIDER: 'fake',
    FAKE_SMS_ENABLED: 'true',
    COOKIE_SECURE: 'false',
    CORS_ORIGINS: frontendOrigin,
    AROMAN_TEST_OTP_SOCKET: join(temp, 'otp.sock'),
    AROMAN_TEST_API_PORT: String(apiPort),
    NEXT_PUBLIC_AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    FRONTEND_ORIGIN: frontendOrigin,
    AROMAN_BROWSER_API_BASE_URL: `${apiOrigin}/api/v1`,
    PYTHONPATH: backend,
    AROMAN_TEST_NEXT_DIST_DIR: nextDist,
    AROMAN_TEST_DB_MODE: mode,
    AROMAN_TEST_DB_USER: postgres?.user || '',
    AROMAN_TEST_DB_NAME: postgres?.database || '',
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.error?.message || result.stderr || result.stdout}`);
  if (args[0].endsWith('real-stack-db-check.py')) console.log(result.stdout.trim());
}
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { cwd: frontend, encoding: 'utf8', timeout: args[0] === 'run' ? 120000 : 30000 });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`Docker ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result;
}
async function isolatedPostgres() {
  const nonce = randomBytes(10).toString('hex');
  const user = `aroman_test_${nonce}`;
  const database = `aroman_test_${nonce}`;
  const password = randomBytes(32).toString('hex');
  containerId = `aroman-real-stack-${nonce}`;
  try {
    const startedId = docker(['run', '--detach', '--rm', '--name', containerId,
      '--label', 'aroman.real-stack=test-owned', '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/data:rw,size=256m',
      '--env', `POSTGRES_USER=${user}`, '--env', `POSTGRES_PASSWORD=${password}`,
      '--env', `POSTGRES_DB=${database}`, 'postgres:17']).stdout.trim();
    assert.match(startedId, /^[a-f0-9]{64}$/, 'Docker did not return a container ID');
    containerId = startedId;
  } catch (error) {
    throw new Error(`Isolated PostgreSQL container unavailable: ${error.message}`);
  }
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (docker(['inspect', '--format', '{{.State.Running}}', containerId]).stdout.trim() !== 'true') {
      throw new Error('Isolated PostgreSQL container exited during startup');
    }
    if (docker(['exec', containerId, 'pg_isready', '-h', '127.0.0.1', '-U', user, '-d', database], true).status === 0) {
      const binding = docker(['port', containerId, '5432/tcp']).stdout.trim();
      const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);
      assert.ok(match, `PostgreSQL port is not exclusively bound to loopback: ${binding}`);
      return { url: `postgresql+psycopg://${user}:${password}@127.0.0.1:${match[1]}/${database}?connect_timeout=3`, user, database };
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Isolated PostgreSQL container did not become ready within 90 seconds');
}
function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let diagnostics = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    diagnostics = (diagnostics + chunk.toString()).slice(-6000);
  });
  children.push(child);
  return { child, diagnostics: () => diagnostics };
}
async function ready(url, processInfo) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null || processInfo.child.signalCode !== null) {
      throw new Error(`Server exited during startup:\n${processInfo.diagnostics()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch { /* Startup is in progress. */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready: ${url}\n${processInfo.diagnostics()}`);
}
async function cleanup() {
  const failures = [];
  for (const child of children.reverse()) {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    }
  }
  await Promise.all(children.map(child => new Promise(resolveDone => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveDone();
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }, 3000);
    timer.unref();
    child.once('exit', () => { clearTimeout(timer); resolveDone(); });
  })));
  if (containerId) {
    const initial = docker(['inspect', containerId], true);
    if (initial.error) failures.push(`Could not verify test container cleanup: ${initial.error.message}`);
    else if (initial.status !== 0 && !initial.stderr.toLowerCase().includes('no such object')) {
      failures.push(`Could not inspect test container during cleanup: ${initial.stderr}`);
    }
    if (initial.status === 0) {
      const stopped = docker(['stop', '--time', '3', containerId], true);
      if (stopped.status !== 0) {
        const removed = docker(['rm', '--force', containerId], true);
        if (removed.status !== 0) failures.push(`Docker cleanup failed: ${stopped.stderr}; ${removed.stderr}`);
      }
      const inspection = docker(['inspect', containerId], true);
      if (inspection.status === 0 || inspection.error || !inspection.stderr.toLowerCase().includes('no such object')) {
        failures.push(`Test PostgreSQL container removal could not be verified: ${containerId}`);
      }
    }
  }
  await rm(temp, { recursive: true, force: true });
  await rm(join(frontend, nextDist), { recursive: true, force: true });
  const currentTsconfig = await readFile(tsconfigPath, 'utf8');
  if (currentTsconfig !== originalTsconfig) {
    const current = JSON.parse(currentTsconfig);
    const original = JSON.parse(originalTsconfig);
    current.include = current.include.filter(entry => !entry.startsWith(`${nextDist}/`));
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      throw new Error('Next.js changed tsconfig.json beyond the temporary build entries');
    }
    await writeFile(tsconfigPath, originalTsconfig);
  }
  if (failures.length) throw new Error(failures.join('\n'));
}
let cleaning;
function cleanOnce() { return cleaning ??= cleanup(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void cleanOnce().catch(error => console.error(error)).finally(() => process.exit(128));
});

try {
  const apiPort = await reservePort();
  const frontendPort = await reservePort();
  const postgres = mode === 'postgres' ? await isolatedPostgres() : null;
  env = makeEnv(apiPort, frontendPort, postgres?.url || `sqlite:///${join(temp, 'test.sqlite3')}`, postgres);
  run(python, [join(frontend, 'scripts', 'real-stack-db-check.py'), 'before'], backend);
  run(python, ['-m', 'alembic', 'upgrade', 'head'], backend);
  run(python, ['-m', 'aroman.seed'], backend);
  run(python, [join(frontend, 'scripts', 'real-stack-db-check.py'), 'after'], backend);
  const api = start(python, [join(frontend, 'scripts', 'real-stack-api.py')], backend);
  await ready(`http://127.0.0.1:${apiPort}/health/ready`, api);
  const next = start(join(frontend, 'node_modules', '.bin', 'next'), ['dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)], frontend);
  await ready(`http://127.0.0.1:${frontendPort}/studio/guided`, next);
  Object.assign(process.env, env);
  await import('./real-stack-journey.mjs');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try { await cleanOnce(); } catch (error) { console.error(error); process.exitCode = 1; }
}
