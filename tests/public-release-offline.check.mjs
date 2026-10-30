import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPublicReleaseOfflineChecks } from '../scripts/verify-public-release-offline.mjs';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'scripts/verify-public-release-offline.mjs');
const validSameOrigin = {
  AROMAN_RELEASE_SCOPE: 'public-showcase',
  NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1',
  AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1',
};
const validHttps = {
  AROMAN_RELEASE_SCOPE: 'public-showcase',
  NEXT_PUBLIC_AROMAN_API_BASE_URL: 'https://catalog.example.test/api/v1',
};

function withDist(metadata, callback) {
  const directory = mkdtempSync(join(tmpdir(), 'aroman-public-release-offline-'));
  try {
    if (metadata !== undefined) writeFileSync(join(directory, 'public-showcase-build.json'), JSON.stringify(metadata));
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function run(env, distDirectory) {
  return runPublicReleaseOfflineChecks({ env, cwd: root, distDirectory });
}

test('empty CLI environment fails local public configuration and reports authorization UNVERIFIED', () => {
  const result = spawnSync(process.execPath, [cli], {
    cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(output, /FAIL AROMAN_RELEASE_SCOPE is explicitly public-showcase/);
  assert.match(output, /FAIL Browser API configuration is valid for public release/);
  assert.match(output, /LOCAL VERIFICATION: FAIL/);
  assert.match(output, /PRODUCTION RELEASE AUTHORIZATION: UNVERIFIED/);
  assert.doesNotMatch(output, /PASS Browser API configuration is valid/);
});

test('CLI exits zero for valid same-origin and absolute HTTPS modes', () => {
  withDist(undefined, distDirectory => {
    for (const configuration of [
      { ...validSameOrigin, AROMAN_TEST_NEXT_DIST_DIR: distDirectory },
      { ...validHttps, AROMAN_TEST_NEXT_DIST_DIR: distDirectory },
    ]) {
      const result = spawnSync(process.execPath, [cli], {
        cwd: root,
        env: { PATH: process.env.PATH, HOME: process.env.HOME, ...configuration },
        encoding: 'utf8',
      });
      const output = `${result.stdout}${result.stderr}`;
      assert.equal(result.status, 0, output);
      assert.match(output, /LOCAL VERIFICATION: PASS/);
      assert.match(output, /UNVERIFIED No compiled public-showcase build metadata/);
      assert.match(output, /PRODUCTION RELEASE AUTHORIZATION: UNVERIFIED/);
    }
  });
});

test('CLI exits nonzero when a compiled public artifact has configuration drift', () => {
  const metadata = { format: 1, scope: 'public-showcase', apiBase: 'https://old.example.test/api/v1' };
  withDist(metadata, distDirectory => {
    const result = spawnSync(process.execPath, [cli], {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...validHttps, AROMAN_TEST_NEXT_DIST_DIR: distDirectory },
      encoding: 'utf8',
    });
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(output, /FAIL Compiled build metadata is public-showcase/);
    assert.match(output, /LOCAL VERIFICATION: FAIL/);
    assert.match(output, /PRODUCTION RELEASE AUTHORIZATION: UNVERIFIED/);
  });
});

test('missing release scope fails even when browser and upstream values are valid', () => {
  const { failed } = withDist(undefined, distDirectory => run({ NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1', AROMAN_CATALOG_UPSTREAM_URL: validSameOrigin.AROMAN_CATALOG_UPSTREAM_URL }, distDirectory));
  assert.ok(failed.includes('AROMAN_RELEASE_SCOPE is explicitly public-showcase'));
  assert.ok(failed.includes('Browser API configuration is valid for public release'));
});

test('missing browser API base fails', () => {
  const { failed } = withDist(undefined, distDirectory => run({ AROMAN_RELEASE_SCOPE: 'public-showcase', AROMAN_CATALOG_UPSTREAM_URL: validSameOrigin.AROMAN_CATALOG_UPSTREAM_URL }, distDirectory));
  assert.ok(failed.includes('Browser API configuration is valid for public release'));
});

test('missing same-origin upstream fails', () => {
  const { failed } = withDist(undefined, distDirectory => run({ AROMAN_RELEASE_SCOPE: 'public-showcase', NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1' }, distDirectory));
  assert.ok(failed.includes('Same-origin public catalog requires AROMAN_CATALOG_UPSTREAM_URL.'));
});

test('invalid browser URL fails', () => {
  const { failed } = withDist(undefined, distDirectory => run({ ...validSameOrigin, NEXT_PUBLIC_AROMAN_API_BASE_URL: 'http://catalog.example.test/api/v1' }, distDirectory));
  assert.ok(failed.includes('Browser API configuration is valid for public release'));
});

test('invalid catalog upstream fails', () => {
  const { failed } = withDist(undefined, distDirectory => run({ ...validSameOrigin, AROMAN_CATALOG_UPSTREAM_URL: 'https://user:pass@catalog.example.test/api/v1' }, distDirectory));
  assert.ok(failed.includes('Server-only catalog upstream configuration is valid'));
});

test('valid same-origin configuration passes local config and leaves absent build metadata UNVERIFIED', () => {
  const { failed, passed, unverified } = withDist(undefined, distDirectory => run(validSameOrigin, distDirectory));
  assert.deepEqual(failed, []);
  assert.ok(passed.includes('Browser API configuration is valid for public release'));
  assert.ok(passed.includes('Server-only catalog upstream configuration is valid'));
  assert.ok(unverified.some(item => item.includes('No compiled public-showcase build metadata')));
});

test('valid supported absolute HTTPS mode passes without requiring the same-origin upstream', () => {
  const { failed, passed, unverified } = withDist(undefined, distDirectory => run(validHttps, distDirectory));
  assert.deepEqual(failed, []);
  assert.ok(passed.includes('Browser API configuration is valid for public release'));
  assert.ok(!unverified.some(item => item.includes('AROMAN_CATALOG_UPSTREAM_URL is not present')));
});

test('explicit test environment is isolated from inherited process configuration', () => {
  const prior = {
    scope: process.env.AROMAN_RELEASE_SCOPE,
    api: process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL,
    upstream: process.env.AROMAN_CATALOG_UPSTREAM_URL,
  };
  try {
    process.env.AROMAN_RELEASE_SCOPE = 'full';
    process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = 'http://invalid.example/api/v1';
    delete process.env.AROMAN_CATALOG_UPSTREAM_URL;
    const result = withDist(undefined, distDirectory => run(validSameOrigin, distDirectory));
    assert.deepEqual(result.failed, []);
  } finally {
    if (prior.scope === undefined) delete process.env.AROMAN_RELEASE_SCOPE; else process.env.AROMAN_RELEASE_SCOPE = prior.scope;
    if (prior.api === undefined) delete process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL; else process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = prior.api;
    if (prior.upstream === undefined) delete process.env.AROMAN_CATALOG_UPSTREAM_URL; else process.env.AROMAN_CATALOG_UPSTREAM_URL = prior.upstream;
  }
});

test('runtime configuration drift from an exploration artifact fails', () => {
  const metadata = { format: 1, scope: 'exploration', apiBase: validHttps.NEXT_PUBLIC_AROMAN_API_BASE_URL };
  const { failed } = withDist(metadata, distDirectory => run(validHttps, distDirectory));
  assert.ok(failed.includes('Compiled build metadata is public-showcase with the configured browser API base'));
});

test('present public metadata with a different compiled API base fails', () => {
  const metadata = { format: 1, scope: 'public-showcase', apiBase: 'https://old.example.test/api/v1' };
  const { failed } = withDist(metadata, distDirectory => run(validHttps, distDirectory));
  assert.ok(failed.includes('Compiled build metadata is public-showcase with the configured browser API base'));
});

test('missing compiled metadata remains UNVERIFIED rather than production PASS', () => {
  const { failed, unverified } = withDist(undefined, distDirectory => run(validSameOrigin, distDirectory));
  assert.deepEqual(failed, []);
  assert.ok(unverified.some(item => item.includes('No compiled public-showcase build metadata')));
  assert.equal(unverified.some(item => /production.*PASS/i.test(item)), false);
});
