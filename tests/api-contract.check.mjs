import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const command = join(root, 'scripts/check-api-contract.mjs');
const backend = resolve(process.env.AROMAN_TEST_BACKEND_DIR || join(root, '..', 'Backend'));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'aroman-contract-test-'));
  const snapshot = join(dir, 'openapi.json');
  const types = join(dir, 'generated.ts');
  await copyFile(join(root, 'docs/openapi.m1a.json'), snapshot);
  await copyFile(join(root, 'src/lib/api/generated.ts'), types);
  return { dir, snapshot, types };
}

function check({ snapshot, types }, selectedBackend = backend) {
  return spawnSync(process.execPath, [command, '--backend', selectedBackend, '--snapshot', snapshot, '--types', types], {
    cwd: root, encoding: 'utf8', env: process.env,
  });
}

test('ignores JSON whitespace and object key order', async () => {
  const files = await fixture();
  try {
    const schema = JSON.parse(await readFile(files.snapshot, 'utf8'));
    await writeFile(files.snapshot, JSON.stringify(Object.fromEntries(Object.entries(schema).reverse())));
    const result = check(files);
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(files.dir, { recursive: true, force: true }); }
});

test('fails on semantic OpenAPI drift', async () => {
  const files = await fixture();
  try {
    const schema = JSON.parse(await readFile(files.snapshot, 'utf8'));
    schema.info.version = 'drifted-version';
    await writeFile(files.snapshot, JSON.stringify(schema));
    const result = check(files);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OpenAPI snapshot is stale/);
  } finally { await rm(files.dir, { recursive: true, force: true }); }
});

test('fails on stale generated TypeScript types', async () => {
  const files = await fixture();
  try {
    await writeFile(files.types, `${await readFile(files.types, 'utf8')}\n// stale fixture\n`);
    const result = check(files);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Generated TypeScript types are stale/);
  } finally { await rm(files.dir, { recursive: true, force: true }); }
});

test('fails on incorrect Backend revision before export', async () => {
  const files = await fixture();
  try {
    const result = check(files, root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Wrong Backend revision/);
  } finally { await rm(files.dir, { recursive: true, force: true }); }
});
