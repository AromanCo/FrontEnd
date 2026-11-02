#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { backendSha } from './backend-pin.mjs';
import { canonicalJson } from './canonical-json.mjs';

const schema = JSON.parse(readFileSync(new URL('../docs/provenance-attestation.schema.json', import.meta.url), 'utf8'));
const missing = 'NOT_CAPTURED';
function isObj(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function resolveRef(ref) {
  let value = schema;
  for (const part of ref.replace(/^#\//, '').split('/')) value = value[part];
  return value;
}
function check(value, rule, path, errors) {
  if (rule.$ref) return check(value, resolveRef(rule.$ref), path, errors);
  if (rule.anyOf) {
    if (!rule.anyOf.some(candidate => { const found = []; check(value, candidate, path, found); return found.length === 0; })) errors.push(`${path} does not match an allowed schema.`);
    return;
  }
  if (Object.hasOwn(rule, 'const') && value !== rule.const) errors.push(`${path} must equal ${rule.const}.`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${path} has an unsupported value.`);
  if (rule.type === 'object') {
    if (!isObj(value)) { errors.push(`${path} must be an object.`); return; }
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(rule.properties ?? {}, key)) {
        if (rule.additionalProperties === false) errors.push(`${path}.${key} is not allowed.`);
      } else check(value[key], rule.properties[key], `${path}.${key}`, errors);
    }
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value)) { errors.push(`${path} must be an array.`); return; }
    if (rule.minItems && value.length < rule.minItems) errors.push(`${path} must not be empty.`);
    value.forEach((item, index) => check(item, rule.items, `${path}[${index}]`, errors));
  }
  if (rule.type === 'string' && typeof value !== 'string') errors.push(`${path} must be a string.`);
  if (rule.pattern && typeof value === 'string' && !new RegExp(rule.pattern).test(value)) errors.push(`${path} has invalid syntax.`);
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) errors.push(`${path} is too short.`);
  if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) errors.push(`${path} is too long.`);
  if (rule.type === 'boolean' && typeof value !== 'boolean') errors.push(`${path} must be boolean.`);
  if (rule.type === 'integer' && !Number.isInteger(value)) errors.push(`${path} must be an integer.`);
}

export function validateAttestation(attestation) {
  const errors = [];
  check(attestation, schema, 'attestation', errors);
  if (!isObj(attestation)) return report(errors, missing);

  if (attestation.artifact?.type !== attestation.subject?.artifact_type) errors.push('subject.artifact_type must match artifact.type.');
  if (attestation.artifact?.immutable_digest !== attestation.subject?.digest) errors.push('subject.digest must match artifact.immutable_digest.');
  if (attestation.source?.backend_authorized_pin !== backendSha) errors.push('source.backend_authorized_pin does not match configured Backend pin.');
  if (attestation.source?.backend_revision !== missing && attestation.source?.backend_revision !== backendSha) errors.push('source.backend_revision must match authorized Backend pin.');
  if (attestation.evidence_class === 'synthetic_fixture' && attestation.production_acceptance_claim !== false) errors.push('Synthetic evidence cannot make a production acceptance claim.');

  const serialized = JSON.stringify(attestation);
  if (/https?:\/\/[^\s"']*@/i.test(serialized)) errors.push('Credential-bearing URLs are forbidden.');
  if (/(?:^|["\s])(?:\/|[A-Za-z]:\\|\\\\)[^"\s]*/m.test(serialized)) errors.push('Absolute local paths are forbidden.');
  if (/(?:^|["\s])[A-Za-z_][A-Za-z0-9_]*\s*=\s*[^"\s]+/m.test(serialized)) errors.push('Environment assignments are forbidden.');
  if (/(?:password|token|secret|private[_ -]?key|api[_ -]?key)\s*[:=]\s*\S+/i.test(serialized)) errors.push('Embedded secrets are forbidden.');
  return report(errors, createHash('sha256').update(canonicalJson(attestation)).digest('hex'));
}
function report(errors, fingerprintSha256) {
  const valid = errors.length === 0;
  return {
    valid,
    errors,
    fingerprintSha256,
    trusted: false,
    signature_verification: 'UNVERIFIED',
    signer_authentication: 'UNVERIFIED',
    signer_authorization: 'UNVERIFIED',
    deployable: false,
    production_acceptance_claim: false,
    public_release_disposition: 'NO-GO',
    summary: [valid ? 'STRUCTURALLY VALID' : 'STRUCTURALLY INVALID', 'TRUST NOT ESTABLISHED', 'DEPLOYABLE NO', 'PUBLIC RELEASE NO-GO'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/validate-provenance-attestation.mjs <descriptor.json>');
    process.exitCode = 2;
  } else {
    try {
      const result = validateAttestation(JSON.parse(readFileSync(file, 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
    } catch {
      console.error('Unable to read or parse provenance descriptor.');
      process.exitCode = 1;
    }
  }
}
