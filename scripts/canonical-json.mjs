import { createHash } from 'node:crypto';

export const CANONICALIZATION_ALGORITHM = 'aroman-canonical-json-v1';

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

// Project-specific canonical form: UTF-16 key ordering, preserve arrays, JSON.stringify.
// This is not an implementation of RFC 8785.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Canonical JSON does not accept non-finite numbers.');
  if (value === undefined || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Canonical JSON accepts only JSON values.');
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return createHash('sha256').update(Buffer.from(canonicalJson(value), 'utf8')).digest('hex');
}
