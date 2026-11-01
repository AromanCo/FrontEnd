import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backendSha } from './backend-pin.mjs';

const frontend = resolve(import.meta.dirname, '..');
const options = {
  backend: resolve(process.env.AROMAN_TEST_BACKEND_DIR || join(frontend, '..', 'Backend')),
  snapshot: join(frontend, 'docs/openapi.m1a.json'),
  types: join(frontend, 'src/lib/api/generated.ts'),
  python: process.env.AROMAN_TEST_PYTHON || 'python3.12',
  refresh: false,
};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--refresh') options.refresh = true;
  else if (['--backend', '--snapshot', '--types', '--python'].includes(arg) && process.argv[i + 1]) {
    options[arg.slice(2)] = arg === '--python' ? process.argv[++i] : resolve(process.argv[++i]);
  } else throw new Error(`Unknown or incomplete argument: ${arg}`);
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return value;
}

async function main() {
  const revision = run('git', ['rev-parse', 'HEAD'], options.backend).trim();
  if (revision !== backendSha) throw new Error(`Wrong Backend revision: expected ${backendSha}, found ${revision}`);

  // The exporter imports settings, but app.openapi() makes no database connection.
  const env = {
    ...process.env, DATABASE_URL: 'sqlite:////tmp/aroman-openapi-export-unused.db',
    OTP_PEPPER: 'a'.repeat(32), SESSION_PEPPER: 'b'.repeat(32),
    ENVIRONMENT: 'test', SMS_PROVIDER: 'unconfigured', FAKE_SMS_ENABLED: 'false',
    PYTHONDONTWRITEBYTECODE: '1',
  };
  const exported = run(options.python, ['-m', 'aroman.openapi_export'], options.backend, env);
  let schema;
  try { schema = JSON.parse(exported); } catch (error) { throw new Error(`Backend export is not valid JSON: ${error.message}`); }
  const temp = await mkdtemp(join(tmpdir(), 'aroman-contract-'));
  try {
    const schemaFile = join(temp, 'openapi.json');
    const typesFile = join(temp, 'generated.ts');
    await writeFile(schemaFile, exported);
    run(join(frontend, 'node_modules/.bin/openapi-typescript'), [schemaFile, '-o', typesFile], frontend);
    const generated = await readFile(typesFile, 'utf8');
    if (options.refresh) {
      await writeFile(options.snapshot, `${JSON.stringify(schema, null, 2)}\n`);
      await writeFile(options.types, generated);
      console.log('Refreshed OpenAPI snapshot and generated TypeScript types. Review both diffs before committing.');
      return;
    }
    const committed = JSON.parse(await readFile(options.snapshot, 'utf8'));
    const failures = [];
    if (JSON.stringify(sorted(schema)) !== JSON.stringify(sorted(committed))) {
      failures.push(`OpenAPI snapshot is stale: ${options.snapshot}`);
    }
    if (generated !== await readFile(options.types, 'utf8')) {
      failures.push(`Generated TypeScript types are stale: ${options.types}`);
    }
    if (failures.length) throw new Error(`${failures.join('\n')}\nRun npm run types:api:refresh intentionally, then review the diff.`);
    console.log(`OpenAPI snapshot and generated types match pinned Backend ${backendSha}.`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(`API contract check failed: ${error.message}`); process.exitCode = 1; });
