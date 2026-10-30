import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogUpstreamConfigurationError, publicApiConfigurationError, publicShowcaseRuntimeError } from '../src/lib/public-showcase-config.mjs';
import { runPublicReleasePreflight } from '../scripts/public-release-preflight.mjs';

test('public browser API accepts same-origin and canonical HTTPS only in public scope', () => {
  assert.equal(publicApiConfigurationError('public-showcase', '/api/v1'), null);
  assert.equal(publicApiConfigurationError('public-showcase', 'https://catalog.example.test/api/v1'), null);
  for (const value of ['http://catalog.example.test/api/v1', 'https://user:pass@catalog.example.test/api/v1', 'https://catalog.example.test/api/v1?x=1', 'https://localhost/api/v1', 'https://catalog.example.test/api/v2', 'https://catalog.example.test:bad/api/v1', 'https://999.999.999.999/api/v1']) {
    assert.ok(publicApiConfigurationError('public-showcase', value), value);
  }
  assert.equal(publicApiConfigurationError('full', 'http://localhost:8000/api/v1'), null);
  assert.ok(publicApiConfigurationError('public-showcase', undefined));
});

test('server-only upstream accepts legitimate loopback fixture and rejects unsafe settings', () => {
  assert.equal(catalogUpstreamConfigurationError('http://127.0.0.1:8011/api/v1'), null);
  assert.equal(catalogUpstreamConfigurationError('https://catalog.internal/api/v1'), null);
  for (const value of ['http://user:pass@127.0.0.1/api/v1', 'https://catalog.internal/api/v1?admin=1', 'https://catalog.internal/api/v2', 'file:///api/v1', ' https://catalog.internal/api/v1']) {
    assert.ok(catalogUpstreamConfigurationError(value), value);
  }
  assert.ok(catalogUpstreamConfigurationError(undefined));
});

test('runtime rejects public build configuration drift', () => {
  const metadata = { format: 1, scope: 'public-showcase', apiBase: 'https://catalog.example.test/api/v1' };
  assert.equal(publicShowcaseRuntimeError('public-showcase', metadata, metadata.apiBase), null);
  assert.match(publicShowcaseRuntimeError('public-showcase', metadata, '/api/v1'), /does not match/);
  assert.match(publicShowcaseRuntimeError('public-showcase', null), /requires a production build/);
});

test('preflight distinguishes local evidence from external requirements', () => {
  const valid = runPublicReleasePreflight({ env: { AROMAN_RELEASE_SCOPE: 'public-showcase', NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1', AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1' } });
  assert.deepEqual(valid.failed, []);
  assert.ok(valid.passed.length >= 5);
  assert.ok(valid.unverified.some(item => item.includes('DNS')));
  assert.ok(valid.unverified.some(item => item.includes('firewall')));
  const invalid = runPublicReleasePreflight({ env: { AROMAN_RELEASE_SCOPE: 'public-showcase', NEXT_PUBLIC_AROMAN_API_BASE_URL: 'http://catalog.example.test/api/v1' } });
  assert.ok(invalid.failed.includes('Browser API configuration is valid for public release'));
  assert.ok(invalid.unverified.some(item => item.includes('not present')));
});
