import { REQUIRED_CONTROLS, validatePublicTargetEvidence } from './validate-public-target-evidence.mjs';
import { assessDecisionCompletion } from './validate-launch-decisions.mjs';
import { backendSha } from './backend-pin.mjs';

export function assessPublicReleaseGate({ candidate, decisions, evidence, independentReview, ownerApproval } = {}) {
  const reasons = [];
  const requiredCandidateChecks = [
    'Release scope matches', 'Pinned Backend revision', 'Frontend source revision and source tree digest',
    'Compiled browser JavaScript contains the declared API base', 'Non-secret compiled configuration identity', 'Build metadata, Node/Next versions',
    'Compiled public build metadata', 'Compiled artifact file digest and file count',
  ];
  const candidateVerified = Array.isArray(candidate?.passed) && Array.isArray(candidate?.failed) && candidate.failed.length === 0
    && requiredCandidateChecks.every(check => candidate.passed.some(item => item.includes(check)))
    && /^[a-f0-9]{40}$/.test(candidate.identity?.frontendRevision ?? '')
    && /^[a-f0-9]{40}$/.test(candidate.identity?.backendRevision ?? '')
    && /^[a-f0-9]{64}$/.test(candidate.identity?.sourceTreeSha256 ?? '')
    && candidate.identity?.backendRevision === backendSha
    && /^[a-f0-9]{64}$/.test(candidate.identity?.artifactSha256 ?? '');
  if (!candidateVerified) reasons.push('Candidate integrity has not been verified.');
  if (decisions) {
    const decision = assessDecisionCompletion(decisions);
    if (decision.errors.length || decision.unresolved.length) reasons.push('Required owner decisions or responsibilities remain incomplete.');
  } else reasons.push('Owner decision record is missing.');
  const evidenceErrors = validatePublicTargetEvidence(evidence);
  if (evidenceErrors.length) reasons.push('Target evidence package is invalid.');
  if (evidence && candidate?.identity && (evidence.frontend_revision !== candidate.identity.frontendRevision || evidence.backend_revision !== candidate.identity.backendRevision)) reasons.push('Target evidence revisions do not match the verified candidate identity.');
  const controls = Array.isArray(evidence?.controls) ? evidence.controls : [];
  if (controls.length !== REQUIRED_CONTROLS.length || controls.some(control => !control || control.status !== 'PASS' || control.target_kind !== 'production')) reasons.push('All 13 controls must have production PASS evidence.');
  if (controls.some(control => control?.method === 'synthetic_fixture' || control?.target_kind === 'synthetic_fixture')) reasons.push('Synthetic fixture evidence cannot satisfy target acceptance.');
  if (independentReview !== true) reasons.push('Independent review is not approved.');
  if (!ownerApproval || ownerApproval.status !== 'GO' || typeof ownerApproval.owner !== 'string' || !ownerApproval.owner.trim()
    || typeof ownerApproval.approvedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(ownerApproval.approvedAt)) reasons.push('Actual owner GO approval is missing.');
  return { status: reasons.length ? 'NO-GO' : 'REVIEW REQUIRED', reasons: [...new Set(reasons)] };
}
