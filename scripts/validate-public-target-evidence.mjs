#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CONTROLS = Object.freeze([
  'domain_dns', 'https_tls', 'network_isolation', 'catalog_target_routing', 'catalog_routes',
  'excluded_capabilities', 'database_migrations', 'content_provenance', 'environment_secrets',
  'logging', 'monitoring_incident', 'backup_rollback_recovery', 'release_signoff',
]);

const methods = new Set(['automated_probe', 'configuration_inspection', 'independent_review', 'operator_assertion', 'synthetic_fixture']);
const statuses = new Set(['PASS', 'FAIL', 'UNVERIFIED']);
const targetKinds = new Set(['production', 'staging', 'synthetic_fixture', 'repository']);
const passMethods = new Set(['automated_probe', 'configuration_inspection', 'independent_review']);
const secretKey = /(secret|password|passwd|credential|private.?key|access.?token|api.?token|api.?key)/i;
const secretText = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+\S+|\b(?:password|passwd|secret|token|api_key)\s*[:=]\s*\S+/i;
const placeholders = new Set(['', '-', '--', 'n/a', 'na', 'none', 'null', 'unknown', 'unassigned', 'not assigned', 'not captured', 'todo', 'tbd', 'placeholder', 'example']);

function isMeaningful(value) {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && !placeholders.has(value.toLowerCase());
}

function isRevision(value) {
  return isMeaningful(value) && !/\s/.test(value) && !placeholders.has(value.toLowerCase());
}

function isTargetId(value) {
  return isMeaningful(value) && value.length >= 3 && /^[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?$/.test(value);
}

function isReviewer(value) {
  return isMeaningful(value) && value.length >= 2 && !/\s{2,}/.test(value) && !placeholders.has(value.toLowerCase().replace(/[_-]+/g, ' '));
}

function isRfc3339(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, ys, mos, ds, hs, mis, ss, , zone] = match;
  const y = Number(ys), mo = Number(mos), d = Number(ds), h = Number(hs), mi = Number(mis), s = Number(ss);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > days[mo - 1] || h > 23 || mi > 59 || s > 59) return false;
  if (zone !== 'Z') {
    const [zh, zm] = zone.slice(1).split(':').map(Number);
    if (zh > 23 || zm > 59) return false;
  }
  return true;
}

function isEvidenceRef(value) {
  return isMeaningful(value) && value.length >= 3 && !/^[-_.]+$/.test(value) && !/^https?:\/\/$/i.test(value);
}

function isFixtureEvidenceRef(value) {
  return typeof value === 'string' && /^(?:fixture|synthetic)(?::|\/|$)|(?:^|\/)(?:fixtures?|synthetic)(?:\/|$)|(?:^|[._-])example(?:[._-]|$)/i.test(value);
}

export function validatePublicTargetEvidence(document) {
  const errors = [];
  if (!document || typeof document !== 'object' || Array.isArray(document)) return ['Evidence must be a JSON object.'];
  const allowedTop = new Set(['format', 'target_id', 'frontend_revision', 'backend_revision', 'controls']);
  for (const key of Object.keys(document)) if (!allowedTop.has(key)) errors.push(`Unknown top-level field: ${key}`);
  for (const key of ['format', 'target_id', 'frontend_revision', 'backend_revision', 'controls']) if (!(key in document)) errors.push(`Missing field: ${key}`);
  if (document.format !== 1) errors.push('format must be 1.');
  const hasPassClaim = Array.isArray(document.controls) && document.controls.some(control => control && typeof control === 'object' && control.status === 'PASS');
  if (hasPassClaim && !isTargetId(document.target_id)) errors.push('target_id must be a meaningful normalized identifier, not a placeholder, for PASS claims.');
  else if (!hasPassClaim && document.target_id !== 'UNASSIGNED' && !isTargetId(document.target_id)) errors.push('target_id must be UNASSIGNED or a meaningful normalized identifier.');
  for (const key of ['frontend_revision', 'backend_revision']) if (!isRevision(document[key])) errors.push(`${key} must be a meaningful normalized revision identifier.`);
  if (!Array.isArray(document.controls)) return [...errors, 'controls must be an array.'];
  if (document.controls.length !== REQUIRED_CONTROLS.length) errors.push(`controls must contain exactly ${REQUIRED_CONTROLS.length} entries.`);

  const seen = new Set();
  const required = new Set(REQUIRED_CONTROLS);
  document.controls.forEach((control, index) => {
    const prefix = `controls[${index}]`;
    if (!control || typeof control !== 'object' || Array.isArray(control)) { errors.push(`${prefix} must be an object.`); return; }
    for (const key of Object.keys(control)) if (secretKey.test(key)) errors.push(`${prefix} contains a prohibited secret-like field: ${key}`);
    const allowed = new Set(['id', 'status', 'target_kind', 'verified_at', 'method', 'evidence_refs', 'reviewer']);
    for (const key of Object.keys(control)) if (!allowed.has(key)) errors.push(`${prefix} has unknown field: ${key}`);
    if (typeof control.id !== 'string' || !required.has(control.id)) errors.push(`${prefix} has unknown control id: ${control.id}`);
    if (seen.has(control.id)) errors.push(`Duplicate control id: ${control.id}`);
    seen.add(control.id);
    if (!statuses.has(control.status)) errors.push(`${prefix}.status is invalid.`);
    if (!targetKinds.has(control.target_kind)) errors.push(`${prefix}.target_kind is invalid.`);
    if (!methods.has(control.method)) errors.push(`${prefix}.method is invalid.`);
    if (control.status === 'PASS' && !isRfc3339(control.verified_at)) errors.push(`${prefix}.verified_at must be a valid RFC 3339 timestamp with timezone for PASS.`);
    else if (control.status !== 'PASS' && control.verified_at !== 'NOT_CAPTURED' && !isRfc3339(control.verified_at)) errors.push(`${prefix}.verified_at must be NOT_CAPTURED or a valid RFC 3339 timestamp.`);
    if (!Array.isArray(control.evidence_refs) || control.evidence_refs.some(ref => !isEvidenceRef(ref))) errors.push(`${prefix}.evidence_refs must contain only meaningful references; use an empty array when none are available.`);
    if (!isReviewer(control.reviewer) && control.status === 'PASS') errors.push(`${prefix}.reviewer must be a named, normalized reviewer for PASS.`);
    else if (typeof control.reviewer !== 'string' || (control.reviewer !== 'UNASSIGNED' && !isReviewer(control.reviewer))) errors.push(`${prefix}.reviewer must be a normalized reviewer or UNASSIGNED.`);
    if (control.status === 'PASS') {
      if (control.target_kind !== 'production') errors.push(`${prefix} cannot PASS without target_kind production.`);
      if (!passMethods.has(control.method)) errors.push(`${prefix} cannot PASS based on ${control.method}.`);
      if (Array.isArray(control.evidence_refs) && control.evidence_refs.some(isFixtureEvidenceRef)) errors.push(`${prefix} cannot use fixture/example evidence references for a production PASS.`);
      if (!isTargetId(document.target_id)) errors.push(`${prefix} cannot support PASS for an invalid production target_id.`);
      if (!Array.isArray(control.evidence_refs) || control.evidence_refs.length === 0 || control.evidence_refs.some(ref => !isEvidenceRef(ref))) errors.push(`${prefix} cannot PASS without meaningful evidence references.`);
      if (!isReviewer(control.reviewer)) errors.push(`${prefix} cannot PASS without a named reviewer.`);
    }
  });
  for (const id of REQUIRED_CONTROLS) if (!seen.has(id)) errors.push(`Missing required control: ${id}`);
  const scan = value => {
    if (typeof value === 'string' && secretText.test(value)) errors.push('Evidence contains text resembling a credential or secret.');
    else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === 'object') Object.values(value).forEach(scan);
  };
  scan(document);
  return [...new Set(errors)];
}

export function main(argv = process.argv.slice(2)) {
  const file = argv[0];
  if (!file || argv.length !== 1) { console.error('Usage: npm run validate:public-target-evidence -- <evidence.json>'); return 2; }
  try {
    const document = JSON.parse(readFileSync(file, 'utf8'));
    const errors = validatePublicTargetEvidence(document);
    if (errors.length) { for (const error of errors) console.error(`FAIL ${error}`); return 1; }
    const passed = document.controls.filter(item => item.status === 'PASS').length;
    const unverified = document.controls.filter(item => item.status === 'UNVERIFIED').length;
    console.log(`VALID evidence structure; ${passed} PASS, ${unverified} UNVERIFIED. This offline check validates claim structure only; it does not authenticate evidence, verify target state, or authorize release.`);
    return 0;
  } catch (error) {
    console.error(`FAIL Unable to read or parse evidence JSON: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
