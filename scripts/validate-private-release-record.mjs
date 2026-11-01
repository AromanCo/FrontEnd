#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NOT_CAPTURED = 'NOT_CAPTURED';
export const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  'frontend_source_revision', 'backend_source_revision', 'source_tree_integrity_sha256',
  'frontend_compiled_artifact_sha256', 'frontend_container_image_digest', 'catalog_api_container_image_digest',
  'postgres_container_image_digest', 'effective_compose_sha256', 'database_schema_migration_identity',
  'deployment_operator', 'independent_reviewer', 'backup_evidence_reference', 'restore_evidence_reference',
  'previous_approved_artifact_identity', 'rollback_procedure_reference', 'content_rights_review_references',
  'target_evidence_reference',
]);
export const REQUIRED_TARGET_CONTROLS = Object.freeze([
  'domain_dns', 'https_tls', 'network_isolation', 'catalog_target_routing', 'catalog_routes',
  'excluded_capabilities', 'database_migrations', 'content_provenance', 'environment_secrets',
  'logging', 'monitoring_incident', 'backup_rollback_recovery', 'release_signoff',
]);

export function validatePrivateReleaseRecord(record) {
  const errors = [];
  if (!record || record.format !== 1) errors.push('format must equal 1.');
  if (record?.purpose !== 'private-preproduction-candidate-preparation') errors.push('purpose is invalid.');
  if (record?.public_release_disposition !== 'NO-GO') errors.push('public release disposition must remain NO-GO.');
  if (record?.production_target_controls !== 'UNVERIFIED') errors.push('all 13 production target controls must remain UNVERIFIED.');
  const controlStatuses = record?.target_control_statuses;
  if (!controlStatuses || typeof controlStatuses !== 'object' || Array.isArray(controlStatuses)
    || Object.keys(controlStatuses).sort().join(',') !== [...REQUIRED_TARGET_CONTROLS].sort().join(',')
    || REQUIRED_TARGET_CONTROLS.some(id => controlStatuses?.[id] !== 'UNVERIFIED')) errors.push('each of the 13 M6-A23 production controls must remain UNVERIFIED.');
  if (record?.production_acceptance_claim !== false) errors.push('production acceptance claim must be false.');
  if (record?.deployable_claim !== false) errors.push('deployable claim must be false.');
  const slots = record?.slots;
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) errors.push('slots must be an object.');
  for (const field of REQUIRED_CANDIDATE_FIELDS) {
    const value = slots?.[field];
    if (Array.isArray(value) ? value.length === 0 || value.some(item => typeof item !== 'string' || !item.trim() || item === NOT_CAPTURED) : typeof value !== 'string' || !value.trim() || value === NOT_CAPTURED) {
      errors.push(`Required evidence slot is incomplete: ${field}.`);
    }
  }
  for (const field of ['frontend_source_revision', 'backend_source_revision']) {
    if (typeof slots?.[field] === 'string' && slots[field] !== NOT_CAPTURED && !/^[a-f0-9]{40}$/.test(slots[field])) errors.push(`${field} must be a full Git revision.`);
  }
  for (const field of ['source_tree_integrity_sha256', 'frontend_compiled_artifact_sha256', 'effective_compose_sha256']) {
    if (typeof slots?.[field] === 'string' && slots[field] !== NOT_CAPTURED && !/^[a-f0-9]{64}$/.test(slots[field])) errors.push(`${field} must be a SHA-256 digest.`);
  }
  for (const field of ['frontend_container_image_digest', 'catalog_api_container_image_digest', 'postgres_container_image_digest']) {
    if (typeof slots?.[field] === 'string' && slots[field] !== NOT_CAPTURED && !/^\S+@sha256:[a-f0-9]{64}$/.test(slots[field])) errors.push(`${field} must be an immutable sha256 image identity.`);
  }
  if (record?.evidence_kind === 'synthetic_fixture' && record.production_acceptance_claim === true) errors.push('Synthetic fixtures cannot be production acceptance evidence.');
  if (record?.evidence_kind && !['not-captured', 'repository-candidate', 'synthetic_fixture', 'production-target'].includes(record.evidence_kind)) errors.push('evidence_kind is invalid.');
  return { validForPreparation: errors.length === 0, deployable: false, publicRelease: 'NO-GO', productionTargetControls: 'UNVERIFIED', errors };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) { console.error('Usage: node scripts/validate-private-release-record.mjs <record.json>'); return 2; }
  try {
    const result = validatePrivateReleaseRecord(JSON.parse(readFileSync(argv[0], 'utf8')));
    for (const issue of result.errors) console.log(`BLOCKED ${issue}`);
    console.log(`PREPARATION ${result.validForPreparation ? 'STRUCTURALLY COMPLETE' : 'INCOMPLETE'}; DEPLOYABLE NO; PUBLIC RELEASE NO-GO; PRODUCTION CONTROLS UNVERIFIED`);
    return result.validForPreparation ? 0 : 1;
  } catch (cause) { console.error(`Unable to validate record: ${cause.message}`); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
