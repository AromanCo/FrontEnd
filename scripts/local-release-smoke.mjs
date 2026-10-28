#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const REQUEST_TIMEOUT_MS = 5_000;
const CHECKS = [
  { name: 'Frontend entry', key: 'frontend', path: '/' },
  { name: 'Backend liveness', key: 'backend', path: '/health/live' },
  { name: 'Backend readiness', key: 'backend', path: '/health/ready' },
];

export function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== '--frontend' && flag !== '--backend') {
      throw new Error('Unexpected argument.');
    }
    if (values[flag]) throw new Error(`Duplicate argument: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values[flag] = value;
    index += 1;
  }
  if (!values['--frontend'] || !values['--backend']) {
    throw new Error('Both --frontend and --backend URLs are required.');
  }
  return {
    frontend: validateBaseUrl(values['--frontend'], '--frontend'),
    backend: validateBaseUrl(values['--backend'], '--backend'),
  };
}

function validateBaseUrl(value, flag) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${flag} must be a valid URL.`);
  }
  if (url.protocol !== 'http:') throw new Error(`${flag} must use HTTP.`);
  const authority = /^http:\/\/(127\.0\.0\.1|\[::1\])(?::([0-9]+))?\/?$/.exec(value);
  if (!authority) {
    throw new Error(`${flag} must use literal loopback address 127.0.0.1 or [::1], with an optional port and trailing slash only.`);
  }
  if (authority[2] !== undefined) {
    const port = Number(authority[2]);
    if (port < 1 || port > 65535) throw new Error(`${flag} must use a valid port.`);
  }
  if (url.hostname !== authority[1] || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error(`${flag} must use a canonical loopback base URL.`);
  }
  return url;
}

async function runCheck(check, targets) {
  const url = new URL(check.path, targets[check.key]);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.1' },
    });
    await response.body?.cancel();
    if (response.status >= 300 && response.status < 400) {
      return { name: check.name, ok: false, status: response.status, diagnostic: 'redirect rejected' };
    }
    if (!response.ok) {
      return { name: check.name, ok: false, status: response.status, diagnostic: 'unexpected HTTP status' };
    }
    return { name: check.name, ok: true, status: response.status, diagnostic: 'response received' };
  } catch (error) {
    const diagnostic = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'request timed out'
      : 'connection failed or request could not complete';
    return { name: check.name, ok: false, status: '—', diagnostic };
  }
}

export async function checkTargets(targets) {
  return Promise.all(CHECKS.map((check) => runCheck(check, targets)));
}

export async function main(args = process.argv.slice(2)) {
  let targets;
  try {
    targets = parseArguments(args);
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    console.error('Usage: node scripts/local-release-smoke.mjs --frontend http://127.0.0.1:3000 --backend http://127.0.0.1:8000');
    return 2;
  }

  const results = await checkTargets(targets);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}: HTTP ${result.status}; ${result.diagnostic}`);
  }
  if (results.every((result) => result.ok)) {
    console.log('local smoke verification only');
    return 0;
  }
  console.error('Local smoke verification failed.');
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
