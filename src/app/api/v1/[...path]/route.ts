import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QUERY_LENGTH = 2048;
const MAX_RESPONSE_BYTES = 1_000_000;
const TIMEOUT_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Route = { path: string; query: string[] };

function safeUpstreamBase(value: string | undefined): URL | null {
  if (!value || value.length > 512 || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/api/v1') return null;
    return url;
  } catch { return null; }
}

function matchRoute(rawPath: string): Route | null {
  if (rawPath.length > 256 || rawPath.includes('%') || rawPath.includes('\\') || rawPath.includes('//') || rawPath.endsWith('/')) return null;
  if (rawPath === '/api/v1/brands') return { path: '/brands', query: ['q', 'limit', 'offset'] };
  if (rawPath === '/api/v1/products') return { path: '/products', query: ['q', 'brand_id', 'family_id', 'limit', 'offset'] };
  if (rawPath === '/api/v1/fragrance-families') return { path: '/fragrance-families', query: ['q', 'limit', 'offset'] };
  if (rawPath === '/api/v1/fragrance-notes') return { path: '/fragrance-notes', query: ['q', 'family_id', 'limit', 'offset'] };
  const variant = /^\/api\/v1\/products\/([^/]+)\/variants$/.exec(rawPath);
  if (variant && UUID.test(variant[1])) return { path: `/products/${variant[1]}/variants`, query: [] };
  return null;
}

function boundedQuery(request: NextRequest, allowlist: string[]): URLSearchParams | null {
  const raw = request.nextUrl.search;
  if (raw.length > MAX_QUERY_LENGTH) return null;
  const output = new URLSearchParams();
  const seen = new Set<string>();
  for (const [key, value] of request.nextUrl.searchParams) {
    if (!allowlist.includes(key) || seen.has(key) || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) return null;
    seen.add(key);
    if (key === 'q') {
      output.set(key, value);
    } else if (key === 'limit' || key === 'offset') {
      if (!/^(0|[1-9]\d{0,5})$/.test(value)) return null;
      const number = Number(value);
      if ((key === 'limit' && (number < 1 || number > 100)) || (key === 'offset' && number > 100000)) return null;
      output.set(key, String(number));
    } else if (key.endsWith('_id')) {
      if (!UUID.test(value)) return null;
      output.set(key, value);
    } else return null;
  }
  return output;
}

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const schemeEnd = request.url.indexOf('://');
  const pathStart = request.url.indexOf('/', schemeEnd + 3);
  const queryStart = request.url.indexOf('?');
  const rawPath = pathStart < 0 ? '/' : request.url.slice(pathStart, queryStart >= 0 ? queryStart : undefined);
  const route = matchRoute(rawPath);
  if (!route) return fail(404, 'Not found');
  const params = boundedQuery(request, route.query);
  if (!params) return fail(400, 'Invalid catalog query');
  const upstream = safeUpstreamBase(process.env.AROMAN_CATALOG_UPSTREAM_URL);
  if (!upstream) return fail(503, 'Catalog unavailable');

  const target = new URL(`${upstream.href}/${route.path.slice(1)}`);
  target.search = params.toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(target, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) return fail(502, 'Catalog unavailable');
    if (!response.ok) return fail(502, 'Catalog unavailable');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) return fail(502, 'Catalog unavailable');
    const reader = response.body?.getReader();
    if (!reader) return fail(502, 'Catalog unavailable');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); return fail(502, 'Catalog unavailable'); }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    try { JSON.parse(new TextDecoder().decode(body)); } catch { return fail(502, 'Catalog unavailable'); }
    return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return fail(502, 'Catalog unavailable');
  } finally { clearTimeout(timeout); }
}

const methodNotAllowed: (request: NextRequest) => NextResponse = () => fail(405, 'Method not allowed');
export const HEAD = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
