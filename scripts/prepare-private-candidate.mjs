#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyCandidate } from './candidate-integrity.mjs';
import { validatePrivateReleaseRecord } from './validate-private-release-record.mjs';

export function preparePrivateCandidate({ cwd = process.cwd(), distDirectory = '.next', env = process.env, templatePath = resolve(cwd, 'docs/private-preproduction-release-record.example.json') } = {}) {
  const candidate = verifyCandidate({ cwd, distDirectory, env });
  const record = JSON.parse(readFileSync(templatePath, 'utf8'));
  if (candidate.failed.length === 0 && candidate.identity) {
    record.evidence_kind = 'repository-candidate';
    record.slots.frontend_source_revision = candidate.identity.frontendRevision;
    record.slots.backend_source_revision = candidate.identity.backendRevision;
    record.slots.source_tree_integrity_sha256 = candidate.identity.sourceTreeSha256;
    record.slots.frontend_compiled_artifact_sha256 = candidate.identity.artifactSha256;
  }
  record.production_acceptance_claim = false;
  record.deployable_claim = false;
  record.public_release_disposition = 'NO-GO';
  record.production_target_controls = 'UNVERIFIED';
  for (const id of Object.keys(record.target_control_statuses || {})) record.target_control_statuses[id] = 'UNVERIFIED';
  return { candidate, record, validation: validatePrivateReleaseRecord(record) };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length > 1) { console.error('Usage: node scripts/prepare-private-candidate.mjs [compiled-candidate-directory]'); return 2; }
  try {
    const result = preparePrivateCandidate({ distDirectory: argv[0] || '.next', env });
    console.log(JSON.stringify({ candidate: result.candidate, preparationRecord: result.record, recordValidation: result.validation }, null, 2));
    return result.candidate.failed.length ? 1 : 0;
  } catch (cause) { console.error(`Candidate preparation failed closed: ${cause.message}`); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
