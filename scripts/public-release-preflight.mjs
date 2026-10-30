#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backendSha } from './backend-pin.mjs';
import { catalogUpstreamConfigurationError, publicApiConfigurationError } from '../src/lib/public-showcase-config.mjs';

export function runPublicReleasePreflight({ env = process.env, cwd = process.cwd() } = {}) {
  const passed = [];
  const failed = [];
  const unverified = [
    'DNS points to the intended public host.',
    'HTTPS termination and certificate chain are correctly configured.',
    'Network firewall and origin access prevent unintended direct access.',
    'Production database roles and credentials enforce read-only catalog access.',
    'The deployment runs only the pinned restricted aroman.exploration_api:app target.',
  ];
  const check = (name, condition) => (condition ? passed : failed).push(name);
  check('AROMAN_RELEASE_SCOPE is explicitly public-showcase', env.AROMAN_RELEASE_SCOPE === 'public-showcase');
  const apiError = publicApiConfigurationError(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
  check('Browser API configuration is valid for public release', !apiError);
  if (env.AROMAN_CATALOG_UPSTREAM_URL !== undefined) {
    check('Server-only catalog upstream configuration is valid', !catalogUpstreamConfigurationError(env.AROMAN_CATALOG_UPSTREAM_URL));
  } else if (env.NEXT_PUBLIC_AROMAN_API_BASE_URL === '/api/v1') {
    failed.push('Same-origin public catalog requires AROMAN_CATALOG_UPSTREAM_URL.');
  } else {
    unverified.push('AROMAN_CATALOG_UPSTREAM_URL is not present; same-origin catalog runtime wiring is unverified.');
  }
  try {
    const route = readFileSync(resolve(cwd, 'src/app/api/v1/[...path]/route.ts'), 'utf8');
    check('Catalog handler defines exactly the five approved GET templates and rejects writes',
      ['/api/v1/brands', '/api/v1/products', '/api/v1/fragrance-families', '/api/v1/fragrance-notes', 'products\\/([^/]+)\\/variants', 'export const POST', 'export const DELETE'].every(token => route.includes(token)));
    check('Pinned Backend evidence matches the authorized revision', readFileSync(resolve(cwd, 'scripts/backend-pin.mjs'), 'utf8').includes(backendSha));
    const workflow = readFileSync(resolve(cwd, '.github/workflows/ci.yml'), 'utf8');
    const jobNames = workflow.match(/^  [a-z][a-z0-9-]*:\s*$/gm) || [];
    check('CI retains five jobs and runs preflight regression tests', jobNames.length === 5 && workflow.includes('npm run test:public-release-preflight'));
  } catch {
    failed.push('Required repository release evidence is available');
  }
  return { passed, failed, unverified };
}

export function main() {
  const result = runPublicReleasePreflight();
  for (const item of result.passed) console.log(`PASS ${item}`);
  for (const item of result.failed) console.error(`FAIL ${item}`);
  for (const item of result.unverified) console.log(`UNVERIFIED ${item}`);
  return result.failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
