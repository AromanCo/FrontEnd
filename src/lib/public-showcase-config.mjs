import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_BASE_PATH = '/api/v1';

function ipv4Octets(host) {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every(part => part >= 0 && part <= 255) ? octets : null;
}

function ipv6Words(address) {
  const words = [];
  for (const part of address.toLowerCase().split(':')) {
    if (part.includes('.')) {
      const octets = ipv4Octets(part);
      if (!octets) return null;
      words.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
    } else if (/^[0-9a-f]{1,4}$/.test(part)) words.push(Number.parseInt(part, 16));
    else return null;
  }
  return words.length === 8 ? words : null;
}

function normalizedIPv6Words(address) {
  const splitAt = address.indexOf('::');
  if (splitAt < 0) return ipv6Words(address);
  const leftText = address.slice(0, splitAt);
  const rightText = address.slice(splitAt + 2);
  const parseSide = text => {
    if (!text) return [];
    const out = [];
    for (const part of text.split(':')) {
      if (part.includes('.')) {
        const octets = ipv4Octets(part);
        if (!octets) return null;
        out.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else if (/^[0-9a-f]{1,4}$/i.test(part)) out.push(Number.parseInt(part, 16));
      else return null;
    }
    return out;
  };
  const left = parseSide(leftText);
  const right = parseSide(rightText);
  if (!left || !right || left.length + right.length >= 8) return null;
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

function isLoopbackHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'localhost.localdomain'
    || host === 'ip6-localhost' || host === 'ip6-loopback' || host === 'localhost6'
    || host === 'localhost6.localdomain6') return true;
  const ipv4 = ipv4Octets(host);
  if (ipv4) return ipv4[0] === 127;
  if (host.includes(':')) {
    const words = normalizedIPv6Words(host);
    if (!words) return false;
    if (words.slice(0, 7).every(word => word === 0) && words[7] === 1) return true;
    const mappedLoopback = words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff && (words[6] >> 8) === 127;
    const compatibleLoopback = words.slice(0, 6).every(word => word === 0) && (words[6] >> 8) === 127;
    return mappedLoopback || compatibleLoopback;
  }
  return false;
}

export function publicApiConfigurationError(scope, value) {
  if (scope !== 'public-showcase') return null;
  if (typeof value !== 'string' || value.length === 0) return 'Public showcase builds require NEXT_PUBLIC_AROMAN_API_BASE_URL.';
  if (value !== value.trim()) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must not contain surrounding whitespace.';
  if (value === API_BASE_PATH) return null;
  if (value.startsWith('/')) return 'Same-origin API base must be exactly /api/v1.';
  if (value.includes('?') || value.includes('#')) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must not contain a query string or fragment.';
  if (!/^https:\/\/[^/?#]+\/api\/v1$/i.test(value)) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must be an absolute HTTPS URL with the exact /api/v1 path.';

  let url;
  try { url = new URL(value); } catch { return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must be an absolute HTTP(S) URL.'; }
  if (url.protocol !== 'https:') return 'Absolute NEXT_PUBLIC_AROMAN_API_BASE_URL values must use HTTPS.';
  if (url.username || url.password) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must not contain embedded credentials.';
  if (url.search || url.hash) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must not contain a query string or fragment.';
  if (url.pathname !== API_BASE_PATH) return `NEXT_PUBLIC_AROMAN_API_BASE_URL must use the exact ${API_BASE_PATH} path.`;
  if (isLoopbackHost(url.hostname)) return 'Public showcase builds cannot use a loopback API URL.';
  if (!url.hostname || url.origin === 'null' || url.href !== value) return 'NEXT_PUBLIC_AROMAN_API_BASE_URL must be a well-formed canonical HTTPS origin with the exact /api/v1 path.';
  return null;
}

/** Server-only catalog target validation; HTTP loopback remains useful for isolated fixtures. */
export function catalogUpstreamConfigurationError(value) {
  if (typeof value !== 'string' || value.length === 0) return 'AROMAN_CATALOG_UPSTREAM_URL is required for the same-origin public catalog proxy.';
  if (value.length > 512 || value !== value.trim() || /[?#]/.test(value)) return 'AROMAN_CATALOG_UPSTREAM_URL must be an absolute URL without whitespace, query, or fragment.';
  let url;
  try { url = new URL(value); } catch { return 'AROMAN_CATALOG_UPSTREAM_URL must be a valid absolute HTTP(S) URL.'; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== API_BASE_PATH || url.search || url.hash || !url.hostname || url.origin === 'null' || url.href !== value) {
    return 'AROMAN_CATALOG_UPSTREAM_URL must be a canonical HTTP(S) origin with the exact /api/v1 path and no credentials.';
  }
  return null;
}

export function publicShowcaseBuildMetadata(scope, apiBase) {
  if (scope !== 'public-showcase') return null;
  if (publicApiConfigurationError(scope, apiBase)) return null;
  return { format: 1, scope, apiBase };
}

export function publicShowcaseRuntimeError(scope, metadata, runtimeApiBase) {
  if (scope !== 'public-showcase') return null;
  if (!metadata || metadata.format !== 1 || metadata.scope !== 'public-showcase') {
    return 'Runtime public-showcase mode requires a production build created with AROMAN_RELEASE_SCOPE=public-showcase and a validated public catalog API URL.';
  }
  const error = publicApiConfigurationError('public-showcase', metadata.apiBase);
  if (error) return `Public showcase build metadata is invalid: ${error}`;
  if (runtimeApiBase !== undefined && runtimeApiBase !== metadata.apiBase) return 'Runtime NEXT_PUBLIC_AROMAN_API_BASE_URL does not match the validated public showcase build configuration.';
  return null;
}

export function readPublicShowcaseBuildMetadata(cwd, distDirectory) {
  try {
    return JSON.parse(readFileSync(resolve(cwd, distDirectory, 'public-showcase-build.json'), 'utf8'));
  } catch {
    return null;
  }
}
