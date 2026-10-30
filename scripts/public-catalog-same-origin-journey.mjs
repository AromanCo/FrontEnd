#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:3201';
const apiOrigin = 'http://127.0.0.1:18762';
const productId = '00000000-0000-4000-8000-000000000121';
const product = {
  id: productId, slug: 'synthetic-public-catalog-product', name: 'محصول ساختگی کاتالوگ عمومی',
  description: 'دادهٔ ساختگی برای آزمون مسیر هم‌مبدأ.', is_demo: true,
  brand_id: '00000000-0000-4000-8000-000000000122', family_id: null,
};
const upstreamCalls = [];
const apiServer = createServer((request, response) => {
  const url = new URL(request.url || '/', apiOrigin);
  upstreamCalls.push(`${request.method} ${url.pathname}`);
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(url.pathname === '/api/v1/products' ? [product] : []));
});
await new Promise(resolve => apiServer.listen(18762, '127.0.0.1', resolve));

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(origin).port], {
  env: {
    ...process.env,
    AROMAN_RELEASE_SCOPE: 'public-showcase',
    AROMAN_API_BASE_URL: `${apiOrigin}/api/v1`,
    AROMAN_CATALOG_UPSTREAM_URL: `${apiOrigin}/api/v1`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before ready. ${serverLog}`);
    try { if ((await fetch(origin)).status < 500) { ready = true; break; } } catch { /* wait for listener */ }
    await delay(500);
  }
  assert.ok(ready, `Compiled Next.js server did not start. ${serverLog}`);

  const catalogResponse = await fetch(`${origin}/api/v1/products?limit=12&offset=0`);
  assert.equal(catalogResponse.status, 200, 'same-origin catalog route should return 200');
  assert.deepEqual(await catalogResponse.json(), [product], 'same-origin response should contain the loopback fixture product');
  assert.ok(upstreamCalls.includes('GET /api/v1/products'), 'Next.js handler should call the loopback catalog fixture');
  const upstreamCallsBeforeRejectedRequests = upstreamCalls.length;

  const prohibited = await fetch(`${origin}/api/v1/auth/session`);
  assert.equal(prohibited.status, 404, 'prohibited API path should be rejected by the running Next.js server');
  const unsupportedMethod = await fetch(`${origin}/api/v1/products`, { method: 'POST', body: '{}' });
  assert.equal(unsupportedMethod.status, 405, 'unsupported method should be rejected by the running Next.js server');
  assert.equal(upstreamCalls.length, upstreamCallsBeforeRejectedRequests, 'rejected requests must not reach the upstream fixture');

  const journey = spawn(process.execPath, ['scripts/public-showcase-journey.mjs'], {
    env: { ...process.env, FRONTEND_ORIGIN: origin, NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1' },
    stdio: 'inherit',
  });
  const journeyStatus = await new Promise(resolve => journey.once('exit', (code, signal) => resolve(signal ? 1 : code)));
  assert.equal(journeyStatus, 0, 'public browser journey should pass against the real same-origin catalog route');
  assert.ok(upstreamCalls.length > 1, 'browser journey should load catalog through the same-origin route');
  console.log(`PASS compiled same-origin catalog journey: ${upstreamCalls.length} loopback fixture requests; real response verified; prohibited route 404; POST 405.`);
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(3000)]);
  }
  await new Promise(resolve => apiServer.close(resolve));
}
