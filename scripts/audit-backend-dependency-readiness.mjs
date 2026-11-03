#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_BACKEND_PIN = '0be24c4597bd693e70348243c26e550a20a8ad0e';
const EXPECTED_BUILD_REQUIREMENTS = ['setuptools>=75'];
const EXPECTED_BUILD_BACKEND = 'setuptools.build_meta';
const EXPECTED_PYTHON = '>=3.12';
const EXPECTED_RUNTIME = [
  'fastapi>=0.115,<1', 'uvicorn[standard]>=0.34,<1', 'pydantic-settings>=2.7,<3',
  'sqlalchemy>=2.0,<3', 'alembic>=1.14,<2', 'psycopg[binary]>=3.2,<4',
];
const EXPECTED_DEV = ['pytest>=8,<10', 'httpx>=0.27,<1', 'ruff>=0.9,<1', 'mypy>=1.14,<2'];
const EXPECTED_FRONTEND_CI_JOBS = [
  'postgres-real-stack-browser', 'real-stack-browser', 'exploration-real-stack-browser', 'verify', 'exploration-release',
];
const EXPECTED_BACKEND_CI_JOBS = ['postgres-real-stack-browser', 'real-stack-browser', 'exploration-real-stack-browser'];
const EXPECTED_BACKEND_CI_INSTALLS = new Map([
  ['postgres-real-stack-browser', "python -m pip install 'fastapi>=0.115,<1' 'uvicorn>=0.34,<1' 'pydantic-settings>=2.7,<3' 'sqlalchemy>=2.0,<3' 'alembic>=1.14,<2' 'psycopg[binary]>=3.2,<4' 'httpx>=0.27,<1'"],
  ['real-stack-browser', "python -m pip install 'fastapi>=0.115,<1' 'uvicorn>=0.34,<1' 'pydantic-settings>=2.7,<3' 'sqlalchemy>=2.0,<3' 'alembic>=1.14,<2'"],
  ['exploration-real-stack-browser', 'python -m pip install ./backend-pinned'],
]);
const REGISTER_IDS = [
  'SRC-FE','SRC-BE','CHK-FE','CHK-BE','TREE-FE','TREE-BE','LOCK-FE','LOCK-BE','TOOL-FE','TOOL-BE',
  'CAND-FE','IMG-FE','IMG-API','IMG-PG','SBOM','PROV','SIG-VERIFY','SIGNER','ROOT','CMP-RUNTIME','CMP-MIGRATION',
  'DB-SCHEMA','DB-GRANTS','CONTENT-RIGHTS','NETWORK','DNS-TLS-ROUTING','CATALOG-ROUTES','EXCLUDED-CAPABILITIES',
  'ENV-SECRETS','LOGGING','CAPACITY','BACKUP-RESTORE','MONITORING','ROLLBACK','REVIEWER','RELEASE-AUTH',
];
const SECRET_PATTERN = /(?:password|token|secret|private[_ -]?key|api[_ -]?key)\s*[:=]\s*\S+/i;
const CREDENTIAL_URL_PATTERN = /https?:\/\/[^\s/@:]+:[^\s/@]+@/i;
const TOKEN_PATTERN = /\b(?:gh[pousr]_|github_pat_|pypi-)[A-Za-z0-9_-]{12,}\b/;

function fail(message) { throw new Error(message); }
function assertNoSensitiveText(text, label) {
  if (SECRET_PATTERN.test(text) || CREDENTIAL_URL_PATTERN.test(text) || TOKEN_PATTERN.test(text)) fail(`Secret-like content found in ${label}.`);
}
function safeRead(path, label) {
  try { return readFileSync(path, 'utf8'); } catch { fail(`Cannot read required ${label}.`); }
}
function stripTomlComment(line) {
  let quote = null; let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = null;
    } else if (quote === "'") {
      if (char === "'") quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '#') return line.slice(0, i);
  }
  if (quote) fail('Multiline TOML strings are outside the supported static parser subset.');
  return line;
}
function arrayIsComplete(value) {
  let depth = 0; let quote = null; let escaped = false;
  for (const char of value) {
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = null;
    } else if (quote === "'") {
      if (char === "'") quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '[') depth += 1;
    else if (char === ']') depth -= 1;
  }
  if (quote) return false;
  if (depth < 0) fail('Malformed TOML array in dependency metadata.');
  return depth === 0;
}
function parseTomlString(raw, label) {
  const value = raw.trim();
  if (value.startsWith('"""') || value.startsWith("'''") || value.length < 2) fail(`Unsupported TOML string form in ${label}.`);
  if (value[0] === '"' && value.at(-1) === '"') {
    try { const parsed = JSON.parse(value); if (typeof parsed === 'string') return parsed; } catch { /* fail below */ }
  }
  if (value[0] === "'" && value.at(-1) === "'") return value.slice(1, -1);
  fail(`Unsupported TOML string form in ${label}.`);
}
function parseStringArray(raw, label) {
  const value = raw.trim();
  if (!value.startsWith('[') || !value.endsWith(']')) fail(`Cannot parse ${label} as a TOML array of strings.`);
  const body = value.slice(1, -1); const result = []; let i = 0; let afterComma = false;
  while (i < body.length) {
    while (/\s/.test(body[i] ?? '')) i += 1;
    if (i >= body.length) break;
    if (body[i] === ',') {
      if (!result.length || afterComma) fail(`Malformed comma placement in ${label}.`);
      afterComma = true; i += 1; continue;
    }
    if (body[i] !== '"' && body[i] !== "'") fail(`Unsupported TOML array item in ${label}; only quoted strings are accepted.`);
    const quote = body[i]; const start = i; i += 1; let escaped = false;
    for (; i < body.length; i += 1) {
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && body[i] === '\\') { escaped = true; continue; }
      if (body[i] === quote) break;
    }
    if (i >= body.length) fail(`Unterminated TOML string in ${label}.`);
    result.push(parseTomlString(body.slice(start, i + 1), label)); i += 1; afterComma = false;
    while (/\s/.test(body[i] ?? '')) i += 1;
    if (i < body.length && body[i] !== ',') fail(`Expected a comma in ${label}.`);
  }
  return result;
}
function parseToml(text) {
  const tables = new Map([['', new Map()]]); let current = ''; let pending = null;
  const lines = text.split(/\r?\n/);
  for (const original of lines) {
    const line = stripTomlComment(original).trim();
    if (!line) continue;
    if (pending) {
      pending.raw += `\n${line}`;
      if (arrayIsComplete(pending.raw)) { pending.table.set(pending.key, pending.raw); pending = null; }
      continue;
    }
    if (line.startsWith('[')) {
      const table = line.match(/^\[\s*([A-Za-z0-9_.-]+)\s*\]$/);
      if (!table) fail('Unsupported TOML table syntax in Backend metadata.');
      current = table[1];
      if (tables.has(current)) fail('Duplicate TOML table in Backend dependency metadata.');
      tables.set(current, new Map()); continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!assignment) fail('Unsupported TOML assignment syntax in Backend dependency metadata.');
    const [, key, raw] = assignment; const table = tables.get(current);
    if (table.has(key) || (pending && pending.key === key)) fail('Duplicate TOML key in Backend dependency metadata.');
    if (raw.trim().startsWith('[') && !arrayIsComplete(raw)) pending = { table, key, raw };
    else table.set(key, raw);
  }
  if (pending) fail('Unterminated TOML array in Backend dependency metadata.');
  return tables;
}
function arrayField(table, key, label) {
  const raw = table?.get(key);
  if (raw === undefined) fail(`Missing ${label} declaration.`);
  return parseStringArray(raw, label);
}
function stringField(table, key, label) {
  const raw = table?.get(key);
  if (raw === undefined) fail(`Missing ${label} declaration.`);
  return parseTomlString(raw, label);
}
function parsePyproject(text) {
  assertNoSensitiveText(text, 'Backend dependency metadata');
  const tables = parseToml(text);
  const build = tables.get('build-system'); const project = tables.get('project'); const optional = tables.get('project.optional-dependencies');
  if (!build || !project || !optional) fail('Required build-system, project or optional-dependencies TOML table is missing.');
  const supportedNonDependencyTables = new Set([
    'project.scripts', 'tool.setuptools.packages.find', 'tool.pytest.ini_options',
    'tool.ruff', 'tool.ruff.lint', 'tool.mypy',
  ]);
  if ([...tables.keys()].some(table => !['', 'build-system', 'project', 'project.optional-dependencies'].includes(table) && !supportedNonDependencyTables.has(table))) fail('Unsupported TOML table in Backend metadata; static inventory cannot establish dependency inputs.');
  if ([...build.keys()].some(key => !['requires', 'build-backend'].includes(key))) fail('Unsupported build-system metadata key; static inventory cannot establish build inputs.');
  if ([...project.keys()].some(key => !['name', 'version', 'requires-python', 'dependencies'].includes(key))) fail('Unsupported project metadata key; static inventory cannot establish dependency inputs.');
  if ([...tables.get('').keys()].length) fail('Unsupported top-level pyproject metadata; static inventory cannot establish dependency inputs.');
  if (project.has('dynamic')) fail('Dynamic project metadata is unsupported by this static inventory.');
  const optionalGroups = [...optional.keys()].sort();
  if (optionalGroups.some(group => group !== 'dev') || optionalGroups.length !== 1) fail('Unsupported optional dependency groups in Backend metadata.');
  return {
    name: stringField(project, 'name', 'project name'),
    version: stringField(project, 'version', 'project version'),
    python: stringField(project, 'requires-python', 'Python requirement'),
    buildSystem: arrayField(build, 'requires', 'build-system requirements'),
    buildBackend: stringField(build, 'build-backend', 'build backend'),
    runtime: arrayField(project, 'dependencies', 'runtime dependencies'),
    dev: arrayField(optional, 'dev', 'development dependencies'),
    optionalGroups,
  };
}
function parseJobs(workflow) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex(line => line === 'jobs:');
  if (start < 0) fail('Frontend CI jobs section is missing.');
  const headers = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const found = lines[i].match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (found) headers.push({ name: found[1], line: i });
  }
  if (headers.length !== 5) fail('Frontend CI job inventory is incomplete or unexpected.');
  return headers.map((header, index) => {
    const block = lines.slice(header.line, headers[index + 1]?.line ?? lines.length).join('\n');
    const backendCheckout = /repository:\s*AromanCo\/Backend/.test(block);
    const revisionValue = backendCheckout ? block.match(/repository:\s*AromanCo\/Backend[\s\S]{0,250}?ref:\s*([^\s]+)/)?.[1] : null;
    const revision = revisionValue && /^[a-f0-9]{40}$/.test(revisionValue) ? revisionValue : null;
    const python = block.match(/python-version:\s*['"]?([^\s'"]+)/)?.[1] ?? null;
    const installs = [...block.matchAll(/^\s*(?:-\s*run:\s*)?(?:(?:python(?:\d+(?:\.\d+)?)?)\s+-m\s+)?(?:pip(?:\d+(?:\.\d+)*)?(?:\s+\w+)*\s+(?:install|download)|uv\s+(?:pip\s+install|sync|lock)|pip-compile|pipx\s+install|poetry\s+install|pdm\s+install|pipenv\s+install|conda\s+install|micromamba\s+install)\b.*$/gm)]
      .map(m => m[0].trim().replace(/^-\s*run:\s*/, ''));
    return { name: header.name, backendCheckout, backendRevision: revision, python, installCommands: installs };
  });
}
function compare(actual, expected) { return actual.length === expected.length && expected.every(item => actual.includes(item)); }
function inventoryLocks(backendRoot) {
  const found = [];
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(resolve(directory, entry.name), relative);
      else if (entry.isFile() && /^(?:uv\.lock|poetry\.lock|Pipfile\.lock|pdm\.lock|requirements(?:[-_.][A-Za-z0-9_.-]+)?\.txt)$/.test(entry.name)) found.push(relative);
    }
  }
  visit(backendRoot);
  return found.sort();
}
function safeGitRevision(backendRoot) {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: backendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      env: { PATH: '/usr/bin:/bin', HOME: '/tmp', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
    }).trim();
    return /^[a-f0-9]{40}$/.test(revision) ? revision : null;
  }
  catch { return null; }
}

export function auditReadiness({ frontendRoot, backendRoot, backendRevision, manifest: suppliedManifest } = {}) {
  if (!frontendRoot || !backendRoot) fail('Frontend and Backend roots are required.');
  const frontend = resolve(frontendRoot);
  const backend = resolve(backendRoot);
  const pinSource = safeRead(resolve(frontend, 'scripts/backend-pin.mjs'), 'Backend pin');
  const pin = pinSource.match(/backendSha\s*=\s*'([a-f0-9]{40})'/)?.[1];
  if (!pin) fail('Backend pin declaration is malformed.');
  const revisionCandidate = backendRevision ?? safeGitRevision(backend);
  const revision = typeof revisionCandidate === 'string' && /^[a-f0-9]{40}$/.test(revisionCandidate) ? revisionCandidate : null;
  const pyproject = safeRead(resolve(backend, 'pyproject.toml'), 'Backend pyproject');
  const workflow = safeRead(resolve(frontend, '.github/workflows/ci.yml'), 'Frontend CI workflow');
  const dockerfile = safeRead(resolve(backend, 'Dockerfile'), 'Backend Dockerfile');
  const manifestPath = resolve(frontend, 'docs/offline-artifact-manifest.example.json');
  let manifest = suppliedManifest;
  if (manifest === undefined) {
    try { manifest = JSON.parse(safeRead(manifestPath, 'offline artifact manifest example')); }
    catch { fail('Offline artifact manifest example is malformed.'); }
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) fail('Offline artifact manifest has an unsupported structure.');
  assertNoSensitiveText(JSON.stringify(manifest), 'offline artifact manifest');
  for (const [label, text] of [['Frontend CI workflow', workflow], ['Backend Dockerfile', dockerfile]]) {
    assertNoSensitiveText(text, label);
  }
  const registerPath = resolve(frontend, 'docs/M6_A28F_RELEASE_EVIDENCE_READINESS.md');
  const register = existsSync(registerPath) ? safeRead(registerPath, 'release evidence register') : '';
  const parsed = parsePyproject(pyproject);
  const jobs = parseJobs(workflow);
  const backendJobs = jobs.filter(job => job.backendCheckout);
  const allInstalls = jobs.flatMap(job => job.installCommands.map(command => ({ job: job.name, command })));
  const installs = backendJobs.flatMap(job => job.installCommands.map(command => ({ job: job.name, command })));
  if (allInstalls.some(({ command }) => /(?:^|\s)(?:\/(?:tmp|home|root|Users|workspace)\/|[A-Za-z]:\\\\|\\\\\\\\)/.test(command))) fail('Absolute local path found in dependency installation command.');
  const explicit = installs.filter(item => !item.command.endsWith('pip install ./backend-pinned'));
  const installForms = new Set(installs.map(item => item.command.endsWith('pip install ./backend-pinned') ? 'local-project' : 'explicit-requirements'));
  const locks = inventoryLocks(backend);
  const lockEvidenceStatus = manifest?.dependencies?.backend?.lock_status;
  const lockEvidenceReference = manifest?.dependencies?.backend?.lock_reference;
  const lockEvidenceSupported = lockEvidenceStatus === 'NOT_CAPTURED' && lockEvidenceReference === 'NOT_CAPTURED';
  const expectedDeclarations = compare(parsed.buildSystem, EXPECTED_BUILD_REQUIREMENTS)
    && parsed.buildBackend === EXPECTED_BUILD_BACKEND && parsed.python === EXPECTED_PYTHON
    && compare(parsed.runtime, EXPECTED_RUNTIME) && compare(parsed.dev, EXPECTED_DEV)
    && compare(parsed.optionalGroups, ['dev']);
  const jobNamesMatch = compare(jobs.map(job => job.name), EXPECTED_FRONTEND_CI_JOBS);
  const backendJobNamesMatch = compare(backendJobs.map(job => job.name), EXPECTED_BACKEND_CI_JOBS);
  const ciPinsCorrect = backendJobNamesMatch && backendJobs.every(job => job.backendRevision === pin);
  const pythonConsistent = backendJobNamesMatch && backendJobs.every(job => job.python === '3.12');
  const ciInstallsMatchSnapshot = backendJobNamesMatch && backendJobs.every(job => {
    const expected = EXPECTED_BACKEND_CI_INSTALLS.get(job.name);
    return expected !== undefined && job.installCommands.length === 1 && job.installCommands[0] === expected;
  }) && jobs.filter(job => !job.backendCheckout).every(job => job.installCommands.length === 0);
  const registerMissing = REGISTER_IDS.filter(id => !register.includes(`| ${id} |`));
  const checks = [
    { id: 'backend_revision', status: revision === pin && pin === EXPECTED_BACKEND_PIN ? 'CONFIRMED' : 'DRIFT_RISK', value: revision === pin ? 'pinned revision matches' : 'revision does not match configured pin' },
    { id: 'dependency_declarations', status: expectedDeclarations ? 'CONFIRMED' : 'DRIFT_RISK', value: 'static direct requirements parsed; no versions resolved' },
    { id: 'ci_job_inventory', status: jobNamesMatch ? 'CONFIRMED' : 'DRIFT_RISK', value: 'five expected Frontend CI jobs are statically identified' },
    { id: 'ci_checkout_pins', status: ciPinsCorrect ? 'CONFIRMED' : 'DRIFT_RISK', value: `${backendJobs.length} Frontend jobs check out Backend` },
    { id: 'ci_python_toolchain', status: pythonConsistent ? 'CONFIRMED' : 'DRIFT_RISK', value: pythonConsistent ? 'all Backend-consuming Frontend jobs select Python 3.12; pip version is unspecified' : 'Python selection differs or is missing' },
    { id: 'ci_install_inventory', status: ciInstallsMatchSnapshot ? 'CONFIRMED' : 'DRIFT_RISK', value: ciInstallsMatchSnapshot ? 'Backend installation commands match the reviewed static snapshot' : 'Backend installation command inventory changed or includes an unscoped Python installer' },
    { id: 'ci_install_strategy', status: installForms.size > 1 || explicit.some(item => item.command !== explicit[0]?.command) ? 'DRIFT_RISK' : 'UNVERIFIED', value: `${installForms.size} installation forms; explicit lists differ and are not shown equivalent to project installation` },
    { id: 'approved_backend_lock', status: locks.length ? 'UNVERIFIED' : 'MISSING', value: locks.length ? 'lock-like files exist but no approved lock identity or policy is configured' : 'no Backend dependency lock found' },
    { id: 'hash_verified_install', status: 'MISSING', value: 'no approved package-hash enforcement is configured' },
    { id: 'pip_resolver_identity', status: 'MISSING', value: 'pip and resolver versions are not pinned in Frontend CI or the Backend Dockerfile' },
    { id: 'package_index_provenance', status: 'MISSING', value: 'no approved package index/mirror identity or artifact provenance policy is configured' },
    { id: 'supported_platform_matrix', status: 'OWNER_DECISION_REQUIRED', value: 'supported Python ABI, operating system and architecture targets are not approved' },
    { id: 'backend_base_image', status: /^python:[^@]+$/.test(dockerfile.match(/^FROM\s+(\S+)/m)?.[1] ?? '') ? 'DRIFT_RISK' : 'UNVERIFIED', value: 'Backend Dockerfile base image is a mutable tag unless an immutable digest is specified' },
    { id: 'manifest_lock_evidence', status: lockEvidenceSupported ? 'MISSING' : 'DRIFT_RISK', value: lockEvidenceSupported ? 'existing manifest explicitly records Backend lock evidence as NOT_CAPTURED' : 'manifest lock evidence state is unsupported or inconsistent' },
    { id: 'production_release_invariants', status: manifest?.release_safety?.deployable === false && manifest?.release_safety?.production_acceptance_claim === false && manifest?.release_safety?.public_release_disposition === 'NO-GO' ? 'CONFIRMED' : 'DRIFT_RISK', value: 'static report itself always remains non-deployable and NO-GO' },
    { id: 'synthetic_evidence_boundary', status: manifest?.evidence_class === 'synthetic_fixture' && manifest?.release_safety?.production_acceptance_claim !== false ? 'DRIFT_RISK' : 'CONFIRMED', value: manifest?.evidence_class === 'synthetic_fixture' ? 'synthetic evidence is explicitly kept outside production acceptance' : 'no synthetic evidence promoted by this audit' },
    { id: 'dependency_closure', status: 'UNVERIFIED', value: 'transitive resolution, selected wheels and build dependencies are not resolved offline' },
    { id: 'release_evidence_register', status: registerMissing.length ? 'DRIFT_RISK' : 'CONFIRMED', value: registerMissing.length ? `${registerMissing.length} identifiers absent` : 'register identifiers match audit inventory' },
    { id: 'owner_policy', status: 'OWNER_DECISION_REQUIRED', value: 'lock tool, toolchain, indexes, hashes and approval roles remain undecided' },
  ];
  return {
    format: 1,
    type: 'aroman-backend-dependency-readiness-audit',
    evidence_class: 'static_repository_inventory',
    frontend_revision: safeGitRevision(frontend) ?? 'UNVERIFIED',
    backend_pin: pin,
    backend_revision: revision ?? 'UNVERIFIED',
    dependency_inventory: {
      backend_name: parsed.name,
      python_requirement: parsed.python,
      build_system: { backend: parsed.buildBackend, requirements: parsed.buildSystem },
      runtime_requirements: parsed.runtime,
      development_requirements: parsed.dev,
      development_extras: ['dev'],
      lock_files: locks,
      backend_dockerfile_base: dockerfile.match(/^FROM\s+(\S+)/m)?.[1] ?? 'UNVERIFIED',
      expected_declarations_match_reviewed_inventory: expectedDeclarations,
    },
    ci_jobs: jobs,
    backend_ci_install_forms: installs,
    manifest_evidence_class: manifest?.evidence_class ?? 'UNVERIFIED',
    statuses: checks,
    reproducible_environment: false,
    trusted: false,
    trust_established: false,
    deployable: false,
    production_acceptance_claim: false,
    public_release_disposition: 'NO-GO',
    signature_verification: 'UNVERIFIED',
    dependency_verification: 'UNVERIFIED',
    limitations: [
      'Static declarations do not resolve or prove a dependency closure.',
      'No package registry, installer, resolver, lock generator or image build was run.',
      'A valid source pin and parsed pyproject do not establish reproducibility.',
      'CI success does not establish equivalent dependency sets across installation commands.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const frontendRoot = resolve(import.meta.dirname, '..');
  const backendRoot = resolve(frontendRoot, '..', 'Backend');
  try {
    const report = auditReadiness({ frontendRoot, backendRoot });
    console.log(JSON.stringify(report, null, 2));
  } catch {
    console.error('Backend dependency readiness audit failed closed; inspect required static inputs locally.');
    process.exitCode = 1;
  }
}
