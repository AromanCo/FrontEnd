#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { publicShowcaseRuntimeError, readPublicShowcaseBuildMetadata } from '../src/lib/public-showcase-config.mjs';

export function publicShowcaseStartConfigurationError(env = process.env, cwd = process.cwd()) {
  const explicit = env.AROMAN_RELEASE_SCOPE;
  const scope = explicit ?? (env.NODE_ENV === 'production' ? 'exploration' : 'full');
  if (!['exploration', 'public-showcase', 'full'].includes(scope)) {
    return 'Invalid AROMAN_RELEASE_SCOPE. Expected "exploration", "public-showcase", or "full".';
  }
  if (scope !== 'public-showcase') return null;
  const distDirectory = env.AROMAN_TEST_NEXT_DIST_DIR || '.next';
  const metadata = readPublicShowcaseBuildMetadata(cwd, distDirectory);
  return publicShowcaseRuntimeError(scope, metadata);
}

export function main(args = process.argv.slice(2), env = process.env) {
  const error = publicShowcaseStartConfigurationError(env);
  if (error) { console.error(error); return 1; }
  const next = process.platform === 'win32' ? 'next.cmd' : 'next';
  const result = spawnSync(next, ['start', ...args], { stdio: 'inherit', env });
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
