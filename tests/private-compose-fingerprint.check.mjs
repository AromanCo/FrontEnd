import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson, canonicalSha256 } from '../scripts/canonical-json.mjs';
import { buildFingerprint, composeFingerprintPayload, COMPOSE_PROFILES, normalizeConfig, readFingerprintInput, renderSyntheticCompose, safeComposeFailureMessage } from '../scripts/fingerprint-private-compose.mjs';

const base = () => ({
  format: 1, profile: 'default', canonicalization_algorithm: 'aroman-canonical-json-v1',
  docker_compose_version: 'Docker Compose version v2.0.0',
  compose_source: { path: 'deploy/private-preproduction/compose.yaml', sha256: 'a'.repeat(64) },
  inputs: [{ path: 'deploy/private-preproduction/compose.yaml', sha256: 'a'.repeat(64) }],
  rendered_compose: { services: { web: { image: 'registry.invalid/web@sha256:abc', ports: [{ target: 3000, published: 18443 }, { target: 3001, published: 18444 }], environment: { ORIGIN: 'https://synthetic.invalid' }, secrets: ['secret://otp_pepper'] } } },
});
const fp = value => canonicalSha256(value);

test('canonical Compose envelopes are deterministic and ignore object key ordering', () => {
  const first = base(); const reversed = Object.fromEntries(Object.entries(first).reverse());
  assert.equal(canonicalJson(first), canonicalJson(reversed)); assert.equal(fp(first), fp(reversed));
});
test('canonicalization preserves array order', () => {
  const first = base(); const second = base(); second.rendered_compose.services.web.ports.reverse();
  assert.notEqual(fp(first), fp(second));
});
test('repeated equivalent effective envelopes yield the same fingerprint without timestamp input', () => {
  const payload = base();
  const left = composeFingerprintPayload({ profile: payload.profile, composeVersion: payload.docker_compose_version,
    normalizedCompose: payload.rendered_compose, inputs: payload.inputs, composeSource: payload.compose_source });
  const right = composeFingerprintPayload({ profile: payload.profile, composeVersion: payload.docker_compose_version,
    normalizedCompose: structuredClone(payload.rendered_compose), inputs: structuredClone(payload.inputs), composeSource: structuredClone(payload.compose_source) });
  assert.equal(canonicalSha256(left), canonicalSha256(right));
});
test('effective image, port, origin, secret reference, profile, Compose source, grants and Dockerfile inputs affect fingerprint', () => {
  const original = base();
  for (const mutate of [
    v => { v.rendered_compose.services.web.image = 'registry.invalid/web@sha256:def'; },
    v => { v.rendered_compose.services.web.ports[0].published = 18444; },
    v => { v.rendered_compose.services.web.environment.ORIGIN = 'https://changed.invalid'; },
    v => { v.rendered_compose.services.web.secrets[0] = 'secret://session_pepper'; },
    v => { v.profile = COMPOSE_PROFILES.migration; },
    v => { v.compose_source.sha256 = 'b'.repeat(64); },
    v => { v.inputs.push({ path: 'deploy/private-preproduction/apply-catalog-read-only-grants.py', sha256: 'c'.repeat(64) }); },
    v => { v.inputs.push({ path: 'deploy/private-preproduction/Dockerfile.frontend', sha256: 'd'.repeat(64) }); },
  ]) { const changed = structuredClone(original); mutate(changed); assert.notEqual(fp(original), fp(changed)); }
});
test('fingerprint payload has no timestamp and labels synthetic unsigned evidence as non-deployable', () => {
  const payload = composeFingerprintPayload({ profile: 'default', composeVersion: 'Docker Compose version v2.0.0', normalizedCompose: {}, inputs: [], composeSource: {} });
  assert.equal(Object.hasOwn(payload, 'observed_at'), false);
  const source = readFileSync(new URL('../scripts/fingerprint-private-compose.mjs', import.meta.url), 'utf8');
  assert.match(source, /signed: false, trust_established: false, deployable: false, evidence_class: 'synthetic'/);
});
test('unexpected and caller supplied environment variables are rejected before rendering', () => {
  assert.throws(() => renderSyntheticCompose({ profile: 'default', composeVersion: 'Docker Compose version v2.0.0', environment: { AWS_SECRET_ACCESS_KEY: 'never-read' } }), /Unexpected Compose interpolation variable/);
  assert.throws(() => renderSyntheticCompose({ profile: 'default', composeVersion: 'Docker Compose version v2.0.0', environment: { AROMAN_FRONTEND_HOST_PORT: '1234' } }), /built-in synthetic/);
});
test('unsafe effective Compose structures are rejected by the existing security validator', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'aroman-compose-test-'));
  try {
    const names = ['catalog_runtime_database_url', 'database_bootstrap_password', 'catalog_migration_password', 'catalog_runtime_password', 'otp_pepper', 'session_pepper'];
    const config = { secrets: Object.fromEntries(names.map(name => [name, { file: resolve(temp, name) }])) };
    assert.throws(() => buildFingerprint({ config, profile: 'default', composeVersion: 'Docker Compose version v2.0.0', syntheticSecretRoot: temp }), /Unsafe effective Compose configuration/);
    assert.throws(() => buildFingerprint({ config, profile: 'default', composeVersion: 'Docker Compose version v2.0.0' }), /temporary synthetic secret directory/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('only source inputs from the fixed repository allowlist are read and actual secrets are not loaded', () => {
  const source = readFileSync(new URL('../scripts/fingerprint-private-compose.mjs', import.meta.url), 'utf8');
  assert.match(source, /const REQUIRED_INPUT_FILES = Object\.freeze\(/);
  assert.doesNotMatch(source, /readFileSync\([^\n]*(?:secret|\.env)/i);
  assert.equal(source.includes('...process.env'), false);
});
test('host file paths normalize to logical references and secret contents are not represented', () => {
  const normalized = normalizeConfig({ secrets: { otp_pepper: { file: '/tmp/first/otp_pepper' } }, configs: { role: { file: resolve('deploy/private-preproduction/database-role-init.sh') } } });
  const sameLogicalSecret = normalizeConfig({ secrets: { otp_pepper: { file: '/tmp/second/otp_pepper' } }, configs: { role: { file: resolve('deploy/private-preproduction/database-role-init.sh') } } });
  assert.deepEqual(normalized, { secrets: { otp_pepper: { file: 'secret://otp_pepper' } }, configs: { role: { file: 'repo://deploy/private-preproduction/database-role-init.sh' } } });
  assert.deepEqual(normalized, sameLogicalSecret);
  const changedSecret = normalizeConfig({ secrets: { session_pepper: { file: '/tmp/second/session_pepper' } } });
  assert.notEqual(canonicalSha256(normalized), canonicalSha256(changedSecret));
  assert.equal(JSON.stringify(normalized).includes('/tmp/'), false);
  assert.throws(() => normalizeConfig({ arbitrary: { file: '/etc/passwd' } }), /unrecognized absolute file path/);
});
test('fingerprint input reader rejects symlinked files and path traversal', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'fingerprint-input-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'inputs')); writeFileSync(resolve(root, 'external'), 'sensitive fixture');
  symlinkSync(resolve(root, 'external'), resolve(root, 'inputs', 'linked'));
  assert.throws(() => readFingerprintInput(root, 'inputs/linked'), /without symlink/);
  assert.throws(() => readFingerprintInput(root, '../external'), /path is unsafe/);
});
test('Compose CLI failures are surfaced as failures without leaking stderr details', () => {
  assert.equal(safeComposeFailureMessage(new Error('Docker Compose CLI is unavailable.')), 'Docker Compose CLI is unavailable.');
  assert.equal(safeComposeFailureMessage(new Error('Docker Compose config rendering failed; details suppressed.')), 'Docker Compose config rendering failed; details suppressed.');
  assert.equal(safeComposeFailureMessage(new Error('/tmp/private/password')), 'Compose fingerprint generation failed; local paths and environment details were suppressed.');
});
