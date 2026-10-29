import { afterEach, describe, expect, it } from 'vitest';
import { getReleaseScope, isExplorationOnlyPath } from '@/lib/release-scope';

const originalScope = process.env.AROMAN_RELEASE_SCOPE;
const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  if (originalScope === undefined) delete process.env.AROMAN_RELEASE_SCOPE;
  else process.env.AROMAN_RELEASE_SCOPE = originalScope;
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
});

describe('release scope', () => {
  it('defaults to full for development and exploration for production', () => {
    delete process.env.AROMAN_RELEASE_SCOPE;
    Object.assign(process.env, { NODE_ENV: 'development' });
    expect(getReleaseScope()).toBe('full');
    Object.assign(process.env, { NODE_ENV: 'production' });
    expect(getReleaseScope()).toBe('exploration');
  });
  it('accepts only the two explicit values', () => {
    process.env.AROMAN_RELEASE_SCOPE = 'exploration';
    expect(getReleaseScope()).toBe('exploration');
    process.env.AROMAN_RELEASE_SCOPE = 'full';
    expect(getReleaseScope()).toBe('full');
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
