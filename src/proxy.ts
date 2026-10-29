import { NextResponse, type NextRequest } from 'next/server';
import { getReleaseScope, isExplorationOnlyPath } from '@/lib/release-scope';

export function proxy(request: NextRequest) {
  try {
    if (getReleaseScope() === 'exploration' && isExplorationOnlyPath(request.nextUrl.pathname)) {
      return new Response(null, { status: 404 });
    }
  } catch {
    // An invalid explicit scope must never enable excluded routes.
    if (isExplorationOnlyPath(request.nextUrl.pathname)) return new Response(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/login/:path*', '/account/:path*', '/cart/:path*', '/checkout/:path*'] };
