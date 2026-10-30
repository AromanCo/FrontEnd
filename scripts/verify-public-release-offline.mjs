#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { runPublicReleasePreflight } from './public-release-preflight.mjs';
import { rehearse } from './public-rollback-rehearsal.mjs';

export function runPublicReleaseOfflineChecks(options = {}) {
  // Explicit test input is used as-is; CLI input is the real process environment.
  const env = options.env ?? process.env;
  const result = runPublicReleasePreflight({ ...options, env });
  try {
    const branches = rehearse();
    result.passed.push(`Offline rollback decision rehearsal passed (${branches} deterministic branches; no live release or backup changed)`);
  } catch (error) {
    result.failed.push(`Offline rollback decision rehearsal failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return result;
}

export function verifyPublicReleaseOffline(options = {}) {
  const result = runPublicReleaseOfflineChecks(options);
  for (const item of result.passed) console.log(`PASS ${item}`);
  for (const item of result.failed) console.error(`FAIL ${item}`);
  for (const item of result.unverified) console.log(`UNVERIFIED ${item}`);
  console.log(result.failed.length
    ? `LOCAL VERIFICATION: FAIL (${result.failed.length} local check${result.failed.length === 1 ? '' : 's'} failed)`
    : `LOCAL VERIFICATION: PASS (${result.passed.length} local checks passed)`);
  console.log('PRODUCTION RELEASE AUTHORIZATION: UNVERIFIED (offline checks do not authorize deployment or public exposure).');
  return result.failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = verifyPublicReleaseOffline();
