import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getReleaseScope, isExplorationOnlyPath } from '@/lib/release-scope';

const originalScope = process.env.AROMAN_RELEASE_SCOPE;
const originalNodeEnv = process.env.NODE_ENV;
const originalDist = process.env.AROMAN_TEST_NEXT_DIST_DIR;
let temporaryDist: string | undefined;
afterEach(() => {
  if (originalScope === undefined) delete process.env.AROMAN_RELEASE_SCOPE;
  else process.env.AROMAN_RELEASE_SCOPE = originalScope;
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalDist === undefined) delete process.env.AROMAN_TEST_NEXT_DIST_DIR;
  else process.env.AROMAN_TEST_NEXT_DIST_DIR = originalDist;
  if (temporaryDist) rmSync(temporaryDist, { recursive: true, force: true });
  temporaryDist = undefined;
});

describe('release scope', () => {
  it('defaults to full for development and exploration for production', () => {
    delete process.env.AROMAN_RELEASE_SCOPE;
    Object.assign(process.env, { NODE_ENV: 'development' });
    expect(getReleaseScope()).toBe('full');
    Object.assign(process.env, { NODE_ENV: 'production' });
    expect(getReleaseScope()).toBe('exploration');
  });
  it('accepts all three explicit values while preserving existing scopes', () => {
    process.env.AROMAN_RELEASE_SCOPE = 'exploration';
    expect(getReleaseScope()).toBe('exploration');
    process.env.AROMAN_RELEASE_SCOPE = 'full';
    expect(getReleaseScope()).toBe('full');
    temporaryDist = mkdtempSync(join(tmpdir(), 'aroman-release-scope-'));
    process.env.AROMAN_TEST_NEXT_DIST_DIR = temporaryDist;
    const metadata = { format: 1, scope: 'public-showcase', apiBase: 'https://catalog.example.test/api/v1' };
    writeFileSync(join(temporaryDist, 'public-showcase-build.json'), JSON.stringify(metadata));
    process.env.AROMAN_RELEASE_SCOPE = 'public-showcase';
    expect(getReleaseScope()).toBe('public-showcase');
    process.env.AROMAN_RELEASE_SCOPE = 'Full';
    expect(() => getReleaseScope()).toThrow(/Invalid AROMAN_RELEASE_SCOPE/);
  });
  it('matches excluded roots, descendants, and trailing slashes only', () => {
    for (const route of ['/login', '/login/', '/login/nested', '/account/', '/account/a/b', '/cart', '/checkout/nested/']) {
      expect(isExplorationOnlyPath(route), route).toBe(true);
    }
    for (const route of ['/', '/shop', '/shop/123', '/studio/creative', '/studio/guided', '/login-help']) {
      expect(isExplorationOnlyPath(route), route).toBe(false);
    }
  });
});
