import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backendSha } from './backend-pin.mjs';

const frontend = resolve(import.meta.dirname, '..');
const backend = resolve(process.env.AROMAN_TEST_BACKEND_DIR || join(frontend, '..', 'Backend'));
const python = process.env.AROMAN_TEST_PYTHON || 'python3.12';
const pythonVersion = spawnSync(python, ['--version'], { encoding: 'utf8' });
assert.equal(pythonVersion.status, 0, `Python 3.12 unavailable: ${pythonVersion.error?.message || pythonVersion.stderr}`);
assert.match(`${pythonVersion.stdout}${pythonVersion.stderr}`, /^Python 3\.12\./, `Python 3.12 required, found ${pythonVersion.stdout || pythonVersion.stderr}`);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' });
assert.equal(revision.status, 0, `Backend checkout unavailable: ${revision.stderr}`);
assert.equal(revision.stdout.trim(), backendSha, `Backend checkout must be at pinned SHA ${backendSha}`);

const temp = await mkdtemp(join(tmpdir(), 'aroman-exploration-real-stack-'));
const distDir = `.next-exploration-real-stack-${randomBytes(8).toString('hex')}`;
const tsconfigPath = join(frontend, 'tsconfig.json');
const originalTsconfig = await readFile(tsconfigPath, 'utf8');
const children = [];
const processDiagnostics = [];
let apiOrigin;
let frontendOrigin;
let cleaning;
let failed = false;
let ownsDist = false;
const envBase = { ...process.env, PYTHONPATH: backend, PYTHONDONTWRITEBYTECODE: '1', NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(envBase)) if (/^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)) delete envBase[key];
function redact(value, env = envBase) {
  let safe = String(value || '');
  for (const [key, secret] of Object.entries(env)) {
    if (secret && /SECRET|PASSWORD|PEPPER|TOKEN|CREDENTIAL|DATABASE_URL/i.test(key)) safe = safe.split(String(secret)).join('[REDACTED]');
  }
  return safe;
}
const reservePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolvePort(port));
  });
});
function run(command, args, cwd, env = envBase) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 300000 });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${redact(result.error?.message || result.stderr || result.stdout, env)}`);
  return result.stdout;
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.once('error', error => { child.spawnError = error.message; log = redact(`${log}\n${error.message}`, env); });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log = redact((log + chunk.toString()).slice(-10000), env); });
  children.push(child);
  const info = { child, diagnostics: () => log, error: () => child.spawnError };
  processDiagnostics.push(info);
  return info;
}
async function waitFor(url, processInfo) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (processInfo.error() || processInfo.child.exitCode !== null || processInfo.child.signalCode !== null) throw new Error(`Server exited before readiness: ${processInfo.diagnostics()}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (response.ok) return response; } catch { /* readiness probe retries */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Server readiness timed out: ${url}\n${processInfo.diagnostics()}`);
}
async function cleanup() {
  const failures = [];
  for (const child of [...children].reverse()) if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* exited */ } }
  await Promise.all(children.map(child => new Promise(resolveDone => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return resolveDone();
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* exited */ } }, 3000);
    timer.unref();
    child.once('exit', () => { clearTimeout(timer); resolveDone(); });
  })));
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, 0);
      process.kill(-child.pid, 'SIGKILL');
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
      try { process.kill(-child.pid, 0); failures.push(`Runner-owned process group ${child.pid} remained after cleanup`); }
      catch (error) { if (error.code !== 'ESRCH') failures.push(`Could not verify process group ${child.pid} cleanup: ${error.message}`); }
    } catch (error) {
      if (error.code !== 'ESRCH') failures.push(`Could not inspect process group ${child.pid}: ${error.message}`);
    }
  }
  if (ownsDist) await rm(join(frontend, distDir), { recursive: true, force: true });
  await rm(temp, { recursive: true, force: true });
  const currentTsconfig = await readFile(tsconfigPath, 'utf8');
  if (currentTsconfig !== originalTsconfig) {
    const current = JSON.parse(currentTsconfig);
    const original = JSON.parse(originalTsconfig);
    current.include = current.include.filter(entry => !entry.startsWith(`${distDir}/`));
    if (JSON.stringify(current) !== JSON.stringify(original)) throw new Error('Next.js changed tsconfig.json beyond its temporary build entries; preserving the modified file for review');
    await writeFile(tsconfigPath, originalTsconfig);
  }
  if (failures.length) throw new Error(failures.join('\n'));
}
function cleanupOnce() { return cleaning ??= cleanup(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void cleanupOnce().catch(error => console.error(`Cleanup failed: ${error.message}`)).finally(() => process.exit(128));
});

try {
  const apiPort = await reservePort();
  const frontendPort = await reservePort();
  apiOrigin = `http://127.0.0.1:${apiPort}`;
  frontendOrigin = `http://127.0.0.1:${frontendPort}`;
  const databasePath = join(temp, 'exploration.sqlite3');
  await mkdir(join(frontend, distDir)); // Claim this unique build directory before Next.js writes to it.
  ownsDist = true;
  const env = {
    ...envBase,
    ENVIRONMENT: 'test', DATABASE_URL: `sqlite:///${databasePath}`,
    CORS_ORIGINS: frontendOrigin, OTP_PEPPER: randomBytes(32).toString('hex'),
    SESSION_PEPPER: randomBytes(32).toString('hex'), SMS_PROVIDER: 'unconfigured',
    FAKE_SMS_ENABLED: 'false', COOKIE_SECURE: 'false',
    AROMAN_RELEASE_SCOPE: 'full', AROMAN_TEST_NEXT_DIST_DIR: distDir,
    AROMAN_TEST_DB_MODE: 'sqlite', AROMAN_TEST_FRONTEND_ORIGIN: frontendOrigin,
    AROMAN_TEST_API_ORIGIN: apiOrigin,
    NEXT_PUBLIC_AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    FRONTEND_ORIGIN: frontendOrigin,
    AROMAN_BROWSER_API_BASE_URL: `${apiOrigin}/api/v1`,
  };
  run(python, [join(frontend, 'scripts/exploration-real-stack-db-check.py'), 'before'], backend, env);
  run(python, ['-m', 'alembic', 'upgrade', 'head'], backend, env);
  run(python, ['-m', 'aroman.seed'], backend, env);
  run(python, [join(frontend, 'scripts/exploration-real-stack-db-check.py'), 'after'], backend, env);
  run(join(frontend, 'node_modules/.bin/next'), ['build'], frontend, env);

  const api = start(python, ['-m', 'uvicorn', 'aroman.exploration_api:app', '--host', '127.0.0.1', '--port', String(apiPort)], backend, env);
  await waitFor(`${apiOrigin}/api/v1/fragrance-families`, api);
  const next = start(join(frontend, 'node_modules/.bin/next'), ['start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], frontend, {
    ...env, AROMAN_RELEASE_SCOPE: 'exploration', AROMAN_TEST_NEXT_DIST_DIR: distDir,
  });
  await waitFor(frontendOrigin, next);
  Object.assign(process.env, env, { AROMAN_RELEASE_SCOPE: 'exploration' });
  const { runExplorationJourney } = await import('./exploration-real-stack-journey.mjs');
  const browserCalls = await runExplorationJourney({ apiOrigin, frontendOrigin });
  for (const call of new Set(browserCalls)) {
    assert.ok(api.diagnostics().includes(`"${call}`), `Restricted API process did not log browser request ${call}`);
  }
  console.log('PASS private exploration real-stack browser gate: restricted ASGI app and compiled Next.js, loopback only.');
} catch (error) {
  failed = true;
  console.error(`Exploration real-stack failed: ${error instanceof Error ? error.message : error}`);
  for (const info of processDiagnostics) if (info.diagnostics()) console.error(`Redacted server diagnostics:\n${info.diagnostics()}`);
  for (const child of children) {
    if (child.spawnError) console.error(`Child could not start: ${child.spawnError}`);
    else if (child.exitCode !== null && child.exitCode !== 0) console.error(`Child exited ${child.exitCode}: ${child.spawnargs?.join(' ')}`);
  }
  process.exitCode = 1;
} finally {
  try { await cleanupOnce(); } catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
  if (!failed && children.some(child => child.exitCode === null && child.signalCode === null)) process.exitCode = 1;
}
