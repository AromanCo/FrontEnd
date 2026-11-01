#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { backendSha } from './backend-pin.mjs';
import { catalogUpstreamConfigurationError, publicShowcaseRuntimeError, readPublicShowcaseBuildMetadata } from '../src/lib/public-showcase-config.mjs';

export function publicShowcaseStartConfigurationError(env = process.env, cwd = process.cwd()) {
  const explicit = env.AROMAN_RELEASE_SCOPE;
  const distDirectory = env.AROMAN_TEST_NEXT_DIST_DIR || '.next';
  const metadata = readPublicShowcaseBuildMetadata(cwd, distDirectory);
  const scope = explicit ?? (env.NODE_ENV === 'production' ? 'exploration' : 'full');
  if (!['exploration', 'public-showcase', 'full'].includes(scope)) {
    return 'Invalid AROMAN_RELEASE_SCOPE. Expected "exploration", "public-showcase", or "full".';
  }
  if (metadata?.scope === 'public-showcase' && explicit !== 'public-showcase') {
    return 'A public-showcase production build requires AROMAN_RELEASE_SCOPE=public-showcase at runtime.';
  }
  if (metadata?.scope === 'public-showcase' && metadata.backendRevision !== backendSha) {
    return 'Compiled public-showcase metadata does not match the authorized Backend revision pin.';
  }
  if (scope !== 'public-showcase') return null;
  if (metadata?.apiBase === '/api/v1' && catalogUpstreamConfigurationError(env.AROMAN_CATALOG_UPSTREAM_URL)) {
    return 'Public same-origin runtime requires a valid server-only AROMAN_CATALOG_UPSTREAM_URL.';
  }
  return publicShowcaseRuntimeError(scope, metadata, env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
}

export function main(args = process.argv.slice(2), env = process.env) {
  const error = publicShowcaseStartConfigurationError(env);
  if (error) { console.error(error); return 1; }
  const next = process.platform === 'win32' ? 'next.cmd' : 'next';
  const result = spawnSync(next, ['start', ...args], { stdio: 'inherit', env });
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
