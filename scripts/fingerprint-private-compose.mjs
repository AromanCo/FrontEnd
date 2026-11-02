#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalSha256, CANONICALIZATION_ALGORITHM } from './canonical-json.mjs';
import { COMPOSE_FILE, REQUIRED_SECRETS, validateEffectiveCompose } from './validate-private-compose.mjs';

export const COMPOSE_FINGERPRINT_FORMAT = 1;
export const COMPOSE_PROFILES = Object.freeze({ runtime: 'default', migration: 'controlled-migration' });
const ROOT = resolve(import.meta.dirname, '..');
const REQUIRED_INPUT_FILES = Object.freeze([
  'deploy/private-preproduction/compose.yaml',
  'deploy/private-preproduction/Dockerfile.frontend',
  'deploy/private-preproduction/Dockerfile.frontend.dockerignore',
  'deploy/private-preproduction/Dockerfile.catalog-api',
  'deploy/private-preproduction/Dockerfile.catalog-api.dockerignore',
  'deploy/private-preproduction/Dockerfile.database',
  'deploy/private-preproduction/Dockerfile.database.dockerignore',
  'deploy/private-preproduction/database-role-init.sh',
  'deploy/private-preproduction/apply-catalog-read-only-grants.py',
  'scripts/validate-private-compose.mjs',
]);
const ENV_ALLOWLIST = Object.freeze([
  'AROMAN_FRONTEND_IMAGE', 'AROMAN_CATALOG_API_IMAGE', 'AROMAN_POSTGRES_IMAGE', 'AROMAN_FRONTEND_HOST_PORT',
  'AROMAN_DB_NAME', 'AROMAN_BACKEND_CORS_ORIGINS', 'AROMAN_RUNTIME_DATABASE_URL_FILE',
  'AROMAN_MIGRATION_DATABASE_URL_FILE', 'AROMAN_DATABASE_BOOTSTRAP_PASSWORD_FILE',
  'AROMAN_MIGRATION_PASSWORD_FILE', 'AROMAN_RUNTIME_PASSWORD_FILE', 'AROMAN_OTP_PEPPER_FILE', 'AROMAN_SESSION_PEPPER_FILE',
]);
const SYNTHETIC_IMAGE = 'registry.invalid/aroman/synthetic@sha256:';
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export function readFingerprintInput(repositoryRoot, relativePath) {
  const root = realpathSync(repositoryRoot);
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error('Fingerprint input path is unsafe.');
  const parts = relativePath.split(/[\\/]/);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = resolve(current, parts[index]);
    let info;
    try { info = lstatSync(current); } catch { throw new Error('Fingerprint input is missing or unreadable.'); }
    if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error('Fingerprint inputs must be regular files without symlink components.');
  }
  const rel = relative(root, current);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || realpathSync(current) !== current) throw new Error('Fingerprint input escapes the repository.');
  let fd;
  try {
    fd = openSync(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!fstatSync(fd).isFile()) throw new Error('Fingerprint input is not a regular file.');
    return readFileSync(fd);
  } catch { throw new Error('Fingerprint input could not be read safely.'); }
  finally { if (fd !== undefined) closeSync(fd); }
}
function syntheticValues(secretDir) {
  const vals = {
    AROMAN_FRONTEND_IMAGE: `${SYNTHETIC_IMAGE}${'1'.repeat(64)}`,
    AROMAN_CATALOG_API_IMAGE: `${SYNTHETIC_IMAGE}${'2'.repeat(64)}`,
    AROMAN_POSTGRES_IMAGE: `${SYNTHETIC_IMAGE}${'3'.repeat(64)}`,
    AROMAN_FRONTEND_HOST_PORT: '18443', AROMAN_DB_NAME: 'aroman',
    AROMAN_BACKEND_CORS_ORIGINS: 'https://synthetic.invalid',
  };
  const envForSecret = {
    catalog_runtime_database_url: 'AROMAN_RUNTIME_DATABASE_URL_FILE',
    catalog_migration_database_url: 'AROMAN_MIGRATION_DATABASE_URL_FILE',
    database_bootstrap_password: 'AROMAN_DATABASE_BOOTSTRAP_PASSWORD_FILE',
    catalog_migration_password: 'AROMAN_MIGRATION_PASSWORD_FILE',
    catalog_runtime_password: 'AROMAN_RUNTIME_PASSWORD_FILE',
    otp_pepper: 'AROMAN_OTP_PEPPER_FILE', session_pepper: 'AROMAN_SESSION_PEPPER_FILE',
  };
  for (const name of REQUIRED_SECRETS) vals[envForSecret[name]] = resolve(secretDir, name);
  return vals;
}
function injectedInventory(config) {
  const vals = {
    catalog_runtime_database_url: 'postgresql://aroman_app:runtime-password-synthetic-value-00000000000000000000000000000000@database:5432/aroman',
    catalog_migration_database_url: 'postgresql://aroman_migrator:migration-password-synthetic-value-00000000000000000000000000000000@database:5432/aroman',
    database_bootstrap_password: 'bootstrap-password-synthetic-value-00000000000000000000000000000000',
    catalog_migration_password: 'migration-password-synthetic-value-00000000000000000000000000000000',
    catalog_runtime_password: 'runtime-password-synthetic-value-00000000000000000000000000000000',
    otp_pepper: 'otp-pepper-synthetic-value-000000000000000000000000000000000000',
    session_pepper: 'session-pepper-synthetic-value-000000000000000000000000000000000000',
  };
  const paths = Object.fromEntries(Object.entries(config.secrets || {}).map(([name, item]) => [name, resolve(item.file)]));
  const dirs = [...new Set(Object.values(paths).map(dirname))];
  return { directory: { isSymbolicLink: false, isDirectory: true, uid: 0, gid: 0, mode: 0o700 },
    entries: Object.keys(paths), paths,
    files: Object.fromEntries(Object.keys(paths).map(name => [name, { isSymbolicLink: false, isFile: true, uid: 0, gid: 10001, mode: 0o440, contents: vals[name] }])) ,
    syntheticDirectoryCount: dirs.length };
}
export function normalizeConfig(value, secretIds = new Set(REQUIRED_SECRETS)) {
  if (Array.isArray(value)) return value.map(item => normalizeConfig(item, secretIds));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'file' && typeof item === 'string' && isAbsolute(item)) {
      const secret = basename(item);
      if (secretIds.has(secret)) out[key] = `secret://${secret}`;
      else {
        const rel = relative(ROOT, item);
        if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Rendered configuration contains an unrecognized absolute file path.');
        out[key] = `repo://${rel.split(sep).join('/')}`;
      }
    } else out[key] = normalizeConfig(item, secretIds);
  }
  return out;
}
export function buildFingerprint({ config, profile, composeVersion, cwd = ROOT, observedAt = new Date().toISOString(), syntheticSecretRoot }) {
  if (!Object.values(COMPOSE_PROFILES).includes(profile)) throw new Error('Profile must be the normal runtime profile or controlled-migration.');
  if (typeof composeVersion !== 'string' || !/^Docker Compose version v?[0-9][A-Za-z0-9.+-]*$/.test(composeVersion)) throw new Error('Docker Compose CLI version is required as a version string.');
  if (!syntheticSecretRoot) throw new Error('A temporary synthetic secret directory is required.');
  const expectedSecrets = profile === 'default' ? REQUIRED_SECRETS.filter(name => name !== 'catalog_migration_database_url') : REQUIRED_SECRETS;
  for (const name of expectedSecrets) {
    if (resolve(config?.secrets?.[name]?.file || '') !== resolve(syntheticSecretRoot, name)) throw new Error('Effective Compose secret paths must resolve to the temporary synthetic inventory.');
  }
  const inventory = injectedInventory(config);
  if (inventory.syntheticDirectoryCount > 1) throw new Error('Synthetic secret inventory must resolve to one temporary directory.');
  const errors = validateEffectiveCompose(config, { secretInventory: inventory, profile });
  if (errors.length) throw new Error('Unsafe effective Compose configuration; details suppressed.');
  const normalized = normalizeConfig(config);
  const inputPaths = deriveRelevantInputPaths(config, cwd);
  const fileIdentities = inputPaths.map(path => {
    const bytes = readFingerprintInput(cwd, path);
    return { path, sha256: sha256(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const composeSource = fileIdentities.find(item => item.path === 'deploy/private-preproduction/compose.yaml');
  if (!composeSource) throw new Error('Compose source must be included in the fingerprint inputs.');
  const payload = composeFingerprintPayload({ profile, composeVersion, normalizedCompose: normalized, inputs: fileIdentities, composeSource });
  return { fingerprint_format_version: COMPOSE_FINGERPRINT_FORMAT, profile_identifier: profile,
    input_file_identities: fileIdentities, compose_source_identity: composeSource,
    canonicalization_algorithm: CANONICALIZATION_ALGORITHM, docker_compose_version: composeVersion,
    sha256_fingerprint: canonicalSha256(payload), observed_at: observedAt,
    signed: false, trust_established: false, deployable: false, evidence_class: 'synthetic', payload };
}
export function deriveRelevantInputPaths(config, cwd = ROOT) {
  const root = resolve(cwd);
  const paths = new Set(REQUIRED_INPUT_FILES);
  const addRepoFile = file => {
    const absolute = resolve(file);
    const rel = relative(root, absolute);
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Compose references an input outside the repository.');
    paths.add(rel.split(sep).join('/'));
  };
  for (const item of Object.values(config.configs || {})) if (item?.file) addRepoFile(item.file);
  for (const service of Object.values(config.services || {})) {
    if (!service?.build) continue;
    const build = typeof service.build === 'string' ? { context: service.build } : service.build;
    const context = resolve(root, build.context || '.');
    const dockerfile = resolve(context, build.dockerfile || 'Dockerfile');
    addRepoFile(dockerfile);
    const specificIgnore = `${dockerfile}.dockerignore`;
    const contextIgnore = resolve(context, '.dockerignore');
    if (existsSync(specificIgnore)) addRepoFile(specificIgnore);
    else if (existsSync(contextIgnore)) addRepoFile(contextIgnore);
    else throw new Error('Build context has no Docker ignore file.');
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}
export function composeFingerprintPayload({ profile, composeVersion, normalizedCompose, inputs, composeSource }) {
  return {
    format: COMPOSE_FINGERPRINT_FORMAT,
    profile,
    canonicalization_algorithm: CANONICALIZATION_ALGORITHM,
    docker_compose_version: composeVersion,
    compose_source: composeSource,
    inputs,
    rendered_compose: normalizedCompose,
  };
}

export function safeComposeFailureMessage(error) {
  const safeMessages = new Set(['Docker Compose CLI is unavailable.', 'Docker Compose plugin is unavailable.', 'Docker Compose config rendering failed; details suppressed.']);
  return safeMessages.has(error?.message) ? error.message : 'Compose fingerprint generation failed; local paths and environment details were suppressed.';
}

export function renderSyntheticCompose({ profile, composeVersion, environment = {} }) {
  if (!Object.values(COMPOSE_PROFILES).includes(profile)) throw new Error('Profile must be the normal runtime profile or controlled-migration.');
  for (const key of Object.keys(environment)) if (!ENV_ALLOWLIST.includes(key)) throw new Error(`Unexpected Compose interpolation variable: ${key}`);
  if (Object.keys(environment).length) throw new Error('Compose fingerprint rendering accepts only its built-in synthetic interpolation values.');
  for (const path of REQUIRED_INPUT_FILES) readFingerprintInput(ROOT, path);
  const temp = mkdtempSync(resolve(tmpdir(), 'aroman-compose-fingerprint-'));
  try {
    const vars = { ...syntheticValues(temp), ...environment };
    const dockerConfig = resolve(temp, 'docker-config');
    mkdirSync(dockerConfig, { mode: 0o700 });
    const emptyEnvFile = resolve(temp, 'synthetic-empty.env');
    writeFileSync(emptyEnvFile, '', { mode: 0o600 });
    const env = { PATH: '/usr/bin:/bin', HOME: temp, DOCKER_CONFIG: dockerConfig, COMPOSE_DISABLE_ENV_FILE: '1', ...vars };
    const args = ['compose'];
    args.push('--env-file', emptyEnvFile);
    if (profile !== 'default') args.push('--profile', profile);
    args.push('-f', COMPOSE_FILE, 'config', '--format', 'json');
    // This is the sole Docker operation used: offline Compose config rendering.
    let raw;
    try { raw = execFileSync('docker', args, { cwd: temp, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('Docker Compose CLI is unavailable.');
      if (/compose is not a docker command|docker:.*compose.*not found/i.test(error.stderr?.toString?.() || '')) throw new Error('Docker Compose plugin is unavailable.');
      throw new Error('Docker Compose config rendering failed; details suppressed.');
    }
    const config = JSON.parse(raw);
    return buildFingerprint({ config, profile, composeVersion, cwd: ROOT, syntheticSecretRoot: temp });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
export function main(argv = process.argv.slice(2)) {
  try {
    const profileArg = argv[argv.indexOf('--profile') + 1];
    const versionArg = argv[argv.indexOf('--compose-version') + 1];
    if (!['default', 'controlled-migration'].includes(profileArg) || !versionArg) throw new Error('Usage: node scripts/fingerprint-private-compose.mjs --profile default|controlled-migration --compose-version "Docker Compose version vX.Y.Z"');
    const report = renderSyntheticCompose({ profile: profileArg, composeVersion: versionArg });
    console.log(JSON.stringify(report, null, 2));
    return 0;
  } catch (error) { console.error(`FAIL ${safeComposeFailureMessage(error)}`); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
