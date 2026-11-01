#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backendSha } from './backend-pin.mjs';
import { catalogUpstreamConfigurationError, publicApiConfigurationError } from '../src/lib/public-showcase-config.mjs';
import { validatePublicTargetEvidence } from './validate-public-target-evidence.mjs';
import { CANDIDATE_MANIFEST, verifyCandidate } from './candidate-integrity.mjs';

export function runPublicReleasePreflight({ env = process.env, cwd = process.cwd(), distDirectory } = {}) {
  const passed = [];
  const failed = [];
  const unverified = [
    'DNS points to the intended public host.',
    'HTTPS termination and certificate chain are correctly configured.',
    'Network firewall and origin access prevent unintended direct access.',
    'Production database roles and credentials enforce read-only catalog access.',
    'The deployment runs only the pinned restricted aroman.exploration_api:app target.',
  ];
  let candidateIntegrity;
  const check = (name, condition) => (condition ? passed : failed).push(name);
  check('AROMAN_RELEASE_SCOPE is explicitly public-showcase', env.AROMAN_RELEASE_SCOPE === 'public-showcase');
  const apiError = env.AROMAN_RELEASE_SCOPE === 'public-showcase'
    ? publicApiConfigurationError(env.AROMAN_RELEASE_SCOPE, env.NEXT_PUBLIC_AROMAN_API_BASE_URL)
    : 'A public-showcase scope must be selected before validating its browser API configuration.';
  check('Browser API configuration is valid for public release', !apiError);
  if (env.AROMAN_CATALOG_UPSTREAM_URL !== undefined) {
    check('Server-only catalog upstream configuration is valid', !catalogUpstreamConfigurationError(env.AROMAN_CATALOG_UPSTREAM_URL));
  } else if (env.NEXT_PUBLIC_AROMAN_API_BASE_URL === '/api/v1') {
    failed.push('Same-origin public catalog requires AROMAN_CATALOG_UPSTREAM_URL.');
  }
  try {
    const route = readFileSync(resolve(cwd, 'src/app/api/v1/[...path]/route.ts'), 'utf8');
    check('Catalog handler defines exactly the five approved GET templates and rejects writes',
      ['/api/v1/brands', '/api/v1/products', '/api/v1/fragrance-families', '/api/v1/fragrance-notes', 'products\\/([^/]+)\\/variants', 'export const POST', 'export const DELETE'].every(token => route.includes(token)));
    check('Pinned Backend evidence matches the authorized revision', readFileSync(resolve(cwd, 'scripts/backend-pin.mjs'), 'utf8').includes(backendSha));
    const workflow = readFileSync(resolve(cwd, '.github/workflows/ci.yml'), 'utf8');
    const jobNames = workflow.match(/^  [a-z][a-z0-9-]*:\s*$/gm) || [];
    check('CI retains five jobs and runs preflight regression tests', jobNames.length === 5 && workflow.includes('npm run test:public-release-preflight'));
    const scope = readFileSync(resolve(cwd, 'src/lib/release-scope.ts'), 'utf8');
    check('All three release scopes remain recognized', ['full', 'exploration', 'public-showcase'].every(value => scope.includes(`'${value}'`)));
    const evidencePath = resolve(cwd, 'docs/public-target-evidence.example.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    const evidenceErrors = validatePublicTargetEvidence(evidence);
    check('M6-A23 evidence example is valid and all 13 controls remain UNVERIFIED', evidenceErrors.length === 0 && evidence.controls.length === 13 && evidence.controls.every(control => control.status === 'UNVERIFIED'));
    check('Evidence example Backend revision matches the authorized Backend pin', evidence.backend_revision === backendSha);
    const readiness = readFileSync(resolve(cwd, 'docs/M6_A23_PUBLIC_TARGET_READINESS.md'), 'utf8');
    check('M6-A25 development baseline is identified separately from any release candidate', readiness.includes('M6-A25 development baseline') && readiness.includes('not a release candidate'));
    const runbook = readFileSync(resolve(cwd, 'docs/M6_A23_PUBLIC_DEPLOYMENT_RUNBOOK.md'), 'utf8');
    check('Readiness runbook retains explicit stop conditions and recovery procedure', ['stop', 'NO-GO', 'Code rollback', 'restore'].every(token => runbook.toLowerCase().includes(token.toLowerCase())));
    const metadataDirectory = distDirectory ?? resolve(cwd, env.AROMAN_TEST_NEXT_DIST_DIR || '.next');
    const metadataPath = resolve(metadataDirectory, 'public-showcase-build.json');
    if (existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
        check('Compiled build metadata is current public-showcase metadata with the configured browser API base', metadata.format === 2 && metadata.scope === 'public-showcase' && metadata.apiBase === env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
        if (!existsSync(resolve(metadataDirectory, CANDIDATE_MANIFEST))) failed.push('Compiled public build metadata has no candidate manifest.');
      } catch { failed.push('Compiled public-showcase build metadata is valid JSON'); }
    } else {
      unverified.push('No compiled public-showcase build metadata is present; compiled API configuration is unverified.');
    }
    if (existsSync(resolve(metadataDirectory, CANDIDATE_MANIFEST))) {
      try {
        candidateIntegrity = verifyCandidate({ cwd, distDirectory: metadataDirectory, env });
        passed.push(...candidateIntegrity.passed.map(item => `Candidate: ${item}`));
        failed.push(...candidateIntegrity.failed.map(item => `Candidate: ${item}`));
        unverified.push(...candidateIntegrity.unverified);
      } catch { failed.push('Candidate manifest is invalid or cannot be verified.'); }
    }
  } catch {
    failed.push('Required repository release evidence is available');
  }
  return { passed, failed, unverified, candidateIntegrity };
}

export function main() {
  const result = runPublicReleasePreflight();
  for (const item of result.passed) console.log(`PASS ${item}`);
  for (const item of result.failed) console.error(`FAIL ${item}`);
  for (const item of result.unverified) console.log(`UNVERIFIED ${item}`);
  return result.failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
