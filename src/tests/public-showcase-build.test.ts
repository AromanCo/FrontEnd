import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publicApiConfigurationError, publicShowcaseBuildMetadata as createPublicShowcaseBuildMetadata } from '../../src/lib/public-showcase-config.mjs';
import { publicShowcaseStartConfigurationError } from '../../scripts/public-showcase-start.mjs';
import { getReleaseScope } from '@/lib/release-scope';

const publicShowcaseBuildMetadata = (scope: string, apiBase: string) => createPublicShowcaseBuildMetadata(scope, apiBase, {
  sourceRevision: '65568465a67b3697903f7337d4d8e831d6b9acf3',
  backendRevision: '0be24c4597bd693e70348243c26e550a20a8ad0e',
  configurationSha256: 'a'.repeat(64),
});

const originalScope = process.env.AROMAN_RELEASE_SCOPE;
const originalDist = process.env.AROMAN_TEST_NEXT_DIST_DIR;
const originalNodeEnv = process.env.NODE_ENV;
const originalApiBase = process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL;
let temporaryDist: string | undefined;

afterEach(() => {
  if (originalScope === undefined) delete process.env.AROMAN_RELEASE_SCOPE;
  else process.env.AROMAN_RELEASE_SCOPE = originalScope;
  if (originalDist === undefined) delete process.env.AROMAN_TEST_NEXT_DIST_DIR;
  else process.env.AROMAN_TEST_NEXT_DIST_DIR = originalDist;
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalApiBase === undefined) delete process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL;
  else process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = originalApiBase;
  if (temporaryDist) rmSync(temporaryDist, { recursive: true, force: true });
  temporaryDist = undefined;
});

function selectTemporaryBuild(metadata?: unknown) {
  temporaryDist = mkdtempSync(join(tmpdir(), 'aroman-public-showcase-build-'));
  process.env.AROMAN_TEST_NEXT_DIST_DIR = temporaryDist;
  if (metadata !== undefined) {
    writeFileSync(join(temporaryDist, 'public-showcase-build.json'), JSON.stringify(metadata));
  }
}

describe('public showcase API base validation', () => {
  it('does not change validation of full and exploration scopes', () => {
    expect(publicApiConfigurationError('exploration', undefined)).toBeNull();
    expect(publicApiConfigurationError('full', undefined)).toBeNull();
  });

  it.each([
    undefined, '', ' https://catalog.example.test/api/v1', 'https://catalog.example.test/api/v1 ',
    'http://localhost:8000/api/v1', 'http://localhost.:8000/api/v1', 'http://api.localhost/api/v1',
    'http://localhost.localdomain/api/v1', 'http://ip6-localhost/api/v1', 'http://ip6-loopback/api/v1',
    'http://127.1/api/v1', 'http://127.0.0.2/api/v1', 'http://127.255.255.254/api/v1', 'http://[::1]/api/v1',
    'http://[::ffff:127.0.0.1]/api/v1', 'http://[::ffff:7f00:2]/api/v1', 'http://[::7f00:2]/api/v1',
    'http://user@catalog.example.test/api/v1', 'https://user:pass@catalog.example.test/api/v1',
    'https://catalog.example.test/api/v1?tenant=a', 'https://catalog.example.test/api/v1?', 'https://catalog.example.test/api/v1#catalog', 'https://catalog.example.test/api/v1#',
    'https://catalog.example.test/api/v1/', 'https://catalog.example.test/api/v2',
    'http://192.0.2.20:8080/api/v1',
    'https://catalog.example.test/other/api/v1', 'ftp://catalog.example.test/api/v1', 'https:/catalog.example.test/api/v1',
    'https://catalog.example.test:invalid/api/v1', '/api/v2', '//catalog.example.test/api/v1',
  ])('rejects invalid or unsafe API base %s', value => {
    expect(publicApiConfigurationError('public-showcase', value)).toBeTruthy();
  });

  it('accepts an absolute HTTPS API base with the exact path', () => {
    const value = 'https://catalog.example.test/api/v1';
    expect(publicApiConfigurationError('public-showcase', value)).toBeNull();
  });

  it('accepts the exact same-origin catalog route candidate', () => {
    expect(publicApiConfigurationError('public-showcase', '/api/v1')).toBeNull();
    expect(publicShowcaseBuildMetadata('public-showcase', '/api/v1')).toMatchObject({ format: 2, scope: 'public-showcase', apiBase: '/api/v1' });
  });
});

describe('public showcase build-to-runtime consistency', () => {
  it.each(['full', 'exploration'])('does not mark a %s build as public-showcase capable', scope => {
    expect(publicShowcaseBuildMetadata(scope, 'https://catalog.example.test/api/v1')).toBeNull();
  });

  it('rejects switching a full or exploration build to public-showcase at runtime', () => {
    for (const buildScope of ['full', 'exploration']) {
      selectTemporaryBuild(publicShowcaseBuildMetadata(buildScope, 'http://127.0.0.1/api/v1') ?? undefined);
      process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
      expect(() => getReleaseScope()).toThrow(/requires a production build created with AROMAN_RELEASE_SCOPE=public-showcase/);
      if (temporaryDist) rmSync(temporaryDist, { recursive: true, force: true });
      temporaryDist = undefined;
    }
  });

  it('allows public-showcase runtime only when its build artifact records the validated compiled API base', () => {
    const metadata = publicShowcaseBuildMetadata('public-showcase', 'https://catalog.example.test/api/v1');
    expect(metadata).toMatchObject({ format: 2, scope: 'public-showcase', apiBase: 'https://catalog.example.test/api/v1' });
    selectTemporaryBuild(metadata);
    process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = metadata!.apiBase;
    process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
    expect(getReleaseScope()).toBe('public-showcase');
  });

  it('allows public-showcase runtime metadata for the same-origin candidate', () => {
    const metadata = publicShowcaseBuildMetadata('public-showcase', '/api/v1');
    selectTemporaryBuild(metadata);
    process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = metadata!.apiBase;
    process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
    expect(getReleaseScope()).toBe('public-showcase');
  });

  it('rejects a runtime API base that differs from the validated build metadata', () => {
    const metadata = publicShowcaseBuildMetadata('public-showcase', 'https://catalog.example.test/api/v1');
    selectTemporaryBuild(metadata);
    process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL = 'https://other.example.test/api/v1';
    process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
    expect(() => getReleaseScope()).toThrow(/Runtime NEXT_PUBLIC_AROMAN_API_BASE_URL does not match/);
  });

  it('rejects altered or invalid public build metadata', () => {
    selectTemporaryBuild({ format: 2, scope: 'public-showcase', apiBase: 'http://127.0.0.1/api/v1', sourceRevision: 'a'.repeat(40), backendRevision: 'b'.repeat(40), configurationSha256: 'c'.repeat(64) });
    process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
    expect(() => getReleaseScope()).toThrow(/build metadata is invalid/);
  });

  it('blocks npm start when runtime selects public-showcase for a non-public build artifact', () => {
    selectTemporaryBuild();
    const env = { NODE_ENV: 'production', AROMAN_RELEASE_SCOPE: 'public-showcase', AROMAN_TEST_NEXT_DIST_DIR: temporaryDist };
    expect(publicShowcaseStartConfigurationError(env)).toMatch(/requires a production build created with AROMAN_RELEASE_SCOPE=public-showcase/);
    expect(publicShowcaseStartConfigurationError({ NODE_ENV: 'production', AROMAN_RELEASE_SCOPE: 'full', AROMAN_TEST_NEXT_DIST_DIR: temporaryDist })).toBeNull();
  });

  it('allows npm start only for the public artifact with its compiled catalog API base', () => {
    const metadata = publicShowcaseBuildMetadata('public-showcase', '/api/v1');
    selectTemporaryBuild(metadata);
    const env = { NODE_ENV: 'production', AROMAN_RELEASE_SCOPE: 'public-showcase', AROMAN_TEST_NEXT_DIST_DIR: temporaryDist, AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1' };
    expect(publicShowcaseStartConfigurationError(env)).toBeNull();
    expect(publicShowcaseStartConfigurationError({ NODE_ENV: 'production', AROMAN_TEST_NEXT_DIST_DIR: temporaryDist })).toMatch(/requires AROMAN_RELEASE_SCOPE=public-showcase/);
    expect(publicShowcaseStartConfigurationError({ ...env, AROMAN_CATALOG_UPSTREAM_URL: '' })).toMatch(/valid server-only AROMAN_CATALOG_UPSTREAM_URL/);
  });

  it('rejects public build metadata attributed to a different Backend revision', () => {
    const metadata = { ...publicShowcaseBuildMetadata('public-showcase', '/api/v1')!, backendRevision: 'a'.repeat(40) };
    selectTemporaryBuild(metadata);
    expect(publicShowcaseStartConfigurationError({
      NODE_ENV: 'production', AROMAN_RELEASE_SCOPE: 'public-showcase',
      AROMAN_TEST_NEXT_DIST_DIR: temporaryDist, AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1',
    })).toMatch(/does not match the authorized Backend revision pin/);
  });

  it('keeps full and exploration runtime behavior independent of a public build marker', () => {
    selectTemporaryBuild();
    process.env.AROMAN_RELEASE_SCOPE = 'full';
    expect(getReleaseScope()).toBe('full');
    process.env.AROMAN_RELEASE_SCOPE = 'exploration';
    expect(getReleaseScope()).toBe('exploration');
  });
});
