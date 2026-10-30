#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { publicApiConfigurationError, publicShowcaseBuildMetadata } from '../src/lib/public-showcase-config.mjs';

export { publicApiConfigurationError } from '../src/lib/public-showcase-config.mjs';

export const PUBLIC_SHOWCASE_BUILD_METADATA = 'public-showcase-build.json';

export function main(args = process.argv.slice(2), env = process.env) {
  const error = publicApiConfigurationError(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
  if (error) { console.error(error); return 1; }
  if (args.includes('--check')) return 0;
  const distDirectory = resolve(process.cwd(), env.AROMAN_TEST_NEXT_DIST_DIR || '.next');
  const metadataPath = resolve(distDirectory, PUBLIC_SHOWCASE_BUILD_METADATA);
  rmSync(metadataPath, { force: true });
  const next = process.platform === 'win32' ? 'next.cmd' : 'next';
  const result = spawnSync(next, ['build'], { stdio: 'inherit', env });
  if (result.status !== 0) return result.status ?? 1;
  const metadata = publicShowcaseBuildMetadata(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
  if (metadata) {
    mkdirSync(distDirectory, { recursive: true });
    writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`, { flag: 'wx' });
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
