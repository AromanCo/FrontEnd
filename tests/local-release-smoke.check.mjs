import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, test } from 'node:test';
import { resolve } from 'node:path';

const script = resolve(import.meta.dirname, '../scripts/local-release-smoke.mjs');
const servers = [];

async function fixture(handler, host = '127.0.0.1') {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, host);
  await once(server, 'listening');
  const hostForUrl = host === '::1' ? '[::1]' : host;
  return `http://${hostForUrl}:${server.address().port}`;
}

function run(args) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

function args(frontend, backend) {
  return ['--frontend', frontend, '--backend', backend];
}

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolveClose) => server.close(resolveClose))));
});

test('successful Frontend and Backend checks are labeled local smoke verification only', async () => {
  const frontend = await fixture((_request, response) => response.writeHead(200).end('<html>ok</html>'));
  const backend = await fixture((request, response) => {
    assert.equal(request.method, 'GET');
    response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
  });
  const result = await run(args(frontend, backend));
  assert.equal(result.code, 0);
  assert.match(result.stdout, /PASS Frontend entry: HTTP 200/);
  assert.match(result.stdout, /PASS Backend liveness: HTTP 200/);
  assert.match(result.stdout, /PASS Backend readiness: HTTP 200/);
  assert.match(result.stdout, /local smoke verification only/);
});

test('unavailable service fails clearly without exposing target details', async () => {
  const frontend = await fixture((_request, response) => response.writeHead(200).end());
  const unused = createServer();
  unused.listen(0, '127.0.0.1');
  await once(unused, 'listening');
  const port = unused.address().port;
  await new Promise((resolveClose) => unused.close(resolveClose));
  const result = await run(args(frontend, `http://127.0.0.1:${port}`));
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL Backend liveness: HTTP —; connection failed/);
  assert.match(result.stderr, /Local smoke verification failed/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(String(port)));
});

test('readiness failure reports its status and causes failure', async () => {
  const frontend = await fixture((_request, response) => response.writeHead(200).end());
  const backend = await fixture((request, response) => {
    response.writeHead(request.url === '/health/ready' ? 503 : 200).end('private backend detail');
  });
  const result = await run(args(frontend, backend));
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL Backend readiness: HTTP 503; unexpected HTTP status/);
  assert.doesNotMatch(result.stdout + result.stderr, /private backend detail/);
});

test('request timeout is bounded and reported', async () => {
  const frontend = await fixture((_request, response) => response.writeHead(200).end());
  const backend = await fixture((request, response) => {
    if (request.url === '/health/ready') return;
    response.writeHead(200).end();
  });
  const result = await run(args(frontend, backend));
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL Backend readiness: HTTP —; request timed out/);
});

test('redirect is rejected without following its location', async () => {
  const frontendPaths = [];
  const frontend = await fixture((request, response) => {
    frontendPaths.push(request.url);
    response.writeHead(request.url === '/' ? 302 : 200, { location: '/followed' }).end();
  });
  const backend = await fixture((_request, response) => response.writeHead(200).end());
  const result = await run(args(frontend, backend));
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL Frontend entry: HTTP 302; redirect rejected/);
  assert.deepEqual(frontendPaths, ['/']);
});

test('canonical IPv4 and bracketed IPv6 loopback URL forms are accepted', async () => {
  const ipv4 = await fixture((_request, response) => response.writeHead(200).end());
  const ipv4Result = await run(args(`${ipv4}/`, ipv4));
  assert.equal(ipv4Result.code, 0);

  const ipv6 = await fixture((_request, response) => response.writeHead(200).end(), '::1');
  const ipv6Result = await run(args(`${ipv6}/`, ipv6));
  assert.equal(ipv6Result.code, 0);
});

test('non-loopback, invalid URL, and invalid scheme are rejected as configuration errors', async () => {
  for (const [frontend, expected] of [
    ['http://example.com', /literal loopback/],
    ['http://127.1', /literal loopback/],
    ['http://2130706433', /literal loopback/],
    ['http://0x7f000001', /literal loopback/],
    ['http://%31%32%37.0.0.1', /literal loopback/],
    ['http://127.0.0.1.', /literal loopback/],
    ['http://[0:0:0:0:0:0:0:1]', /literal loopback/],
    ['http://\\127.0.0.1', /literal loopback/],
    ['http://127.0.0.1/extra', /literal loopback/],
    ['http://127.0.0.1/?check=1', /literal loopback/],
    ['http://127.0.0.1/#fragment', /literal loopback/],
    ['http://127.0.0.1:65536', /valid URL/],
    ['not a URL', /valid URL/],
    ['https://127.0.0.1:3000', /must use HTTP/],
    ['http://user:secret@127.0.0.1:3000', /literal loopback/],
  ]) {
    const result = await run(args(frontend, 'http://127.0.0.1:8000'));
    assert.equal(result.code, 2);
    assert.match(result.stderr, expected);
  }
});

test('missing arguments are rejected', async () => {
  const result = await run(['--frontend', 'http://127.0.0.1:3000']);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Both --frontend and --backend URLs are required/);
});

test('diagnostics never print private response bodies or sensitive headers', async () => {
  const frontend = await fixture((_request, response) => {
    response.writeHead(503, { 'set-cookie': 'session=very-secret-token' }).end('private body with token very-secret-token');
  });
  const backend = await fixture((_request, response) => response.writeHead(200).end());
  const result = await run(args(frontend, backend));
  assert.equal(result.code, 1);
  assert.match(result.stdout, /HTTP 503; unexpected HTTP status/);
  assert.doesNotMatch(result.stdout + result.stderr, /very-secret-token|private body|set-cookie/);
});
