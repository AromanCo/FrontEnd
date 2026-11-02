import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAttestation } from '../scripts/validate-provenance-attestation.mjs';

const fixture = () => JSON.parse(readFileSync(new URL('../docs/provenance-attestation.example.json', import.meta.url), 'utf8'));
const cli = fileURLToPath(new URL('../scripts/validate-provenance-attestation.mjs', import.meta.url));
const schemaFile = fileURLToPath(new URL('../docs/provenance-attestation.schema.json', import.meta.url));

test('synthetic fixture is structurally valid and untrusted', () => {
  const result = validateAttestation(fixture());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.trusted, false);
  assert.equal(result.deployable, false);
  assert.equal(result.public_release_disposition, 'NO-GO');
  assert.deepEqual(result.summary, ['STRUCTURALLY VALID', 'TRUST NOT ESTABLISHED', 'DEPLOYABLE NO', 'PUBLIC RELEASE NO-GO']);
});

const cases = [
  ['missing required fields', a => { delete a.source; }],
  ['unexpected fields', a => { a.extra = 'x'; }],
  ['malformed artifact digest', a => { a.artifact.immutable_digest = 'sha256:nope'; }],
  ['mutable image tag', a => { a.artifact.immutable_digest = 'registry.invalid/app:latest'; }],
  ['wrong Frontend source identity', a => { a.source.frontend_repository = 'evil/FrontEnd'; }],
  ['wrong Backend pin', a => { a.source.backend_authorized_pin = '1'.repeat(40); }],
  ['mismatched artifact subject digest', a => { a.subject.digest = `sha256:${'c'.repeat(64)}`; }],
  ['mismatched provenance subject', a => { a.subject.artifact_type = 'postgresql-oci-image'; }],
  ['fabricated signer identity', a => { a.builder_identity_claim = { status: 'CLAIMED_UNVERIFIED', value: 'owner-approved-builder' }; }],
  ['fake signature verification', a => { a.signature_verification = 'VERIFIED'; }],
  ['unsupported trust-root reference', a => { a.trust_root = 'root://unapproved'; }],
  ['credential-bearing URL', a => { a.sbom_reference = { status: 'UNVERIFIED', reference: 'https://user:pass@host.invalid/sbom' }; }],
  ['absolute path', a => { a.build_toolchain_identity = '/tmp/toolchain'; }],
  ['UNC absolute path', a => { a.build_toolchain_identity = String.raw`\\host\share\tool`; }],
  ['environment assignment', a => { a.build_toolchain_identity = 'TOKEN=credential'; }],
  ['embedded secret', a => { a.build_toolchain_identity = 'password=secret123'; }],
  ['synthetic evidence labeled production', a => { a.evidence_class = 'production'; }],
  ['unsigned evidence authenticated', a => { a.signer_authentication = 'AUTHENTICATED'; }],
  ['structurally valid evidence deployable', a => { a.deployable = true; }],
  ['production acceptance claimed', a => { a.production_acceptance_claim = true; }],
  ['public GO without authorization', a => { a.public_release_disposition = 'GO'; }],
  ['NOT_CAPTURED reference paired with digest', a => { a.build_invocation_reference = { status: 'NOT_CAPTURED', reference: `sha256:${'a'.repeat(64)}` }; }],
  ['UNVERIFIED reference without digest', a => { a.sbom_reference = { status: 'UNVERIFIED', reference: 'NOT_CAPTURED' }; }],
];
for (const [name, mutate] of cases) test(`rejects ${name}`, () => {
  const result = validateAttestation((() => { const value = fixture(); mutate(value); return value; })());
  assert.equal(result.valid, false);
  assert.equal(result.summary[0], 'STRUCTURALLY INVALID');
});

test('each declared artifact class is accepted only when artifact and subject classes agree', () => {
  for (const type of ['frontend-compiled-candidate', 'frontend-oci-image', 'restricted-catalog-api-oci-image', 'postgresql-oci-image', 'effective-runtime-compose', 'controlled-migration-compose']) {
    const value = fixture();
    value.artifact.type = type;
    value.subject.artifact_type = type;
    assert.equal(validateAttestation(value).valid, true, type);
    value.subject.artifact_type = type === 'effective-runtime-compose' ? 'controlled-migration-compose' : 'effective-runtime-compose';
    assert.equal(validateAttestation(value).valid, false, `${type} profile mismatch`);
  }
});

test('OCI final image digest and base-image digest are distinct identities', () => {
  const value = fixture();
  value.artifact.type = value.subject.artifact_type = 'frontend-oci-image';
  value.artifact.immutable_digest = value.subject.digest = `sha256:${'a'.repeat(64)}`;
  value.base_image_identity = `registry.invalid/base@sha256:${'b'.repeat(64)}`;
  assert.equal(validateAttestation(value).valid, true);
});

test('schema rejects unknown keys and fixes trust fields', () => {
  const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.signature_verification.const, 'UNVERIFIED');
  assert.equal(schema.properties.trust_root.const, 'NOT_CAPTURED');
  assert.equal(schema.$defs.evidence.anyOf[0].properties.reference.const, 'NOT_CAPTURED');
});

test('CLI failures do not echo paths, malformed JSON, or secret-bearing input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aroman-provenance-cli-'));
  try {
    const absent = join(dir, 'private-secret-file.json');
    const missing = spawnSync(process.execPath, [cli, absent], { encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.doesNotMatch(missing.stderr, /private-secret-file|\/tmp\//);
    const malformed = join(dir, 'malformed.json');
    writeFileSync(malformed, '{"token":"ghp_sensitive-value",}');
    const bad = spawnSync(process.execPath, [cli, malformed], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.doesNotMatch(bad.stderr, /ghp_sensitive-value|Unexpected token|malformed\.json/);
    const invalid = join(dir, 'invalid.json');
    writeFileSync(invalid, JSON.stringify({ ...fixture(), public_release_disposition: 'GO' }));
    const invalidResult = spawnSync(process.execPath, [cli, invalid], { encoding: 'utf8' });
    assert.equal(invalidResult.status, 1);
    const result = JSON.parse(invalidResult.stdout);
    assert.equal(result.valid, false);
    assert.equal(result.summary[0], 'STRUCTURALLY INVALID');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
