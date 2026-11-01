import { describe, expect, it } from 'vitest';
import { isExcludedPathForScope } from '@/lib/release-scope';

describe('scope-specific excluded route policy', () => {
  const excluded = ['/login', '/login/otp', '/account', '/account/saved', '/cart', '/checkout'];

  it('rejects login, account, cart and checkout paths in public-showcase and exploration', () => {
    for (const scope of ['public-showcase', 'exploration'] as const) {
      for (const path of excluded) expect(isExcludedPathForScope(scope, path), `${scope} ${path}`).toBe(true);
    }
  });

  it('preserves full-scope routes and catalog/studio routes in every scope', () => {
    for (const path of excluded) expect(isExcludedPathForScope('full', path), `full ${path}`).toBe(false);
    for (const scope of ['full', 'exploration', 'public-showcase'] as const) {
      for (const path of ['/shop', '/studio/guided', '/studio/creative', '/api/v1/products']) {
        expect(isExcludedPathForScope(scope, path), `${scope} ${path}`).toBe(false);
      }
    }
  });
});
