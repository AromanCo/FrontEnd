export type ReleaseScope = 'exploration' | 'full';

/** Read only on the server. Never expose the environment variable to browser code. */
export function getReleaseScope(): ReleaseScope {
  const explicit = process.env.AROMAN_RELEASE_SCOPE;
  if (explicit === undefined) {
    return process.env.NODE_ENV === 'production' ? 'exploration' : 'full';
  }
  if (explicit === 'exploration' || explicit === 'full') return explicit;
  throw new Error('Invalid AROMAN_RELEASE_SCOPE. Expected "exploration" or "full".');
}

export function isExplorationOnlyPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return ['/login', '/account', '/cart', '/checkout'].some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}
