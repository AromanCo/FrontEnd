import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assessPublicReleaseGate } from '../scripts/assess-public-release-gate.mjs';
import { assessDecisionCompletion, validateLaunchDecisions } from '../scripts/validate-launch-decisions.mjs';

const root = resolve(import.meta.dirname, '..');
const openRecord = JSON.parse(readFileSync(resolve(root, 'docs/launch-decisions.example.json'), 'utf8'));
const evidenceTemplate = JSON.parse(readFileSync(resolve(root, 'docs/public-target-evidence.example.json'), 'utf8'));

test('current decision packet preserves all twelve OPEN decisions and exposes missing responsibilities', () => {
  const result = assessDecisionCompletion(openRecord);
  assert.equal(result.unresolved.length, 12);
  assert.ok(result.errors.some(error => error.includes('Responsibilities are undefined')));
  assert.ok(result.errors.some(error => error.includes('retention_policy')));
  assert.ok(result.errors.some(error => error.includes('recovery_objectives')));
  assert.ok(result.errors.some(error => error.includes('release_authority')));
});

test('decision validator rejects missing required decisions and incomplete resolved decisions', () => {
  const missing = structuredClone(openRecord);
  missing.decisions.pop();
  assert.ok(validateLaunchDecisions(missing).some(error => error.includes('Missing required decision')));
  const incomplete = structuredClone(openRecord);
  Object.assign(incomplete.decisions[0], { status: 'RESOLVED', choice: 'PUBLIC' });
  assert.ok(validateLaunchDecisions(incomplete).some(error => error.includes('requires choice')));
});

test('decision validator rejects contradictory public topology and database grants', () => {
  const record = { ...structuredClone(openRecord), architecture: { target: 'PUBLIC', frontendPublic: true, backendPublic: true, runtimeDatabaseAccess: 'READ_WRITE' } };
  const errors = validateLaunchDecisions(record);
  assert.ok(errors.some(error => error.includes('Contradictory topology')));
  assert.ok(errors.some(error => error.includes('SELECT_ONLY')));
});

test('incomplete and synthetic target evidence cannot authorize a release', () => {
  const incomplete = assessPublicReleaseGate({ evidence: evidenceTemplate, decisions: openRecord, independentReview: true, ownerApproval: { status: 'GO', owner: 'Owner Role', approvedAt: '2026-10-30T12:00:00Z' } });
  assert.equal(incomplete.status, 'NO-GO');
  assert.ok(incomplete.reasons.some(reason => reason.includes('All 13 controls')));
  const synthetic = structuredClone(evidenceTemplate);
  synthetic.controls = synthetic.controls.map(control => ({ ...control, status: 'PASS', target_kind: 'synthetic_fixture', verified_at: '2026-10-30T12:00:00Z', method: 'synthetic_fixture', evidence_refs: ['fixture:synthetic'], reviewer: 'Reviewer' }));
  const blocked = assessPublicReleaseGate({ evidence: synthetic, decisions: openRecord, candidate: { passed: ['Compiled artifact file digest and file count match.'], failed: [] }, independentReview: true, ownerApproval: { status: 'GO', owner: 'Owner Role', approvedAt: '2026-10-30T12:00:00Z' } });
  assert.equal(blocked.status, 'NO-GO');
  assert.ok(blocked.reasons.some(reason => reason.includes('invalid')) || blocked.reasons.some(reason => reason.includes('Synthetic')));
});

test('valid local candidate identity remains production NO-GO without decisions, target evidence and approval', () => {
  const candidate = {
    passed: ['Release scope matches', 'Pinned Backend revision matches', 'Frontend source revision and source tree digest match', 'Compiled browser JavaScript contains the declared API base', 'Non-secret compiled configuration identity matches', 'Build metadata, Node/Next versions and dependency lock identity match', 'Compiled public build metadata matches', 'Compiled artifact file digest and file count match'],
    failed: [], unverified: ['Production target evidence is unavailable and remains UNVERIFIED.'],
    identity: { frontendRevision: evidenceTemplate.frontend_revision, sourceTreeSha256: 'c'.repeat(64), backendRevision: evidenceTemplate.backend_revision, artifactSha256: 'b'.repeat(64) },
  };
  const result = assessPublicReleaseGate({ candidate, decisions: openRecord, evidence: evidenceTemplate });
  assert.equal(result.status, 'NO-GO');
  assert.ok(result.reasons.length >= 4);
  assert.ok(!result.reasons.some(reason => reason.includes('Candidate integrity')));
});

test('apparently complete JSON and asserted approvals cannot bypass unresolved owner decisions', () => {
  const submitted = structuredClone(evidenceTemplate);
  submitted.target_id = 'prod-target-01';
  submitted.controls = submitted.controls.map(control => ({
    ...control, status: 'PASS', target_kind: 'production', verified_at: '2026-10-30T12:00:00Z',
    method: 'independent_review', evidence_refs: [`record:claim-${control.id}`], reviewer: 'Named Reviewer',
  }));
  const candidate = {
    passed: ['Release scope matches', 'Pinned Backend revision matches', 'Frontend source revision and source tree digest match', 'Compiled browser JavaScript contains the declared API base', 'Non-secret compiled configuration identity matches', 'Build metadata, Node/Next versions and dependency lock identity match', 'Compiled public build metadata matches', 'Compiled artifact file digest and file count match'],
    failed: [], identity: { frontendRevision: submitted.frontend_revision, sourceTreeSha256: 'c'.repeat(64), backendRevision: submitted.backend_revision, artifactSha256: 'b'.repeat(64) },
  };
  const result = assessPublicReleaseGate({ candidate, decisions: openRecord, evidence: submitted, independentReview: true, ownerApproval: { status: 'GO', owner: 'Project Owner', approvedAt: '2026-10-30T12:00:00Z' } });
  assert.equal(result.status, 'NO-GO');
  assert.ok(result.reasons.includes('Required owner decisions or responsibilities remain incomplete.'));
});
