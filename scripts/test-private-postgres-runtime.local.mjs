#!/usr/bin/env node
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const image = 'postgres:16-alpine';
const name = `m6a27-postgres-runtime-${process.pid}`;
const syntheticPasswords = {
  database_bootstrap_password: 'SyntheticBootstrapM6A27Only00000000000000000001',
  catalog_migration_password: 'SyntheticMigratorM6A27Only000000000000000000001',
  catalog_runtime_password: 'SyntheticRuntimeM6A27Only0000000000000000000001',
};
const run = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

function waitForHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = run(['inspect', '--format', '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', name]).trim();
      if (status.endsWith('|healthy')) return;
      if (status.startsWith('exited|')) {
        const logResult = spawnSync('docker', ['logs', '--tail', '40', name], { encoding: 'utf8' });
        let logs = `${logResult.stdout || ''}${logResult.stderr || ''}`;
        for (const value of Object.values(syntheticPasswords)) logs = logs.replaceAll(value, '[REDACTED]');
        const tail = logs.split('\n').filter(Boolean).slice(-25).join(' | ');
        throw new Error(`PostgreSQL exited before becoming healthy${tail ? `: ${tail}` : '.'}`);
      }
    } catch (error) {
      if (/exited before|No such container/.test(error.message)) throw new Error(`PostgreSQL test container exited before becoming healthy: ${error.message}`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error('PostgreSQL did not become healthy before timeout.');
}

export function testPostgresRuntime() {
  try { run(['image', 'inspect', image]); }
  catch { throw new Error(`${image} is not cached; refusing to pull an image for this local database check.`); }
  const tempRoot = mkdtempSync(join(tmpdir(), 'aroman-a27-postgres-check-'));
  const secretDir = join(tempRoot, 'secrets');
  const groupFile = join(tempRoot, 'postgres-group');
  mkdirSync(secretDir, { mode: 0o700 });
  const databaseDir = resolve(join(import.meta.dirname, '../deploy/private-preproduction'));
  let started = false;
  try {
    chmodSync(secretDir, 0o700);
    for (const [secret, value] of Object.entries(syntheticPasswords)) writeFileSync(join(secretDir, secret), `${value}\n`, { mode: 0o600 });
    const baseGroups = run(['run', '--rm', '--network', 'none', image, 'cat', '/etc/group']);
    const groupLines = baseGroups.trimEnd().split('\n');
    const groupIndex = groupLines.findIndex(line => line.split(':')[2] === '10001');
    if (groupIndex < 0) groupLines.push('aroman_secret_readers:x:10001:postgres');
    else {
      const fields = groupLines[groupIndex].split(':');
      const members = fields[3] ? fields[3].split(',') : [];
      if (!members.includes('postgres')) members.push('postgres');
      fields[3] = members.join(',');
      groupLines[groupIndex] = fields.join(':');
    }
    writeFileSync(groupFile, `${groupLines.join('\n')}\n`, { mode: 0o644 });
    run(['run', '--rm', '--network', 'none', '--user', '0:0', '-v', `${resolve(secretDir)}:/synthetic-secrets`, 'node:24-alpine',
      'sh', '-ec', `chown 0:0 /synthetic-secrets && chmod 0700 /synthetic-secrets && for f in ${Object.keys(syntheticPasswords).join(' ')}; do chown 0:10001 /synthetic-secrets/$f; chmod 0440 /synthetic-secrets/$f; done`]);
    const mountSecret = secret => ['--mount', `type=bind,src=${join(secretDir, secret)},dst=/run/secrets/${secret},readonly`];
    const args = ['run', '-d', '--name', name, '--network', 'none', '--read-only', '--restart', 'on-failure:3',
      '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'DAC_READ_SEARCH', '--cap-add', 'SETGID', '--cap-add', 'SETUID',
      '--security-opt', 'no-new-privileges:true', '--pids-limit', '128', '--cpus', '0.50', '--memory', '768m',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m,mode=1777', '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=16m,mode=3775',
      '--volume', '/var/lib/postgresql/data',
      '--health-cmd', 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
      '--health-interval', '2s', '--health-timeout', '5s', '--health-retries', '5', '--health-start-period', '30s',
      '-e', 'POSTGRES_DB=aroman', '-e', 'POSTGRES_USER=aroman_bootstrap', '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/database_bootstrap_password',
      ...mountSecret('database_bootstrap_password'), ...mountSecret('catalog_migration_password'), ...mountSecret('catalog_runtime_password'),
      '--mount', `type=bind,src=${groupFile},dst=/etc/group,readonly`,
      '--mount', `type=bind,src=${join(databaseDir, 'database-role-init.sh')},dst=/docker-entrypoint-initdb.d/10-aroman-role-init.sh,readonly`, image];
    run(args);
    started = true;
    waitForHealth();
    console.log('PASS fresh anonymous PostgreSQL volume initialized and healthcheck passed');
    const effectiveUid = run(['exec', name, 'sh', '-ec', "awk '/^Uid:/ {print $2}' /proc/1/status"]).trim();
    if (!effectiveUid || effectiveUid === '0') throw new Error('PostgreSQL server process did not drop root privileges.');
    run(['exec', name, 'psql', '-h', '127.0.0.1', '-U', 'aroman_bootstrap', '-d', 'aroman', '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1']);
    const splitRoles = run(['exec', name, 'psql', '-h', '127.0.0.1', '-U', 'aroman_bootstrap', '-d', 'aroman', '-v', 'ON_ERROR_STOP=1', '-Atc', "SELECT count(*) FROM pg_roles WHERE rolname IN ('aroman_migrator','aroman_app')"]).trim();
    if (splitRoles !== '2') throw new Error('PostgreSQL bootstrap did not create both separate runtime and migration roles.');
    console.log('PASS PostgreSQL server runs non-root and accepts a local SQL operation with split roles initialized');
    run(['restart', name]);
    waitForHealth();
    run(['exec', name, 'psql', '-h', '127.0.0.1', '-U', 'aroman_bootstrap', '-d', 'aroman', '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1']);
    console.log('PASS PostgreSQL restart retained initialized data and returned healthy');
  } finally {
    if (started) { try { run(['rm', '-fv', name]); } catch { /* Removes only this named disposable test container and its anonymous volume. */ } }
    try { run(['run', '--rm', '--network', 'none', '--user', '0:0', '-v', `${resolve(secretDir)}:/synthetic-secrets`, 'node:24-alpine',
      'sh', '-ec', `chown -R ${process.getuid()}:${process.getgid()} /synthetic-secrets && chmod 0700 /synthetic-secrets && chmod 0600 /synthetic-secrets/*`]); } catch { /* Best-effort ownership restore for this synthetic temp directory only. */ }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function main() {
  try { testPostgresRuntime(); return 0; }
  catch (error) { console.error(`FAIL ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
