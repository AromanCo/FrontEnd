import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditReadiness } from '../scripts/audit-backend-dependency-readiness.mjs';

const pin = '0be24c4597bd693e70348243c26e550a20a8ad0e';
const initialPyproject = `[build-system]\nrequires = ["setuptools>=75"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "aroman-backend"\nversion = "0.1.0"\nrequires-python = ">=3.12"\ndependencies = ["fastapi>=0.115,<1", "uvicorn[standard]>=0.34,<1", "pydantic-settings>=2.7,<3", "sqlalchemy>=2.0,<3", "alembic>=1.14,<2", "psycopg[binary]>=3.2,<4"]\n\n[project.optional-dependencies]\ndev = ["pytest>=8,<10", "httpx>=0.27,<1", "ruff>=0.9,<1", "mypy>=1.14,<2"]\n`;
const ci = (revision = pin, firstInstall = "'fastapi>=0.115,<1' 'uvicorn>=0.34,<1' 'pydantic-settings>=2.7,<3' 'sqlalchemy>=2.0,<3' 'alembic>=1.14,<2' 'psycopg[binary]>=3.2,<4' 'httpx>=0.27,<1'", secondInstall = "'fastapi>=0.115,<1' 'uvicorn>=0.34,<1' 'pydantic-settings>=2.7,<3' 'sqlalchemy>=2.0,<3' 'alembic>=1.14,<2'", thirdInstall = './backend-pinned') => `name: test\njobs:\n  postgres-real-stack-browser:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          repository: AromanCo/Backend\n          ref: ${revision}\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - run: |\n          python -m pip install ${firstInstall}\n  real-stack-browser:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          repository: AromanCo/Backend\n          ref: ${revision}\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - run: |\n          python -m pip install ${secondInstall}\n  exploration-real-stack-browser:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          repository: AromanCo/Backend\n          ref: ${revision}\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - run: |\n          python -m pip install ${thirdInstall}\n  verify:\n    steps: []\n  exploration-release:\n    steps: []\n`;
const exampleManifest = () => ({
  evidence_class: 'planning_template',
  dependencies: { backend: { lock_status: 'NOT_CAPTURED', lock_reference: 'NOT_CAPTURED' } },
  release_safety: { deployable: false, production_acceptance_claim: false, public_release_disposition: 'NO-GO' },
});
const register = ['SRC-FE','SRC-BE','CHK-FE','CHK-BE','TREE-FE','TREE-BE','LOCK-FE','LOCK-BE','TOOL-FE','TOOL-BE','CAND-FE','IMG-FE','IMG-API','IMG-PG','SBOM','PROV','SIG-VERIFY','SIGNER','ROOT','CMP-RUNTIME','CMP-MIGRATION','DB-SCHEMA','DB-GRANTS','CONTENT-RIGHTS','NETWORK','DNS-TLS-ROUTING','CATALOG-ROUTES','EXCLUDED-CAPABILITIES','ENV-SECRETS','LOGGING','CAPACITY','BACKUP-RESTORE','MONITORING','ROLLBACK','REVIEWER','RELEASE-AUTH'].map(id => `| ${id} |`).join('\n');
function fixture({ pyproject = initialPyproject, workflow = ci(), backendRevision = pin, manifest = exampleManifest(), lock = null } = {}) {
  const root = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'aroman-dependency-readiness-'));
  const frontendRoot = join(root, 'FrontEnd');
  const backendRoot = join(root, 'Backend');
  mkdirSync(join(frontendRoot, 'scripts'), { recursive: true });
  mkdirSync(join(frontendRoot, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(frontendRoot, 'docs'), { recursive: true });
  mkdirSync(backendRoot, { recursive: true });
  writeFileSync(join(frontendRoot, 'scripts/backend-pin.mjs'), `export const backendSha = '${pin}';\n`);
  writeFileSync(join(frontendRoot, '.github/workflows/ci.yml'), workflow);
  writeFileSync(join(frontendRoot, 'docs/M6_A28F_RELEASE_EVIDENCE_READINESS.md'), register);
  writeFileSync(join(frontendRoot, 'docs/offline-artifact-manifest.example.json'), JSON.stringify(manifest));
  writeFileSync(join(backendRoot, 'pyproject.toml'), pyproject);
  writeFileSync(join(backendRoot, 'Dockerfile'), 'FROM python:3.12-slim\n');
  if (lock) writeFileSync(join(backendRoot, lock), 'synthetic unapproved lock placeholder\n');
  return {
    root,
    run: overrides => auditReadiness({ frontendRoot, backendRoot, backendRevision, ...overrides }),
    writeWorkflow: value => writeFileSync(join(frontendRoot, '.github/workflows/ci.yml'), value),
    writePyproject: value => writeFileSync(join(backendRoot, 'pyproject.toml'), value),
  };
}
function withFixture(options, callback) {
  const value = fixture(options);
  try { callback(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}
function status(report, id) { return report.statuses.find(item => item.id === id)?.status; }

test('pinned static inventory is deterministic, complete, and never claims reproducibility', () => withFixture({}, f => {
  const first = f.run(); const second = f.run();
  assert.deepEqual(first, second);
  assert.equal(first.backend_revision, pin);
  assert.equal(first.dependency_inventory.runtime_requirements.length, 6);
  assert.equal(first.dependency_inventory.development_requirements.length, 4);
  assert.equal(first.dependency_inventory.build_system.requirements[0], 'setuptools>=75');
  assert.equal(first.reproducible_environment, false);
  assert.equal(first.trusted, false);
  assert.equal(first.trust_established, false);
  assert.equal(first.deployable, false);
  assert.equal(first.public_release_disposition, 'NO-GO');
  assert.equal(status(first, 'approved_backend_lock'), 'MISSING');
  assert.equal(status(first, 'ci_job_inventory'), 'CONFIRMED');
  assert.equal(status(first, 'ci_install_inventory'), 'CONFIRMED');
  assert.deepEqual(first.ci_jobs.map(job => job.name), ['postgres-real-stack-browser', 'real-stack-browser', 'exploration-real-stack-browser', 'verify', 'exploration-release']);
  assert.deepEqual(first.ci_jobs.filter(job => job.backendCheckout).map(job => job.name), ['postgres-real-stack-browser', 'real-stack-browser', 'exploration-real-stack-browser']);
  assert.equal(first.trust_established, false);
  assert.doesNotMatch(JSON.stringify(first), /aroman-dependency-readiness|\/tmp\//);
}));

test('wrong Backend revision is classified as drift risk', () => withFixture({ backendRevision: '1'.repeat(40) }, f => assert.equal(status(f.run(), 'backend_revision'), 'DRIFT_RISK')));
test('missing Backend dependency declaration is detected', () => withFixture({ pyproject: initialPyproject.replace(', "alembic>=1.14,<2"', '') }, f => assert.equal(status(f.run(), 'dependency_declarations'), 'DRIFT_RISK')));
test('unexpected Backend dependency declaration changes are detected', () => withFixture({ pyproject: initialPyproject.replace('"fastapi>=0.115,<1"', '"fastapi>=0.115,<1", "example-extra>=1"') }, f => assert.equal(status(f.run(), 'dependency_declarations'), 'DRIFT_RISK')));
test('changed version ranges, Python requirement, build backend, and extras are detected', () => withFixture({}, f => {
  for (const changed of [
    initialPyproject.replace('sqlalchemy>=2.0,<3', 'sqlalchemy>=2.0,<4'),
    initialPyproject.replace('requires-python = ">=3.12"', 'requires-python = ">=3.13"'),
    initialPyproject.replace('setuptools.build_meta', 'custom.backend'),
    initialPyproject.replace('uvicorn[standard]', 'uvicorn'),
    initialPyproject.replace('dev = [', 'test = [').replace(']\n', ']\n'),
  ]) {
    f.writePyproject(changed);
    if (changed.includes('test = [')) assert.throws(() => f.run(), /Unsupported optional dependency groups/);
    else assert.equal(status(f.run(), 'dependency_declarations'), 'DRIFT_RISK');
  }
}));
test('multiline arrays, comments, whitespace, extras, and literal strings are parsed', () => withFixture({ pyproject: `[build-system]\nrequires = [\n  'setuptools>=75', # build backend requirement\n]\nbuild-backend = 'setuptools.build_meta' # backend\n\n[project]\nname = 'aroman-backend'\nversion = '0.1.0'\nrequires-python = '>=3.12'\ndependencies = [\n  'fastapi>=0.115,<1', # API\n  'uvicorn[standard]>=0.34,<1',\n  'pydantic-settings>=2.7,<3',\n  'sqlalchemy>=2.0,<3',\n  'alembic>=1.14,<2',\n  'psycopg[binary]>=3.2,<4',\n]\n\n[project.optional-dependencies]\ndev = [\n  'pytest>=8,<10',\n  'httpx>=0.27,<1',\n  'ruff>=0.9,<1',\n  'mypy>=1.14,<2',\n]\n` }, f => {
  const report = f.run();
  assert.equal(report.dependency_inventory.expected_declarations_match_reviewed_inventory, true);
  assert.equal(status(report, 'dependency_declarations'), 'CONFIRMED');
}));
test('duplicate TOML keys fail closed instead of silently selecting one declaration', () => withFixture({ pyproject: initialPyproject.replace('version = "0.1.0"', 'version = "0.1.0"\nrequires-python = ">=3.12"') }, f => {
  assert.throws(() => f.run(), /Duplicate TOML key/);
}));
test('missing required TOML tables fail closed with a structural error', () => withFixture({ pyproject: initialPyproject.replace('[project.optional-dependencies]', '[project.optional-dependencies-removed]') }, f => {
  assert.throws(() => f.run(), /Required build-system, project or optional-dependencies TOML table is missing/);
}));
test('unsupported TOML dependency metadata fails closed instead of being omitted', () => withFixture({ pyproject: `${initialPyproject}\n[tool.poetry]\ndependencies = { hidden = '*' }\n` }, f => {
  assert.throws(() => f.run(), /Unsupported TOML table/);
}));
test('changed build-system requirements are detected', () => withFixture({ pyproject: initialPyproject.replace('setuptools>=75', 'setuptools>=99') }, f => assert.equal(status(f.run(), 'dependency_declarations'), 'DRIFT_RISK')));
test('missing Backend checkout pin is detected', () => withFixture({ workflow: ci().replace(`ref: ${pin}`, '') }, f => assert.equal(status(f.run(), 'ci_checkout_pins'), 'DRIFT_RISK')));
test('wrong Frontend CI Backend revision is detected', () => withFixture({ workflow: ci('1'.repeat(40)) }, f => assert.equal(status(f.run(), 'ci_checkout_pins'), 'DRIFT_RISK')));
test('removed Backend checkout and changed CI Python selection are detected', () => withFixture({}, f => {
  let workflow = ci().replace('repository: AromanCo/Backend', 'repository: ExampleCo/Backend');
  f.writeWorkflow(workflow);
  const removed = f.run(); assert.equal(status(removed, 'ci_checkout_pins'), 'DRIFT_RISK');
  workflow = ci().replaceAll("python-version: '3.12'", "python-version: '3.13'");
  f.writeWorkflow(workflow);
  assert.equal(status(f.run(), 'ci_python_toolchain'), 'DRIFT_RISK');
}));
test('new Python install commands and frontend-only Python installers are detected', () => withFixture({}, f => {
  const extraBackendInstall = ci().replace('python -m pip install ./backend-pinned', 'python -m pip install ./backend-pinned\n          pip install new-package>=1');
  f.writeWorkflow(extraBackendInstall);
  const extraReport=f.run(); assert.equal(status(extraReport, 'ci_install_inventory'), 'DRIFT_RISK');
  assert.equal(extraReport.ci_jobs[2].installCommands.length, 2);
  const unscoped = ci().replace('  exploration-release:\n    steps: []', '  exploration-release:\n    steps:\n      - run: pip install unscoped-package');
  f.writeWorkflow(unscoped);
  assert.equal(status(f.run(), 'ci_install_inventory'), 'DRIFT_RISK');
  const alternate = ci().replace('  exploration-release:\n    steps: []', '  exploration-release:\n    steps:\n      - run: poetry install');
  f.writeWorkflow(alternate);
  assert.equal(f.run().ci_jobs[4].installCommands[0], 'poetry install');
  assert.equal(status(f.run(), 'ci_install_inventory'), 'DRIFT_RISK');
}));
test('differing CI dependency installation strategies remain a drift risk', () => withFixture({}, f => {
  const report = f.run();
  assert.equal(status(report, 'ci_install_strategy'), 'DRIFT_RISK');
  assert.equal(new Set(report.backend_ci_install_forms.map(item => item.command.endsWith('pip install ./backend-pinned') ? 'project' : 'explicit')).size, 2);
}));
test('mutable ranges and missing hashes are not accepted as reproducible lock evidence', () => withFixture({}, f => {
  const report = f.run();
  assert.equal(report.reproducible_environment, false);
  assert.equal(status(report, 'hash_verified_install'), 'MISSING');
  assert.equal(status(report, 'approved_backend_lock'), 'MISSING');
}));
test('a lock-like file is not treated as approved lock evidence', () => withFixture({ lock: 'uv.lock' }, f => {
  const report = f.run();
  assert.equal(report.dependency_inventory.lock_files[0], 'uv.lock');
  assert.equal(status(report, 'approved_backend_lock'), 'UNVERIFIED');
}));
test('unsupported Backend lock evidence status is rejected as drift', () => withFixture({}, f => {
  const manifest = exampleManifest(); manifest.dependencies.backend.lock_status = 'VERIFIED';
  assert.equal(status(f.run({ manifest }), 'manifest_lock_evidence'), 'DRIFT_RISK');
}));
test('fabricated dependency verification cannot establish trust', () => withFixture({}, f => {
  const report = f.run();
  assert.equal(report.dependency_verification, 'UNVERIFIED');
  assert.equal(report.trusted, false);
}));
test('synthetic evidence stays outside production acceptance', () => withFixture({}, f => {
  const manifest = exampleManifest(); manifest.evidence_class = 'synthetic_fixture';
  assert.equal(status(f.run({ manifest }), 'synthetic_evidence_boundary'), 'CONFIRMED');
  manifest.release_safety.production_acceptance_claim = true;
  assert.equal(status(f.run({ manifest }), 'synthetic_evidence_boundary'), 'DRIFT_RISK');
}));
test('secret-bearing metadata fails with a generic error', () => withFixture({ pyproject: initialPyproject + '\n# API_TOKEN=synthetic_sensitive_fixture\n' }, f => {
  assert.throws(() => f.run(), error => !error.message.includes('synthetic_sensitive_fixture') && error.message.includes('Secret-like content'));
}));
test('credential-bearing installer URLs fail without echoing credentials', () => withFixture({ workflow: ci().replace('pip install ./backend-pinned', 'pip install https://user:syntheticcredential@packages.invalid/simple') }, f => {
  f.writeWorkflow(ci().replace('pip install ./backend-pinned', 'pip install https://user:pass@packages.invalid/simple'));
  assert.throws(() => f.run(), error => error.message.includes('Secret-like content') && !error.message.includes('pass@packages.invalid'));
}));
test('unknown Backend revision and policy are never treated as approved', () => withFixture({}, f => {
  const report = f.run({ backendRevision: null });
  assert.equal(status(report, 'backend_revision'), 'DRIFT_RISK');
  assert.equal(status(report, 'owner_policy'), 'OWNER_DECISION_REQUIRED');
  assert.equal(report.reproducible_environment, false);
}));
test('public GO without authorization is classified as drift and output remains NO-GO', () => withFixture({}, f => {
  const manifest = exampleManifest(); manifest.release_safety.public_release_disposition = 'GO';
  const report = f.run({ manifest });
  assert.equal(status(report, 'production_release_invariants'), 'DRIFT_RISK');
  assert.equal(report.public_release_disposition, 'NO-GO');
}));
test('malformed pyproject fails closed without echoing source contents', () => withFixture({ pyproject: 'TOKEN=synthetic_private_fixture' }, f => {
  assert.throws(() => f.run(), error => error.message.includes('Secret-like content') && !error.message.includes('synthetic_private_fixture'));
}));
