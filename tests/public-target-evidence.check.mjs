import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { main, REQUIRED_CONTROLS, validatePublicTargetEvidence } from '../scripts/validate-public-target-evidence.mjs';

const example = JSON.parse(readFileSync(new URL('../docs/public-target-evidence.example.json', import.meta.url), 'utf8'));
const validPassDocument = () => {
  const document = structuredClone(example);
  document.target_id = 'prod-eu-01';
  document.controls[0] = { id: REQUIRED_CONTROLS[0], status: 'PASS', target_kind: 'production', verified_at: '2026-10-30T12:30:45+03:30', method: 'independent_review', evidence_refs: ['change:CHG-1931/review'], reviewer: 'Reviewer One' };
  return document;
};
const setFirstPass = (mutate = () => {}) => {
  const document = validPassDocument();
  mutate(document, document.controls[0]);
  return document;
};
const failsWith = (document, fragment) => assert.ok(validatePublicTargetEvidence(document).some(error => error.includes(fragment)), `expected ${fragment}; got ${validatePublicTargetEvidence(document).join('; ')}`);

test('example has exactly 13 distinct controls and remains 0 PASS / 13 UNVERIFIED', () => {
  assert.deepEqual(validatePublicTargetEvidence(example), []);
  assert.equal(example.controls.length, 13);
  assert.deepEqual(new Set(example.controls.map(control => control.id)), new Set(REQUIRED_CONTROLS));
  assert.equal(example.controls.filter(control => control.status === 'PASS').length, 0);
  assert.equal(example.controls.filter(control => control.status === 'UNVERIFIED').length, 13);
});

test('schema declares the same control IDs and cardinality as the offline validator', () => {
  const schema = JSON.parse(readFileSync(new URL('../docs/public-target-evidence.schema.json', import.meta.url), 'utf8'));
  const declared = schema.$defs.control.properties.id.enum;
  assert.deepEqual(declared, REQUIRED_CONTROLS);
  assert.equal(schema.properties.controls.minItems, REQUIRED_CONTROLS.length);
  assert.equal(schema.properties.controls.maxItems, REQUIRED_CONTROLS.length);
});

test('a complete, structured production PASS claim is accepted as a claim only', () => {
  assert.deepEqual(validatePublicTargetEvidence(validPassDocument()), []);
});

test('production PASS rejects placeholders and malformed target identifiers', () => {
  for (const target of ['UNASSIGNED', 'unknown', 'N/A', '-', ' prod ', 'a', 'target/one']) {
    failsWith(setFirstPass(document => { document.target_id = target; }), 'target_id');
  }
});

test('incomplete packages allow the example target placeholder but reject malformed target values', () => {
  assert.deepEqual(validatePublicTargetEvidence(example), []);
  for (const target of ['', ' ', 'unknown', 'target/one']) {
    const document = structuredClone(example); document.target_id = target; assert.notDeepEqual(validatePublicTargetEvidence(document), []);
  }
});

test('PASS timestamps require RFC 3339 timezone and real calendar values', () => {
  for (const timestamp of ['not-a-date', '2026-10-30T12:00:00', '2026-02-30T12:00:00Z', '2026-13-01T00:00:00Z', '2026-10-30T25:00:00Z', '2026-10-30T12:00:00+25:00', '2026-10-30 12:00:00Z']) {
    failsWith(setFirstPass((_, control) => { control.verified_at = timestamp; }), 'verified_at');
  }
  assert.deepEqual(validatePublicTargetEvidence(setFirstPass((_, control) => { control.verified_at = '2024-02-29T23:59:59.123Z'; })), []);
});

test('PASS rejects unassigned, placeholder, and whitespace-padded reviewers', () => {
  for (const reviewer of ['UNASSIGNED', 'UNASSIGNED ', 'unknown', ' - ', 'A']) {
    failsWith(setFirstPass((_, control) => { control.reviewer = reviewer; }), 'reviewer');
  }
});

test('PASS requires meaningful evidence references', () => {
  for (const refs of [[], ['-'], ['   '], ['N/A'], ['https://'], ['placeholder']]) {
    failsWith(setFirstPass((_, control) => { control.evidence_refs = refs; }), 'evidence');
  }
  assert.deepEqual(validatePublicTargetEvidence(setFirstPass((_, control) => { control.evidence_refs = ['https://evidence.example/review/1931']; })), []);
});

test('missing, duplicate, unknown, and excess controls fail closed', () => {
  const missing = structuredClone(example); missing.controls.pop(); failsWith(missing, 'exactly 13'); failsWith(missing, 'Missing required control');
  const duplicate = structuredClone(example); duplicate.controls[1].id = duplicate.controls[0].id; failsWith(duplicate, 'Duplicate control id');
  const unknown = structuredClone(example); unknown.controls[0].id = 'not_a_control'; failsWith(unknown, 'unknown control id');
  const excess = structuredClone(example); excess.controls.push(structuredClone(excess.controls[0])); failsWith(excess, 'exactly 13');
});

test('unsupported statuses, methods, target kinds, and unknown fields fail', () => {
  for (const [key, value, message] of [['status', 'PENDING', '.status'], ['method', 'manual_guess', '.method'], ['target_kind', 'demo', '.target_kind'], ['extra', 'x', 'unknown field']]) {
    const document = structuredClone(example); document.controls[0][key] = value; failsWith(document, message);
  }
});

test('incomplete and unverified evidence may retain explicit missing values, but malformed references fail', () => {
  assert.deepEqual(validatePublicTargetEvidence(example), []);
  const malformed = structuredClone(example); malformed.controls[0].evidence_refs = ['-']; failsWith(malformed, 'evidence_refs');
  const mixed = structuredClone(validPassDocument()); assert.equal(validatePublicTargetEvidence(mixed).length, 0);
  assert.equal(mixed.controls.filter(control => control.status === 'PASS').length, 1);
  assert.equal(mixed.controls.filter(control => control.status === 'UNVERIFIED').length, 12);
});

test('synthetic, repository, staging, operator assertion, and fixture claims cannot pass production controls', () => {
  const cases = [
    control => { control.target_kind = 'synthetic_fixture'; },
    control => { control.target_kind = 'repository'; },
    control => { control.target_kind = 'staging'; },
    control => { control.method = 'operator_assertion'; },
    control => { control.method = 'synthetic_fixture'; },
  ];
  for (const mutate of cases) assert.notDeepEqual(validatePublicTargetEvidence(setFirstPass((_, control) => mutate(control))), []);
});

test('secret-like fields and values are rejected', () => {
  const withSecretField = structuredClone(example); withSecretField.controls[0].api_token = 'do-not-store'; failsWith(withSecretField, 'secret-like field');
  const withSecretText = structuredClone(example); withSecretText.controls[0].evidence_refs = ['Authorization: Bearer abc123']; failsWith(withSecretText, 'resembling a credential');
});

test('validator rejects incorrect input structures, malformed JSON, missing files, and wrong CLI arity', () => {
  for (const value of [null, [], 'text', 1]) assert.notDeepEqual(validatePublicTargetEvidence(value), []);
  assert.equal(main([]), 2);
  assert.equal(main(['/definitely/missing/public-evidence.json']), 1);
  assert.equal(main([new URL('../docs/M6_A23_PUBLIC_TARGET_READINESS.md', import.meta.url).pathname]), 1);
  assert.equal(main(['/dev/null', 'extra']), 2);
});
