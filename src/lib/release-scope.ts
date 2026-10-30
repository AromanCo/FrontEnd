import { publicShowcaseRuntimeError, readPublicShowcaseBuildMetadata } from './public-showcase-config.mjs';

export type ReleaseScope = 'exploration' | 'public-showcase' | 'full';

/** Read only on the server. Never expose the environment variable to browser code. */
export function getReleaseScope(): ReleaseScope {
  const explicit = process.env.AROMAN_RELEASE_SCOPE;
  let scope: ReleaseScope;
  if (explicit === undefined) {
    scope = process.env.NODE_ENV === 'production' ? 'exploration' : 'full';
  } else if (explicit === 'exploration' || explicit === 'public-showcase' || explicit === 'full') {
    scope = explicit;
  } else {
    throw new Error('Invalid AROMAN_RELEASE_SCOPE. Expected "exploration", "public-showcase", or "full".');
  }
  if (scope === 'public-showcase') {
    const distDirectory = process.env.AROMAN_TEST_NEXT_DIST_DIR || '.next';
    const metadata = readPublicShowcaseBuildMetadata(process.cwd(), distDirectory);
    const error = publicShowcaseRuntimeError(scope, metadata, process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL);
    if (error) throw new Error(error);
  }
  return scope;
}

export function isExplorationOnlyPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return ['/login', '/account', '/cart', '/checkout'].some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}
