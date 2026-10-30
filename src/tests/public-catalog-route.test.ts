import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from '@/app/api/v1/[...path]/route';

const originalUpstream = process.env.AROMAN_CATALOG_UPSTREAM_URL;
const originalFetch = globalThis.fetch;
const upstream = 'http://127.0.0.1:8011/api/v1';

afterEach(() => {
  if (originalUpstream === undefined) delete process.env.AROMAN_CATALOG_UPSTREAM_URL;
  else process.env.AROMAN_CATALOG_UPSTREAM_URL = originalUpstream;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function req(path: string, headers?: HeadersInit) {
  return new NextRequest(`http://frontend.test${path}`, { headers });
}
function jsonFetch(body: unknown = []) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

describe('public catalog API route', () => {
  it.each([
    ['/api/v1/brands?q=rose&limit=20&offset=0', '/api/v1/brands?q=rose&limit=20&offset=0'],
    ['/api/v1/products?brand_id=123e4567-e89b-42d3-a456-426614174000&family_id=123e4567-e89b-42d3-a456-426614174001', '/api/v1/products?brand_id=123e4567-e89b-42d3-a456-426614174000&family_id=123e4567-e89b-42d3-a456-426614174001'],
    ['/api/v1/products/123e4567-e89b-42d3-a456-426614174000/variants', '/api/v1/products/123e4567-e89b-42d3-a456-426614174000/variants'],
    ['/api/v1/fragrance-families?q=woody', '/api/v1/fragrance-families?q=woody'],
    ['/api/v1/fragrance-notes?family_id=123e4567-e89b-42d3-a456-426614174000', '/api/v1/fragrance-notes?family_id=123e4567-e89b-42d3-a456-426614174000'],
  ])('forwards only an allowed catalog request: %s', async (path, expected) => {
    process.env.AROMAN_CATALOG_UPSTREAM_URL = upstream;
    globalThis.fetch = jsonFetch() as typeof fetch;
    const response = await GET(req(path, { cookie: 'session=secret', authorization: 'Bearer secret', 'x-forwarded-for': 'attacker' }));
    expect(response.status).toBe(200);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toBe(`http://127.0.0.1:8011${expected}`);
    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(Object.keys(init.headers as object)).toEqual(['Accept']);
    expect(init.redirect).toBe('manual');
  });

  it.each(['/api/v1/auth/session', '/api/v1/users/me', '/api/v1/fragrance-concepts', '/api/v1/health', '/docs', '/api/v1/brands/'])('rejects non-catalog and noncanonical paths: %s', async path => {
    globalThis.fetch = jsonFetch() as typeof fetch;
    expect((await GET(req(path))).status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects encoded, duplicate, unknown, oversized, and invalid query inputs', async () => {
    process.env.AROMAN_CATALOG_UPSTREAM_URL = upstream;
    globalThis.fetch = jsonFetch() as typeof fetch;
    for (const path of [
      '/api/v1/products%2f123e4567-e89b-42d3-a456-426614174000/variants',
      '/api/v1/products/123e4567-e89b-42d3-a456-426614174000%2Fvariants',
      '/api/v1/brands?q=a&q=b', '/api/v1/brands?admin=true', '/api/v1/brands?limit=101',
      '/api/v1/brands?offset=-1', `/api/v1/brands?q=${'a'.repeat(101)}`, `/api/v1/brands?q=${'a'.repeat(2050)}`,
    ]) expect([400, 404]).toContain((await GET(req(path))).status);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([POST, PUT, PATCH, DELETE, HEAD, OPTIONS])('rejects unsupported methods', async handler => {
    const response = await handler(req('/api/v1/brands'));
    expect(response.status).toBe(405);
  });

  it('fails closed for invalid upstream settings', async () => {
    globalThis.fetch = jsonFetch() as typeof fetch;
    for (const value of [undefined, '', 'https://user:pass@example.test/api/v1', 'https://example.test/api/v1?x=1', 'https://example.test/api/v2', 'file:///api/v1']) {
      if (value === undefined) delete process.env.AROMAN_CATALOG_UPSTREAM_URL;
      else process.env.AROMAN_CATALOG_UPSTREAM_URL = value;
      expect((await GET(req('/api/v1/brands'))).status).toBe(503);
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not follow redirects or disclose upstream errors and rejects oversized bodies', async () => {
    process.env.AROMAN_CATALOG_UPSTREAM_URL = upstream;
    globalThis.fetch = vi.fn(async () => new Response('secret internal location', { status: 302, headers: { Location: 'http://internal/' } })) as typeof fetch;
    let response = await GET(req('/api/v1/brands'));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('internal');
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array(1_000_001), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    response = await GET(req('/api/v1/brands'));
    expect(response.status).toBe(502);
    expect((await response.text())).not.toContain('secret');
  });

  it('maps upstream failures to a generic unavailable response', async () => {
    process.env.AROMAN_CATALOG_UPSTREAM_URL = upstream;
    for (const failingFetch of [
      vi.fn(async () => new Response('database password leaked', { status: 500 })),
      vi.fn(async () => { throw new Error('private upstream address leaked'); }),
    ]) {
      globalThis.fetch = failingFetch as typeof fetch;
      const response = await GET(req('/api/v1/brands'));
      expect(response.status).toBe(502);
      const body = await response.text();
      expect(body).not.toContain('database');
      expect(body).not.toContain('private');
    }
  });

  it('aborts an upstream request at the configured timeout', async () => {
    process.env.AROMAN_CATALOG_UPSTREAM_URL = upstream;
    let wasAborted = false;
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signal.addEventListener('abort', () => { wasAborted = true; reject(new Error('aborted')); }, { once: true });
    })) as typeof fetch;
    const response = await GET(req('/api/v1/brands'));
    expect(response.status).toBe(502);
    expect(wasAborted).toBe(true);
  }, 7000);
});
