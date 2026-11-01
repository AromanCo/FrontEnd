#!/usr/bin/env node
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const image = 'node:24-alpine';
const secretNames = [
  'catalog_runtime_database_url', 'catalog_migration_database_url', 'database_bootstrap_password',
  'catalog_migration_password', 'catalog_runtime_password', 'otp_pepper', 'session_pepper',
];
const serviceSecrets = {
  'catalog-api': ['catalog_runtime_database_url', 'otp_pepper', 'session_pepper'],
  migrate: ['catalog_migration_database_url', 'otp_pepper', 'session_pepper'],
};
const run = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

export function testSecretReadability() {
  try { run(['image', 'inspect', image]); }
  catch { throw new Error(`${image} is not cached; refusing to pull an image for this local security check.`); }
  const secretDir = mkdtempSync(join(tmpdir(), 'aroman-a27-secret-check-'));
  const containerDir = '/synthetic-secrets';
  try {
    chmodSync(secretDir, 0o700);
    for (const name of secretNames) writeFileSync(join(secretDir, name), `synthetic-${name}-value-only\n`, { mode: 0o600 });
    run(['run', '--rm', '--network', 'none', '--user', '0:0', '-v', `${resolve(secretDir)}:${containerDir}`, image,
      'sh', '-ec', `chown 0:0 ${containerDir} && chmod 0700 ${containerDir} && for f in ${secretNames.join(' ')}; do chown 0:10001 ${containerDir}/$f; chmod 0440 ${containerDir}/$f; done`]);
    run(['run', '--rm', '--network', 'none', '-v', `${resolve(secretDir)}:${containerDir}:ro`, image, 'sh', '-ec',
      `test "$(stat -c %u:%g:%a ${containerDir})" = 0:0:700 && for f in ${secretNames.join(' ')}; do test "$(stat -c %u:%g:%a ${containerDir}/$f)" = 0:10001:440; done`]);

    const mount = (name, target) => ['--mount', `type=bind,src=${join(secretDir, name)},dst=/run/secrets/${target},readonly`];
    for (const [service, allowed] of Object.entries(serviceSecrets)) {
      const args = ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--user', '10001:10001'];
      for (const name of allowed) args.push(...mount(name, name));
      const expected = allowed.map(name => `/run/secrets/${name}`).join(' ');
      const forbidden = secretNames.filter(name => !allowed.includes(name)).map(name => `/run/secrets/${name}`).join(' ');
      const command = `for f in ${expected}; do test -r "$f" && cat "$f" >/dev/null; done; for f in ${forbidden}; do test ! -e "$f"; done`;
      run([...args, image, 'sh', '-ec', command]);
      console.log(`PASS ${service} UID/GID 10001:10001 reads only its mounted synthetic secrets`);
    }
  } finally {
    try { run(['run', '--rm', '--network', 'none', '--user', '0:0', '-v', `${resolve(secretDir)}:${containerDir}`, image,
      'sh', '-ec', `chown -R ${process.getuid()}:${process.getgid()} ${containerDir} && chmod 0700 ${containerDir} && chmod 0600 ${containerDir}/*`]); } catch { /* Best-effort ownership restore for this synthetic temp directory only. */ }
    rmSync(secretDir, { recursive: true, force: true });
  }
}

export function main() {
  try { testSecretReadability(); return 0; }
  catch (error) { console.error(`FAIL ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
