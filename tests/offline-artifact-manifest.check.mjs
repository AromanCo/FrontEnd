import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { backendSha } from '../scripts/backend-pin.mjs';
import { canonicalJson, manifestFingerprint, runCandidateVerification, validateManifest } from '../scripts/validate-offline-artifact-manifest.mjs';

const example = JSON.parse(readFileSync(new URL('../docs/offline-artifact-manifest.example.json', import.meta.url), 'utf8'));
const clone = value => structuredClone(value);
const fullRevision = 'a'.repeat(40);
const sourceDigest = 'b'.repeat(64);
const configDigest = 'c'.repeat(64);
const artifactDigest = 'd'.repeat(64);
const lockDigest = 'e'.repeat(64);

function syntheticManifest() {
  const manifest = clone(example);
  manifest.evidence_class = 'synthetic_fixture';
  manifest.sources.frontend.revision = fullRevision;
  manifest.sources.frontend.source_tree_sha256 = sourceDigest;
  manifest.sources.backend.revision = backendSha;
  manifest.frontend_candidate.metadata_format = 2;
  manifest.frontend_candidate.configuration_sha256 = configDigest;
  manifest.frontend_candidate.compiled_artifact_sha256 = artifactDigest;
  manifest.frontend_candidate.compiled_file_count = 17;
  manifest.dependencies.frontend.package_lock_sha256 = lockDigest;
  manifest.dependencies.frontend.node_version = 'v24.22.2';
  manifest.dependencies.frontend.npm_version = '11.19.1';
  manifest.dependencies.frontend.next_version = '16.4.2';
  manifest.dependencies.frontend.platform = 'linux/x64';
  manifest.dependencies.backend.python_version = '3.12.9';
  manifest.dependencies.backend.pip_version = '25.0';
  manifest.dependencies.backend.build_backend = 'setuptools.build_meta';
  manifest.runtime_configuration.compose_source.revision = fullRevision;
  manifest.runtime_configuration.compose_source.sha256 = 'f'.repeat(64);
  return manifest;
}

function candidateManifest(manifest = syntheticManifest()) {
  return {
    format: 1,
    complete: true,
    scope: manifest.frontend_candidate.release_scope,
    source: { revision: manifest.sources.frontend.revision, treeSha256: manifest.sources.frontend.source_tree_sha256 },
    backendRevision: manifest.sources.backend.revision,
    compiled: {
      apiBase: manifest.frontend_candidate.browser_api_base,
      configurationSha256: manifest.frontend_candidate.configuration_sha256,
      artifactSha256: manifest.frontend_candidate.compiled_artifact_sha256,
      fileCount: manifest.frontend_candidate.compiled_file_count,
    },
    build: {
      metadataVersion: manifest.frontend_candidate.metadata_format,
      packageLockSha256: manifest.dependencies.frontend.package_lock_sha256,
      nodeVersion: manifest.dependencies.frontend.node_version,
      nextVersion: manifest.dependencies.frontend.next_version,
    },
  };
}

test('valid synthetic manifest passes structure but remains untrusted and blocked', () => {
  const result = validateManifest(syntheticManifest());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.trusted, false);
  assert.equal(result.deployable, false);
  assert.equal(result.production_acceptance_claim, false);
  assert.equal(result.public_release_disposition, 'NO-GO');
  assert.equal(Object.keys(result.target_controls).length, 13);
  assert.ok(Object.values(result.target_controls).every(status => status === 'UNVERIFIED'));
  assert.match(result.fingerprintSha256, /^[a-f0-9]{64}$/);
});

test('approved SHA-256 evidence reference syntax is accepted but remains unverified', () => {
  const manifest = syntheticManifest();
  manifest.provenance.build = { status: 'UNVERIFIED', reference: `sha256:${'9'.repeat(64)}` };
  const result = validateManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.trusted, false);
  assert.equal(result.deployable, false);
  assert.equal(result.public_release_disposition, 'NO-GO');
});

test('arbitrary synthetic tokens are rejected as evidence references', () => {
  const manifest = syntheticManifest();
  manifest.provenance.build = { status: 'UNVERIFIED', reference: 'synthetic-token-abc123' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('unsupported evidence-reference namespaces are rejected', () => {
  const manifest = syntheticManifest();
  manifest.provenance.sbom = { status: 'UNVERIFIED', reference: 'repo://AromanCo/FrontEnd/docs/report' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('absolute local paths are rejected as evidence references', () => {
  const manifest = syntheticManifest();
  manifest.approvals.operator = { status: 'UNVERIFIED', reference: '/tmp/evidence.json' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('credential-bearing URLs are rejected as evidence references', () => {
  const manifest = syntheticManifest();
  manifest.approvals.builder = { status: 'UNVERIFIED', reference: 'https://user:password@example.invalid/evidence' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('environment-variable assignments are rejected as evidence references', () => {
  const manifest = syntheticManifest();
  manifest.approvals.independent_reviewer = { status: 'UNVERIFIED', reference: 'TOKEN=synthetic-only-value' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('malformed digest and token-like reference values are rejected', () => {
  const manifest = syntheticManifest();
  manifest.provenance.signature_verification = { status: 'UNVERIFIED', reference: `sha256:${'g'.repeat(64)}` };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
  manifest.provenance.signature_verification.reference = 'a'.repeat(40);
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('approved non-secret evidence reference format')));
});

test('synthetic evidence with valid reference syntax still cannot establish production trust', () => {
  const manifest = syntheticManifest();
  manifest.approvals.builder = { status: 'UNVERIFIED', reference: `sha256:${'8'.repeat(64)}` };
  const result = validateManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.trusted, false);
  assert.equal(result.deployable, false);
  assert.equal(result.production_acceptance_claim, false);
  assert.equal(result.public_release_disposition, 'NO-GO');
  assert.ok(Object.values(result.target_controls).every(status => status === 'UNVERIFIED'));
});

test('candidate verifier receives only authorized environment keys and does not expose synthetic secret', () => {
  const manifest = syntheticManifest();
  const envName = 'M6_A28C_SYNTHETIC_SECRET';
  const syntheticSecret = 'synthetic-only-test-value-do-not-use';
  process.env[envName] = syntheticSecret;
  let received;
  try {
    const result = runCandidateVerification({
      cwd: '/synthetic/frontend',
      distDirectory: '/synthetic/frontend/.next',
      manifest,
      candidateManifest: { format: 1, complete: true },
      candidateVerifier: options => {
        received = options;
        return { passed: ['synthetic candidate check'], failed: [], unverified: [] };
      },
    });
    assert.deepEqual(Object.keys(received.env).sort(), ['AROMAN_RELEASE_SCOPE', 'NEXT_PUBLIC_AROMAN_API_BASE_URL'].sort());
    assert.equal(received.env.AROMAN_RELEASE_SCOPE, 'public-showcase');
    assert.equal(received.env.NEXT_PUBLIC_AROMAN_API_BASE_URL, '/api/v1');
    assert.deepEqual(result.failed, []);
    assert.equal(JSON.stringify(result).includes(syntheticSecret), false);
  } finally {
    delete process.env[envName];
  }
});

test('missing mandatory fields are rejected', () => {
  const manifest = syntheticManifest();
  delete manifest.sources.backend;
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('sources.backend is required')));
});

test('unknown and secret-like fields are rejected', () => {
  const manifest = syntheticManifest();
  manifest.secrets = 'SYNTHETIC_TEST_VALUE';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('manifest.secrets is not allowed')));
});

test('invalid Frontend or Backend Git revisions are rejected', () => {
  const manifest = syntheticManifest();
  manifest.sources.frontend.revision = 'not-a-full-revision';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('sources.frontend.revision')));
});

test('invalid SHA-256 values are rejected', () => {
  const manifest = syntheticManifest();
  manifest.frontend_candidate.configuration_sha256 = 'abc123';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('configuration_sha256')));
});

test('mutable image tags are rejected', () => {
  const manifest = syntheticManifest();
  manifest.images.frontend = {
    status: 'RECORDED_UNVERIFIED', repository: 'registry.example.invalid/aroman/frontend:latest',
    digest: `sha256:${'0'.repeat(64)}`, platform: 'linux/amd64',
    base_image: `node@sha256:${'1'.repeat(64)}`,
  };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('mutable tag')));
});

test('incorrect Backend pin is rejected', () => {
  const manifest = syntheticManifest();
  manifest.sources.backend.authorized_pin = '0'.repeat(40);
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('authorized_pin')));
});

test('Frontend source identity mismatch against the M6-A25 candidate is rejected', () => {
  const manifest = syntheticManifest();
  const candidate = candidateManifest(manifest);
  candidate.source.revision = 'f'.repeat(40);
  assert.ok(validateManifest(manifest, { candidateManifest: candidate }).errors.some(error => error.includes('source revision')));
});

test('compiled artifact digest mismatch against the candidate is rejected', () => {
  const manifest = syntheticManifest();
  const candidate = candidateManifest(manifest);
  candidate.compiled.artifactSha256 = 'f'.repeat(64);
  assert.ok(validateManifest(manifest, { candidateManifest: candidate }).errors.some(error => error.includes('artifact SHA-256')));
});

test('configuration digest mismatch against the candidate is rejected', () => {
  const manifest = syntheticManifest();
  const candidate = candidateManifest(manifest);
  candidate.compiled.configurationSha256 = 'f'.repeat(64);
  assert.ok(validateManifest(manifest, { candidateManifest: candidate }).errors.some(error => error.includes('configuration SHA-256')));
});

test('fabricated signature verification status is rejected', () => {
  const manifest = syntheticManifest();
  manifest.provenance.signature_verification = { status: 'VERIFIED', reference: 'synthetic://fabricated-signature' };
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('cannot establish trust')));
});

test('untrusted provenance claims are rejected rather than promoted to trusted', () => {
  const manifest = syntheticManifest();
  manifest.provenance.build = { status: 'UNTRUSTED', reference: 'synthetic://untrusted-build' };
  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.equal(result.trusted, false);
});

test('synthetic evidence cannot be presented as production evidence', () => {
  const manifest = syntheticManifest();
  manifest.release_safety.target_controls.catalog_routes = 'PASS';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('must remain UNVERIFIED')));
});

test('any target control marked PASS is rejected', () => {
  const manifest = syntheticManifest();
  manifest.release_safety.target_controls.network_isolation = 'PASS';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('network_isolation must remain UNVERIFIED')));
});

test('public release GO is rejected', () => {
  const manifest = syntheticManifest();
  manifest.release_safety.public_release_disposition = 'GO';
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('must be NO-GO')));
});

test('deployment claim true is rejected', () => {
  const manifest = syntheticManifest();
  manifest.release_safety.deployable = true;
  assert.ok(validateManifest(manifest).errors.some(error => error.includes('deployable must be false')));
});

test('manifest fingerprint is stable across object-key order', () => {
  const manifest = syntheticManifest();
  const reverseKeys = value => {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
    return value;
  };
  const reversed = reverseKeys(manifest);
  assert.equal(canonicalJson(manifest), canonicalJson(reversed));
  assert.equal(manifestFingerprint(manifest), manifestFingerprint(reversed));
});
test('M6-A28C canonicalization golden result remains compatible after helper extraction', () => {
  assert.equal(canonicalJson({ b: [1, 2], a: 1 }), '{"a":1,"b":[1,2]}');
  assert.equal(manifestFingerprint({ b: [1, 2], a: 1 }), '8baa73198470c7bb4c3ce142a8fd651affc0310d878bb9bd159e37a573fb4874');
});

test('manifest tampering changes the deterministic fingerprint', () => {
  const manifest = syntheticManifest();
  const original = manifestFingerprint(manifest);
  manifest.dependencies.frontend.platform = 'linux/arm64';
  assert.notEqual(manifestFingerprint(manifest), original);
});

test('clean-checkout and profile fingerprint references preserve explicit evidence states and reject trust', () => {
  const manifest = syntheticManifest();
  assert.equal(validateManifest(manifest).valid, true);
  manifest.sources.frontend.clean_checkout_attestation = { status: 'OBSERVED_CLEAN', reference: `sha256:${'a'.repeat(64)}` };
  manifest.sources.backend.clean_checkout_attestation = { status: 'STRUCTURALLY_VALID', reference: `sha256:${'b'.repeat(64)}` };
  manifest.runtime_configuration.compose_fingerprints.runtime = { status: 'STRUCTURALLY_VALID', reference: `sha256:${'c'.repeat(64)}`, fingerprint_sha256: 'd'.repeat(64), evidence_class: 'synthetic' };
  const result = validateManifest(manifest);
  assert.equal(result.valid, true); assert.equal(result.deployable, false); assert.equal(result.public_release_disposition, 'NO-GO');
  assert.ok(result.warnings.some(item => item.includes('synthetic')));
  manifest.sources.frontend.clean_checkout_attestation.status = 'TRUST_ESTABLISHED';
  assert.ok(validateManifest(manifest).errors.some(item => item.includes('TRUST_ESTABLISHED')));
});
test('existing M6-A28C v1 manifests remain valid when A28D additive fields are absent', () => {
  const manifest = clone(example);
  delete manifest.sources.backend.clean_checkout_attestation;
  delete manifest.runtime_configuration.compose_fingerprints;
  delete manifest.runtime_configuration.canonicalization_algorithm;
  manifest.sources.frontend.clean_checkout_attestation = { status: 'UNVERIFIED', reference: `sha256:${'e'.repeat(64)}` };
  const result = validateManifest(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.trusted, false);
  assert.equal(result.deployable, false);
  assert.equal(result.public_release_disposition, 'NO-GO');
});

test('CLI emits machine-readable blocked verification for a valid template', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aroman-offline-manifest-'));
  try {
    const input = join(temp, 'manifest.json');
    writeFileSync(input, JSON.stringify(syntheticManifest()));
    const script = resolve('scripts/validate-offline-artifact-manifest.mjs');
    const result = spawnSync(process.execPath, [script, input, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.equal(output.trusted, false);
    assert.equal(output.deployable, false);
    assert.equal(output.public_release_disposition, 'NO-GO');
    assert.ok(Object.values(output.target_controls).every(status => status === 'UNVERIFIED'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
