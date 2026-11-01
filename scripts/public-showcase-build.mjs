#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backendSha } from './backend-pin.mjs';
import { CANDIDATE_MANIFEST, candidateConfiguration, createCandidateManifest } from './candidate-integrity.mjs';
import { publicApiConfigurationError, publicShowcaseBuildMetadata } from '../src/lib/public-showcase-config.mjs';

export { publicApiConfigurationError } from '../src/lib/public-showcase-config.mjs';

export const PUBLIC_SHOWCASE_BUILD_METADATA = 'public-showcase-build.json';

export function main(args = process.argv.slice(2), env = process.env) {
  const error = publicApiConfigurationError(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
  if (error) { console.error(error); return 1; }
  if (args.includes('--check')) return 0;
  const cwd = process.cwd();
  const distDirectory = resolve(cwd, env.AROMAN_TEST_NEXT_DIST_DIR || '.next');
  if (dirname(distDirectory) !== cwd || !basename(distDirectory).startsWith('.next')) {
    console.error('Next.js distDir must be a dedicated .next directory directly inside the Frontend checkout.');
    return 1;
  }
  const metadataPath = resolve(distDirectory, PUBLIC_SHOWCASE_BUILD_METADATA);
  // A fresh build must never inherit chunks or build metadata from a prior scope.
  rmSync(distDirectory, { recursive: true, force: true });
  const next = process.platform === 'win32' ? 'next.cmd' : 'next';
  const result = spawnSync(next, ['build'], { stdio: 'inherit', env });
  if (result.status !== 0) return result.status ?? 1;
  const config = env.AROMAN_RELEASE_SCOPE === 'public-showcase'
    ? candidateConfiguration({ scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL })
    : null;
  const sourceRevision = env.AROMAN_RELEASE_SCOPE === 'public-showcase'
    ? spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    : null;
  const metadata = publicShowcaseBuildMetadata(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL, {
    sourceRevision,
    backendRevision: backendSha,
    configurationSha256: config?.sha256 ?? null,
  });
  if (metadata) {
    mkdirSync(distDirectory, { recursive: true });
    writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`, { flag: 'wx' });
    const manifest = createCandidateManifest({ cwd: process.cwd(), distDirectory, scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL });
    writeFileSync(resolve(distDirectory, CANDIDATE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
