import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { backendSha } from './backend-pin.mjs';

const frontend = resolve(import.meta.dirname, '..');
const backend = resolve(process.env.AROMAN_TEST_BACKEND_DIR || join(frontend, '..', 'Backend'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' });
assert.equal(revision.status, 0, `Backend checkout unavailable: ${revision.stderr}`);
assert.equal(revision.stdout.trim(), backendSha, 'Backend checkout must be at the pinned SHA');

const tsconfigPath = join(frontend, 'tsconfig.json');
const originalTsconfig = await readFile(tsconfigPath, 'utf8');
const children = [];
const python = process.env.AROMAN_TEST_PYTHON || 'python3.12';
const reservePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolvePort(port));
  });
});
const apiPort = await reservePort();
const frontendPort = await reservePort();
const temp = await mkdtemp(join(tmpdir(), 'aroman-real-stack-'));
const nextDist = `.next-real-stack-${randomBytes(6).toString('hex')}`;
const apiOrigin = `http://localhost:${apiPort}`;
const frontendOrigin = `http://localhost:${frontendPort}`;
const socket = join(temp, 'otp.sock');
const env = {
  ...process.env,
  ENVIRONMENT: 'test',
  DATABASE_URL: `sqlite:///${join(temp, 'test.sqlite3')}`,
  OTP_PEPPER: randomBytes(32).toString('hex'),
  SESSION_PEPPER: randomBytes(32).toString('hex'),
  SMS_PROVIDER: 'fake',
  FAKE_SMS_ENABLED: 'true',
  COOKIE_SECURE: 'false',
  CORS_ORIGINS: frontendOrigin,
  AROMAN_TEST_OTP_SOCKET: socket,
  AROMAN_TEST_API_PORT: String(apiPort),
  NEXT_PUBLIC_AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
  AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
  FRONTEND_ORIGIN: frontendOrigin,
  AROMAN_BROWSER_API_BASE_URL: `${apiOrigin}/api/v1`,
  PYTHONPATH: backend,
  AROMAN_TEST_NEXT_DIST_DIR: nextDist,
};

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
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
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void cleanup().finally(() => process.exit(128)); });

try {
  run(python, ['-m', 'alembic', 'upgrade', 'head'], backend);
  run(python, ['-m', 'aroman.seed'], backend);
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
  await cleanup();
}
