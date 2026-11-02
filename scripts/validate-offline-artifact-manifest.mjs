#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backendSha } from './backend-pin.mjs';
import { verifyCandidate } from './candidate-integrity.mjs';
import { REQUIRED_TARGET_CONTROLS } from './validate-private-release-record.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

export const MANIFEST_FORMAT = 1;
export const MISSING = 'NOT_CAPTURED';
export const TARGET_CONTROL_IDS = REQUIRED_TARGET_CONTROLS;

const rootFields = ['format', 'type', 'evidence_class', 'sources', 'frontend_candidate', 'dependencies', 'images', 'runtime_configuration', 'provenance', 'approvals', 'release_safety'];
const secretIds = new Set([
  'catalog_runtime_database_url', 'catalog_migration_database_url', 'database_bootstrap_password',
  'catalog_migration_password', 'catalog_runtime_password', 'otp_pepper', 'session_pepper',
]);
const runtimeIds = new Set(['AROMAN_RELEASE_SCOPE', 'NEXT_PUBLIC_AROMAN_API_BASE_URL', 'AROMAN_CATALOG_UPSTREAM_URL', 'AROMAN_BACKEND_CORS_ORIGINS']);
const imageNames = ['frontend', 'restricted_catalog_api', 'postgresql'];
const imageFields = ['status', 'repository', 'digest', 'platform', 'base_image'];
const evidenceFields = ['status', 'reference'];
const evidenceStatuses = new Set(['NOT_CAPTURED', 'UNVERIFIED']);
const observationStatuses = new Set(['NOT_CAPTURED', 'UNVERIFIED', 'OBSERVED_CLEAN', 'STRUCTURALLY_VALID']);
const evidenceReferencePatterns = Object.freeze({
  'sha256:': /^sha256:[a-f0-9]{64}$/,
});
const gitRevision = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const platformPattern = /^(linux|darwin|win32)\/(x64|arm64|arm|ia32)$/;
const repoPattern = /^[a-z0-9][a-z0-9./_-]*$/;
const immutableImagePattern = /^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/;

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, required, allowed, path, errors) {
  if (!isObject(value)) { errors.push(`${path} must be an object.`); return false; }
  for (const key of required) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed.`);
  return true;
}
function stringField(value, path, errors, { pattern, allowed = [], maxLength = 512 } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || (!allowed.includes(value) && pattern && !pattern.test(value)) || value.includes('\0')) {
    errors.push(`${path} has an invalid value.`);
    return false;
  }
  return true;
}
function revisionField(value, path, errors) {
  if (value !== MISSING && !stringField(value, path, errors, { pattern: gitRevision })) return false;
  return true;
}
function shaField(value, path, errors) {
  if (value !== MISSING && !stringField(value, path, errors, { pattern: sha256 })) return false;
  return true;
}
function validateEvidence(value, path, errors) {
  if (!exactKeys(value, evidenceFields, evidenceFields, path, errors)) return;
  if (!evidenceStatuses.has(value.status)) errors.push(`${path}.status must be NOT_CAPTURED or UNVERIFIED; this validator cannot establish trust.`);
  if (value.status === MISSING && value.reference !== MISSING) errors.push(`${path}.reference must be NOT_CAPTURED when status is NOT_CAPTURED.`);
  if (value.status === 'UNVERIFIED') {
    const allowedPattern = typeof value.reference === 'string'
      ? Object.entries(evidenceReferencePatterns).find(([namespace]) => value.reference.startsWith(namespace))?.[1]
      : undefined;
    if (!allowedPattern || !allowedPattern.test(value.reference)) errors.push(`${path}.reference must use an approved non-secret evidence reference format.`);
  }
}
function validateImage(value, path, errors, warnings) {
  if (!exactKeys(value, imageFields, imageFields, path, errors)) return;
  if (!['NOT_CAPTURED', 'RECORDED_UNVERIFIED'].includes(value.status)) errors.push(`${path}.status must be NOT_CAPTURED or RECORDED_UNVERIFIED.`);
  if (value.status === MISSING) {
    for (const field of imageFields.slice(1)) if (value[field] !== MISSING) errors.push(`${path}.${field} must be NOT_CAPTURED when the image status is NOT_CAPTURED.`);
    return;
  }
  if (!stringField(value.repository, `${path}.repository`, errors, { pattern: repoPattern, maxLength: 255 }) || value.repository === MISSING) {
    errors.push(`${path}.repository must be a registry/repository without a mutable tag or credentials.`);
  }
  if (!stringField(value.digest, `${path}.digest`, errors, { pattern: /^sha256:[a-f0-9]{64}$/ })) errors.push(`${path}.digest must be an immutable OCI sha256 digest.`);
  if (!stringField(value.platform, `${path}.platform`, errors, { pattern: platformPattern })) errors.push(`${path}.platform is invalid.`);
  if (!stringField(value.base_image, `${path}.base_image`, errors, { pattern: immutableImagePattern })) errors.push(`${path}.base_image must be an immutable image identity.`);
  warnings.push(`${path} is recorded but not authenticated; digest syntax alone is not provenance or trust.`);
}

export function validateManifest(manifest, { candidateManifest } = {}) {
  const errors = [];
  const warnings = [];
  exactKeys(manifest, rootFields, rootFields, 'manifest', errors);
  if (manifest?.format !== MANIFEST_FORMAT) errors.push(`format must equal ${MANIFEST_FORMAT}.`);
  if (manifest?.type !== 'aroman-offline-artifact-manifest') errors.push('type is invalid.');
  if (!['planning_template', 'synthetic_fixture', 'repository_candidate'].includes(manifest?.evidence_class)) errors.push('evidence_class is invalid.');

  const sources = manifest?.sources;
  if (exactKeys(sources, ['frontend', 'backend'], ['frontend', 'backend'], 'sources', errors)) {
    const frontend = sources.frontend;
    if (exactKeys(frontend, ['repository', 'revision', 'source_tree_sha256', 'clean_checkout_attestation'], ['repository', 'revision', 'source_tree_sha256', 'clean_checkout_attestation'], 'sources.frontend', errors)) {
      if (frontend.repository !== 'AromanCo/FrontEnd') errors.push('sources.frontend.repository must identify AromanCo/FrontEnd.');
      revisionField(frontend.revision, 'sources.frontend.revision', errors);
      shaField(frontend.source_tree_sha256, 'sources.frontend.source_tree_sha256', errors);
      validateObservation(frontend.clean_checkout_attestation, 'sources.frontend.clean_checkout_attestation', errors);
      if (frontend.clean_checkout_attestation?.status !== 'STRUCTURALLY_VALID') warnings.push('Clean-checkout observation is not captured or structurally validated; it cannot establish source authorization.');
    }
    const backend = sources.backend;
    if (exactKeys(backend, ['repository', 'revision', 'authorized_pin'], ['repository', 'revision', 'authorized_pin', 'clean_checkout_attestation'], 'sources.backend', errors)) {
      if (backend.repository !== 'AromanCo/Backend') errors.push('sources.backend.repository must identify AromanCo/Backend.');
      revisionField(backend.revision, 'sources.backend.revision', errors);
      if (backend.authorized_pin !== backendSha) errors.push(`sources.backend.authorized_pin must equal the configured Backend pin ${backendSha}.`);
      if (backend.revision !== MISSING && backend.revision !== backendSha) errors.push('sources.backend.revision does not match the authorized Backend pin.');
      if (backend.revision === MISSING) warnings.push('Backend source revision is NOT_CAPTURED; only the authorized pin is known.');
      if (Object.hasOwn(backend, 'clean_checkout_attestation')) {
        validateObservation(backend.clean_checkout_attestation, 'sources.backend.clean_checkout_attestation', errors);
        if (backend.clean_checkout_attestation?.status !== 'STRUCTURALLY_VALID') warnings.push('Backend clean-checkout observation is not structurally validated; it cannot establish source authorization.');
      } else warnings.push('Backend clean-checkout observation is NOT_CAPTURED.');
    }
  }

  const candidate = manifest?.frontend_candidate;
  const candidateKeys = ['release_scope', 'browser_api_base', 'metadata_format', 'configuration_sha256', 'compiled_artifact_sha256', 'compiled_file_count'];
  if (exactKeys(candidate, candidateKeys, candidateKeys, 'frontend_candidate', errors)) {
    if (candidate.release_scope !== 'public-showcase') errors.push('frontend_candidate.release_scope must be public-showcase.');
    if (candidate.browser_api_base !== '/api/v1') errors.push('frontend_candidate.browser_api_base must be /api/v1.');
    if (![MISSING, 2].includes(candidate.metadata_format)) errors.push('frontend_candidate.metadata_format must be 2 or NOT_CAPTURED.');
    shaField(candidate.configuration_sha256, 'frontend_candidate.configuration_sha256', errors);
    shaField(candidate.compiled_artifact_sha256, 'frontend_candidate.compiled_artifact_sha256', errors);
    if (candidate.compiled_file_count !== MISSING && (!Number.isSafeInteger(candidate.compiled_file_count) || candidate.compiled_file_count < 1)) errors.push('frontend_candidate.compiled_file_count must be a positive integer or NOT_CAPTURED.');
  }

  const dependencies = manifest?.dependencies;
  if (exactKeys(dependencies, ['frontend', 'backend'], ['frontend', 'backend'], 'dependencies', errors)) {
    const fe = dependencies.frontend;
    const feKeys = ['package_lock_sha256', 'node_version', 'npm_version', 'next_version', 'platform'];
    if (exactKeys(fe, feKeys, feKeys, 'dependencies.frontend', errors)) {
      shaField(fe.package_lock_sha256, 'dependencies.frontend.package_lock_sha256', errors);
      for (const key of ['node_version', 'npm_version', 'next_version']) stringField(fe[key], `dependencies.frontend.${key}`, errors, { pattern: /^[A-Za-z0-9][A-Za-z0-9._+:/-]*$/, allowed: [MISSING], maxLength: 128 });
      if (fe.platform !== MISSING && !stringField(fe.platform, 'dependencies.frontend.platform', errors, { pattern: platformPattern })) errors.push('dependencies.frontend.platform is invalid.');
    }
    const be = dependencies.backend;
    const beKeys = ['lock_status', 'lock_reference', 'python_version', 'pip_version', 'build_backend'];
    if (exactKeys(be, beKeys, beKeys, 'dependencies.backend', errors)) {
      if (be.lock_status !== MISSING || be.lock_reference !== MISSING) errors.push('Backend dependency-lock status/reference must remain NOT_CAPTURED; no lock is established by this milestone.');
      for (const key of ['python_version', 'pip_version', 'build_backend']) stringField(be[key], `dependencies.backend.${key}`, errors, { pattern: /^[A-Za-z0-9][A-Za-z0-9._+:/-]*$/, allowed: [MISSING], maxLength: 128 });
    }
  }

  const images = manifest?.images;
  if (exactKeys(images, imageNames, imageNames, 'images', errors)) for (const name of imageNames) validateImage(images[name], `images.${name}`, errors, warnings);

  const runtime = manifest?.runtime_configuration;
  const runtimeRequiredKeys = ['compose_source', 'effective_compose', 'non_secret_reference_ids', 'secret_reference_ids'];
  const runtimeAllowedKeys = [...runtimeRequiredKeys, 'compose_fingerprints', 'canonicalization_algorithm'];
  if (exactKeys(runtime, runtimeRequiredKeys, runtimeAllowedKeys, 'runtime_configuration', errors)) {
    const compose = runtime.compose_source;
    const composeKeys = ['revision', 'path', 'sha256'];
    if (exactKeys(compose, composeKeys, composeKeys, 'runtime_configuration.compose_source', errors)) {
      revisionField(compose.revision, 'runtime_configuration.compose_source.revision', errors);
      if (compose.revision !== MISSING && compose.revision !== sources?.frontend?.revision) errors.push('Compose source revision must match the Frontend source revision.');
      if (compose.path !== 'deploy/private-preproduction/compose.yaml') errors.push('Compose source path is invalid.');
      shaField(compose.sha256, 'runtime_configuration.compose_source.sha256', errors);
    }
    const effective = runtime.effective_compose;
    if (exactKeys(effective, ['status', 'fingerprint_sha256'], ['status', 'fingerprint_sha256'], 'runtime_configuration.effective_compose', errors)) {
      if (effective.status !== MISSING || effective.fingerprint_sha256 !== MISSING) errors.push('Aggregate effective Compose evidence must remain NOT_CAPTURED; profile-specific fingerprints are recorded separately.');
    }
    if (Object.hasOwn(runtime, 'canonicalization_algorithm') && runtime.canonicalization_algorithm !== 'aroman-canonical-json-v1') errors.push('runtime_configuration.canonicalization_algorithm is invalid.');
    if (!Object.hasOwn(runtime, 'canonicalization_algorithm')) warnings.push('Compose canonicalization algorithm is NOT_CAPTURED.');
    const profileFingerprints = runtime.compose_fingerprints;
    if (!Object.hasOwn(runtime, 'compose_fingerprints')) warnings.push('Profile-specific Compose fingerprints are NOT_CAPTURED.');
    if (Object.hasOwn(runtime, 'compose_fingerprints') && exactKeys(profileFingerprints, ['runtime', 'controlled_migration'], ['runtime', 'controlled_migration'], 'runtime_configuration.compose_fingerprints', errors)) {
      for (const name of ['runtime', 'controlled_migration']) {
        const item = profileFingerprints[name];
        if (exactKeys(item, ['status', 'reference', 'fingerprint_sha256', 'evidence_class'], ['status', 'reference', 'fingerprint_sha256', 'evidence_class'], `runtime_configuration.compose_fingerprints.${name}`, errors)) {
          if (!['NOT_CAPTURED', 'STRUCTURALLY_VALID'].includes(item.status)) errors.push(`runtime_configuration.compose_fingerprints.${name}.status cannot assert trust or observation.`);
          if (item.status === MISSING && [item.reference, item.fingerprint_sha256, item.evidence_class].some(value => value !== MISSING)) errors.push(`runtime_configuration.compose_fingerprints.${name} must remain NOT_CAPTURED when status is NOT_CAPTURED.`);
          if (item.status === 'STRUCTURALLY_VALID') {
            if (!/^sha256:[a-f0-9]{64}$/.test(item.reference)) errors.push(`runtime_configuration.compose_fingerprints.${name}.reference must be a report digest.`);
            shaField(item.fingerprint_sha256, `runtime_configuration.compose_fingerprints.${name}.fingerprint_sha256`, errors);
            if (!['synthetic', 'repository_candidate'].includes(item.evidence_class)) errors.push(`runtime_configuration.compose_fingerprints.${name}.evidence_class is invalid.`);
            if (item.evidence_class === 'synthetic') warnings.push(`Compose ${name} fingerprint is synthetic and is not release evidence.`);
            if (item.evidence_class === 'repository_candidate') warnings.push(`Compose ${name} fingerprint is a repository candidate record and is not authenticated or approved.`);
          }
        }
      }
    }
    if (!Array.isArray(runtime.non_secret_reference_ids) || new Set(runtime.non_secret_reference_ids).size !== runtime.non_secret_reference_ids.length || runtime.non_secret_reference_ids.some(id => !runtimeIds.has(id))) errors.push('runtime_configuration.non_secret_reference_ids must contain only unique approved non-secret identifiers.');
    if (!Array.isArray(runtime.secret_reference_ids) || new Set(runtime.secret_reference_ids).size !== runtime.secret_reference_ids.length || runtime.secret_reference_ids.some(id => !secretIds.has(id))) errors.push('runtime_configuration.secret_reference_ids must contain only unique approved secret reference identifiers, never values.');
  }

  const provenance = manifest?.provenance;
  const provenanceKeys = ['build', 'sbom', 'signature_verification'];
  if (exactKeys(provenance, provenanceKeys, provenanceKeys, 'provenance', errors)) {
    for (const key of provenanceKeys) {
      validateEvidence(provenance[key], `provenance.${key}`, errors);
      if (provenance[key]?.status === 'UNVERIFIED') warnings.push(`provenance.${key} is referenced but remains unverified and untrusted.`);
    }
  }

  const approvals = manifest?.approvals;
  const approvalKeys = ['builder', 'operator', 'independent_reviewer', 'previous_artifact', 'rollback'];
  if (exactKeys(approvals, approvalKeys, approvalKeys, 'approvals', errors)) for (const key of approvalKeys) validateEvidence(approvals[key], `approvals.${key}`, errors);

  const safety = manifest?.release_safety;
  const safetyKeys = ['deployable', 'production_acceptance_claim', 'public_release_disposition', 'target_controls'];
  if (exactKeys(safety, safetyKeys, safetyKeys, 'release_safety', errors)) {
    if (safety.deployable !== false) errors.push('release_safety.deployable must be false.');
    if (safety.production_acceptance_claim !== false) errors.push('release_safety.production_acceptance_claim must be false.');
    if (safety.public_release_disposition !== 'NO-GO') errors.push('release_safety.public_release_disposition must be NO-GO.');
    const controls = safety.target_controls;
    if (exactKeys(controls, TARGET_CONTROL_IDS, TARGET_CONTROL_IDS, 'release_safety.target_controls', errors)) {
      for (const id of TARGET_CONTROL_IDS) if (controls[id] !== 'UNVERIFIED') errors.push(`release_safety.target_controls.${id} must remain UNVERIFIED.`);
    }
  }

  if (candidateManifest !== undefined) errors.push(...crossCheckCandidate(manifest, candidateManifest));
  if (manifest?.evidence_class === 'synthetic_fixture') warnings.push('Synthetic fixture: structural success is not real artifact evidence and can never establish production acceptance.');
  if (manifest?.evidence_class === 'planning_template') warnings.push('Planning template: NOT_CAPTURED slots are placeholders, not evidence.');
  if (manifest?.evidence_class === 'repository_candidate') warnings.push('Repository candidate: structure and recorded identities are not authenticated provenance or deployment approval.');
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    fingerprintSha256: errors.length === 0 ? manifestFingerprint(manifest) : null,
    trusted: false,
    deployable: false,
    production_acceptance_claim: false,
    public_release_disposition: 'NO-GO',
    target_controls: Object.fromEntries(TARGET_CONTROL_IDS.map(id => [id, 'UNVERIFIED'])),
  };
}

function validateObservation(value, path, errors) {
  if (!exactKeys(value, ['status', 'reference'], ['status', 'reference'], path, errors)) return;
  if (!observationStatuses.has(value.status)) errors.push(`${path}.status must be NOT_CAPTURED, UNVERIFIED, OBSERVED_CLEAN or STRUCTURALLY_VALID; TRUST_ESTABLISHED is prohibited.`);
  if (value.status === MISSING && value.reference !== MISSING) errors.push(`${path}.reference must be NOT_CAPTURED when status is NOT_CAPTURED.`);
  if (value.status !== MISSING && !/^sha256:[a-f0-9]{64}$/.test(value.reference)) errors.push(`${path}.reference must be a report digest.`);
}

export function crossCheckCandidate(manifest, candidate) {
  const errors = [];
  const mismatch = (label, actual, expected) => { if (actual !== expected) errors.push(`${label} does not match the M6-A25 candidate manifest.`); };
  if (!isObject(candidate) || candidate.format !== 1 || candidate.complete !== true || !isObject(candidate.source) || !isObject(candidate.compiled) || !isObject(candidate.build)) {
    return ['M6-A25 candidate manifest is incomplete or malformed.'];
  }
  mismatch('Frontend candidate scope', manifest?.frontend_candidate?.release_scope, candidate.scope);
  mismatch('Frontend candidate source revision', manifest?.sources?.frontend?.revision, candidate.source.revision);
  mismatch('Frontend source-tree SHA-256', manifest?.sources?.frontend?.source_tree_sha256, candidate.source.treeSha256);
  mismatch('Backend candidate revision', manifest?.sources?.backend?.revision, candidate.backendRevision);
  mismatch('Frontend candidate API base', manifest?.frontend_candidate?.browser_api_base, candidate.compiled.apiBase);
  mismatch('Frontend candidate metadata format', manifest?.frontend_candidate?.metadata_format, candidate.build.metadataVersion);
  mismatch('Frontend configuration SHA-256', manifest?.frontend_candidate?.configuration_sha256, candidate.compiled.configurationSha256);
  mismatch('Frontend compiled artifact SHA-256', manifest?.frontend_candidate?.compiled_artifact_sha256, candidate.compiled.artifactSha256);
  mismatch('Frontend compiled file count', manifest?.frontend_candidate?.compiled_file_count, candidate.compiled.fileCount);
  mismatch('Frontend package-lock SHA-256', manifest?.dependencies?.frontend?.package_lock_sha256, candidate.build.packageLockSha256);
  mismatch('Frontend Node version', manifest?.dependencies?.frontend?.node_version, candidate.build.nodeVersion);
  mismatch('Frontend Next version', manifest?.dependencies?.frontend?.next_version, candidate.build.nextVersion);
  return errors;
}

export { canonicalJson };
export function manifestFingerprint(manifest) { return canonicalSha256(manifest); }

export function runCandidateVerification({ cwd, distDirectory, manifest, candidateManifest, candidateVerifier = verifyCandidate }) {
  const env = {
    AROMAN_RELEASE_SCOPE: manifest.frontend_candidate.release_scope,
    NEXT_PUBLIC_AROMAN_API_BASE_URL: manifest.frontend_candidate.browser_api_base,
  };
  return candidateVerifier({ cwd, distDirectory, env, manifest: candidateManifest });
}

function parseArgs(argv) {
  const options = { json: false, candidateDir: null, sourceDir: process.cwd(), manifestPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--candidate-dir' && argv[i + 1]) options.candidateDir = resolve(argv[++i]);
    else if (arg === '--source-dir' && argv[i + 1]) options.sourceDir = resolve(argv[++i]);
    else if (!arg.startsWith('-') && !options.manifestPath) options.manifestPath = resolve(arg);
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!options.manifestPath) throw new Error('Usage: npm run validate:offline-artifact-manifest -- <manifest.json> [--candidate-dir <.next>] [--source-dir <frontend-checkout>] [--json]');
  if (options.candidateDir && !argv.includes('--source-dir')) options.sourceDir = process.cwd();
  return options;
}

export function main(argv = process.argv.slice(2)) {
  let result;
  let options;
  try {
    options = parseArgs(argv);
    const manifest = JSON.parse(readFileSync(options.manifestPath, 'utf8'));
    let candidateManifest;
    if (options.candidateDir) candidateManifest = JSON.parse(readFileSync(join(options.candidateDir, 'release-candidate.json'), 'utf8'));
    result = validateManifest(manifest, { candidateManifest });
    if (result.valid && options.candidateDir) {
      const candidateResult = runCandidateVerification({
        cwd: options.sourceDir,
        distDirectory: options.candidateDir,
        manifest: candidateManifest,
        candidateManifest,
      });
      if (candidateResult.failed.length) {
        result.valid = false;
        result.errors.push(...candidateResult.failed.map(item => `M6-A25 candidate verification failed: ${item}`));
        result.fingerprintSha256 = null;
      } else {
        result.candidateVerification = { status: 'PASSED_LOCAL_M6_A25_CHECKS', passed: candidateResult.passed.length, unverified: candidateResult.unverified };
      }
    }
  } catch (error) {
    result = {
      valid: false, errors: [error.message], warnings: [], fingerprintSha256: null, trusted: false,
      deployable: false, production_acceptance_claim: false, public_release_disposition: 'NO-GO',
      target_controls: Object.fromEntries(TARGET_CONTROL_IDS.map(id => [id, 'UNVERIFIED'])),
    };
  }
  if (options?.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const error of result.errors) console.error(`FAIL ${error}`);
    for (const warning of result.warnings) console.log(`UNVERIFIED ${warning}`);
    if (result.valid) console.log(`STRUCTURALLY VALID; SHA-256 ${result.fingerprintSha256}; TRUST NOT ESTABLISHED; DEPLOYABLE NO; PUBLIC RELEASE NO-GO; 13 TARGET CONTROLS UNVERIFIED`);
    else console.log('INVALID; DEPLOYABLE NO; PUBLIC RELEASE NO-GO; 13 TARGET CONTROLS UNVERIFIED');
  }
  return result.valid ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
