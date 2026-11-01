import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_CANDIDATE_FIELDS, REQUIRED_TARGET_CONTROLS, validatePrivateReleaseRecord } from '../scripts/validate-private-release-record.mjs';

const record = () => ({
  format: 1, purpose: 'private-preproduction-candidate-preparation', evidence_kind: 'not-captured',
  public_release_disposition: 'NO-GO', production_target_controls: 'UNVERIFIED',
  target_control_statuses: Object.fromEntries(REQUIRED_TARGET_CONTROLS.map(id => [id, 'UNVERIFIED'])),
  production_acceptance_claim: false, deployable_claim: false,
  slots: Object.fromEntries(REQUIRED_CANDIDATE_FIELDS.map(key => [key, 'NOT_CAPTURED'])),
});

test('empty release preparation slots remain blocked and never become a deployable claim', () => {
  const result = validatePrivateReleaseRecord(record());
  assert.equal(result.validForPreparation, false);
  assert.equal(result.deployable, false);
  assert.equal(result.publicRelease, 'NO-GO');
  assert.equal(result.productionTargetControls, 'UNVERIFIED');
  assert.ok(result.errors.some(item => item.includes('frontend_compiled_artifact_sha256')));
});

test('complete looking synthetic values still cannot claim production acceptance or GO', () => {
  const complete = record();
  complete.evidence_kind = 'synthetic_fixture';
  for (const key of REQUIRED_CANDIDATE_FIELDS) {
    if (key.endsWith('_references')) complete.slots[key] = ['synthetic-fixture://example'];
    else if (key.endsWith('_revision')) complete.slots[key] = 'a'.repeat(40);
    else if (key.endsWith('_sha256')) complete.slots[key] = 'b'.repeat(64);
    else if (key.endsWith('_digest')) complete.slots[key] = `registry.invalid/example@sha256:${'c'.repeat(64)}`;
    else complete.slots[key] = `synthetic-${key}`;
  }
  complete.production_acceptance_claim = true;
  complete.public_release_disposition = 'GO';
  const result = validatePrivateReleaseRecord(complete);
  assert.equal(result.validForPreparation, false);
  assert.equal(result.deployable, false);
  assert.equal(result.publicRelease, 'NO-GO');
  assert.ok(result.errors.some(item => item.includes('must remain NO-GO')));
  assert.ok(result.errors.some(item => item.includes('must be false')));
});

test('missing a candidate digest slot keeps preparation incomplete', () => {
  const complete = record();
  for (const key of REQUIRED_CANDIDATE_FIELDS) {
    if (key.endsWith('_references')) complete.slots[key] = ['controlled://evidence/approved-after-review'];
    else if (key.endsWith('_revision')) complete.slots[key] = 'a'.repeat(40);
    else if (key.endsWith('_sha256')) complete.slots[key] = 'b'.repeat(64);
    else if (key.endsWith('_digest')) complete.slots[key] = `registry.invalid/example@sha256:${'c'.repeat(64)}`;
    else complete.slots[key] = `captured-${key}`;
  }
  const result = validatePrivateReleaseRecord(complete);
  assert.equal(result.validForPreparation, true);
  assert.equal(result.deployable, false);
  complete.slots.frontend_container_image_digest = 'latest';
  assert.equal(validatePrivateReleaseRecord(complete).validForPreparation, false);
});

test('any synthetic PASS target control invalidates the review record', () => {
  const invalid = record();
  invalid.target_control_statuses.network_isolation = 'PASS';
  assert.equal(validatePrivateReleaseRecord(invalid).validForPreparation, false);
});
