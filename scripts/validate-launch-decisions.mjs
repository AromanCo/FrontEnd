import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DECISION_IDS = Object.freeze(Array.from({ length: 12 }, (_, index) => `D${index + 1}`));

export function validateLaunchDecisions(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Decision record must be an object.'];
  if (record.format !== 1 || !Array.isArray(record.decisions)) errors.push('Decision record must have format 1 and a decisions array.');
  const entries = new Map();
  for (const decision of Array.isArray(record.decisions) ? record.decisions : []) {
    if (!decision || typeof decision !== 'object' || !DECISION_IDS.includes(decision.id)) { errors.push('Decision record contains an unknown or invalid decision.'); continue; }
    if (entries.has(decision.id)) errors.push(`Duplicate decision: ${decision.id}`);
    entries.set(decision.id, decision);
    if (!['OPEN', 'RESOLVED'].includes(decision.status)) errors.push(`${decision.id} status must be OPEN or RESOLVED.`);
    if (decision.status === 'RESOLVED' && ['choice', 'owner', 'rationale', 'approved_at'].some(key => typeof decision[key] !== 'string' || !decision[key].trim())) errors.push(`${decision.id} resolved decision requires choice, owner, rationale and approval time.`);
  }
  for (const id of DECISION_IDS) if (!entries.has(id)) errors.push(`Missing required decision: ${id}`);
  const architecture = record.architecture;
  if (architecture !== undefined) {
    if (!architecture || typeof architecture !== 'object' || Array.isArray(architecture)) errors.push('architecture must be an object.');
    else {
      if (architecture.frontendPublic !== undefined && typeof architecture.frontendPublic !== 'boolean') errors.push('architecture.frontendPublic must be boolean.');
      if (architecture.backendPublic !== undefined && typeof architecture.backendPublic !== 'boolean') errors.push('architecture.backendPublic must be boolean.');
      if (architecture.frontendPublic === true && architecture.backendPublic === true) errors.push('Contradictory topology: the restricted Backend cannot be directly public when the Frontend is public.');
      if (architecture.runtimeDatabaseAccess !== undefined && architecture.runtimeDatabaseAccess !== 'SELECT_ONLY') errors.push('Runtime database access must be SELECT_ONLY.');
      if (architecture.target !== undefined && !['PUBLIC', 'PRIVATE', 'DEFERRED'].includes(architecture.target)) errors.push('architecture.target must be PUBLIC, PRIVATE or DEFERRED.');
    }
  }
  return [...new Set(errors)];
}

export function assessDecisionCompletion(record) {
  const errors = validateLaunchDecisions(record);
  const open = (Array.isArray(record?.decisions) ? record.decisions : []).filter(item => item?.status !== 'RESOLVED').map(item => item?.id).filter(Boolean);
  const unresolved = DECISION_IDS.filter(id => open.includes(id));
  if (record?.responsibilities && typeof record.responsibilities === 'object') {
    for (const role of ['operations', 'database', 'incident', 'release', 'recovery', 'independent_review', 'owner_approval']) {
      if (typeof record.responsibilities[role] !== 'string' || !record.responsibilities[role].trim() || record.responsibilities[role] === 'UNASSIGNED') errors.push(`Responsibility is undefined: ${role}.`);
    }
  } else errors.push('Responsibilities are undefined.');
  for (const key of ['retention_policy', 'recovery_objectives', 'release_authority']) {
    if (typeof record?.[key] !== 'string' || !record[key].trim()) errors.push(`${key} must be explicitly supplied.`);
  }
  return { errors: [...new Set(errors)], unresolved };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) { console.error('Usage: node scripts/validate-launch-decisions.mjs <decision-record.json>'); return 2; }
  try {
    const record = JSON.parse(readFileSync(argv[0], 'utf8'));
    const result = assessDecisionCompletion(record);
    for (const id of result.unresolved) console.log(`OPEN ${id}`);
    for (const error of result.errors) console.error(`INCOMPLETE ${error}`);
    if (!result.errors.length && !result.unresolved.length) console.log('Decision record is complete for review; this check does not authenticate owners or signatures.');
    return result.errors.length || result.unresolved.length ? 1 : 0;
  } catch (error) { console.error(`Unable to read decision record: ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
