#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const COMPOSE_FILE = resolve(import.meta.dirname, '../deploy/private-preproduction/compose.yaml');
export const SERVICES = ['showcase', 'catalog-api', 'database', 'migrate'];
export const NETWORKS = ['aroman_catalog', 'aroman_database'];
export const REQUIRED_SECRETS = ['catalog_runtime_database_url', 'catalog_migration_database_url', 'database_bootstrap_password', 'catalog_migration_password', 'catalog_runtime_password', 'otp_pepper', 'session_pepper'];
export const REQUIRED_SECRET_DIRECTORY_MODE = 0o700;
export const REQUIRED_SECRET_FILE_MODE = 0o440;
export const REQUIRED_SECRET_FILE_GID = 10001;
const REPO = resolve(import.meta.dirname, '..');
const ROLE_INIT_FILE = resolve(import.meta.dirname, '../deploy/private-preproduction/database-role-init.sh');
const CATALOG_GRANTS_FILE = resolve(import.meta.dirname, '../deploy/private-preproduction/apply-catalog-read-only-grants.py');
const DATABASE_DOCKERFILE = resolve(import.meta.dirname, '../deploy/private-preproduction/Dockerfile.database');
const SHA_IMAGE = /^[^\s@]+@sha256:[a-f0-9]{64}$/;
const STATIC_PORT_CONFLICTS = new Set([22, 80, 443, 3000, 3001, 3008, 3027, 5432, 8000, 8027, 8123, 8443]);

function error(errors, message) { errors.push(message); }
function memoryBytes(value) {
  if (typeof value === 'number') return value;
  const match = /^(\d+(?:\.\d+)?)(b|k|kb|m|mb|g|gb)?$/i.exec(String(value));
  if (!match) return 0;
  const factor = { b: 1, k: 1024, kb: 1000, m: 1024 ** 2, mb: 1e6, g: 1024 ** 3, gb: 1e9 }[(match[2] || 'b').toLowerCase()];
  return Number(match[1]) * factor;
}

export function validateDatabasePrivilegePolicy(roleScript, grantScript) {
  const errors = [];
  for (const [description, pattern] of [
    ['separate migrator identity', /CREATE ROLE aroman_migrator LOGIN PASSWORD/],
    ['separate runtime identity', /CREATE ROLE aroman_app LOGIN PASSWORD/],
    ['migrator-only database ownership', /ALTER DATABASE aroman OWNER TO aroman_migrator/],
    ['public connection revocation', /REVOKE CONNECT ON DATABASE aroman FROM PUBLIC/],
    ['runtime schema usage', /GRANT USAGE ON SCHEMA public TO aroman_app/],
    ['revoked runtime table defaults', /ALTER DEFAULT PRIVILEGES FOR ROLE aroman_migrator IN SCHEMA public\s+REVOKE ALL ON TABLES FROM aroman_app/],
    ['PostgreSQL secret-reader supplementary group guard', /id -G[\s\S]*grep -qx '10001'/],
  ]) if (!pattern.test(roleScript)) errors.push(`Bootstrap SQL is missing ${description}.`);
  if (/ALTER DEFAULT PRIVILEGES[^;]*GRANT\s+SELECT\s+ON\s+TABLES/i.test(roleScript)) errors.push('Bootstrap SQL must not grant default SELECT on every current/future table.');
  if (/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i.test(roleScript)) errors.push('Bootstrap SQL grants runtime write or broad table privileges.');
  if ((roleScript.match(/\bGRANT\b/g) || []).length !== 3 || /GRANT\s+SELECT\b/i.test(roleScript)) errors.push('Bootstrap SQL may grant only database CONNECT and schema USAGE to the runtime identity.');

  for (const [description, pattern] of [
    ['migrator identity check', /SELECT current_user, current_database\(\)/],
    ['table privilege revocation', /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM aroman_app/],
    ['sequence privilege revocation', /REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM aroman_app/],
    ['catalog-only SELECT grant', /GRANT SELECT ON TABLE/],
  ]) if (!pattern.test(grantScript)) errors.push(`Post-migration grant procedure is missing ${description}.`);
  const tuple = /catalog_tables\s*=\s*\(([\s\S]*?)\)/.exec(grantScript)?.[1];
  const approvedTables = tuple ? [...tuple.matchAll(/"([a-z_]+)"/g)].map(match => match[1]) : [];
  if (approvedTables.join(',') !== 'brands,fragrance_families,fragrance_notes,products,product_variants') errors.push('Post-migration grant procedure must list exactly the five approved catalog tables.');
  if (!/if identity != \("aroman_migrator", "aroman"\)/.test(grantScript)) errors.push('Post-migration grants must require the separate aroman_migrator identity and database.');
  if ((grantScript.match(/\bGRANT\b/g) || []).length !== 1 || /\bGRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i.test(grantScript)) errors.push('Post-migration grant procedure must contain only one catalog table SELECT grant.');
  return errors;
}

export function validateSecretInventory({ directory, entries, files }) {
  const errors = [];
  if (!directory || directory.isSymbolicLink || !directory.isDirectory || directory.uid !== 0 || directory.gid !== 0 || directory.mode !== REQUIRED_SECRET_DIRECTORY_MODE) {
    errors.push('Secret directory must be a non-symlink root:root directory with mode 0700.');
  }
  const expectedNames = [...REQUIRED_SECRETS].sort();
  if (!Array.isArray(entries) || [...entries].sort().join(',') !== expectedNames.join(',')) errors.push('Secret directory must contain exactly the seven required secret files and no unexpected entries.');
  for (const name of REQUIRED_SECRETS) {
    const file = files?.[name];
    if (!file || file.isSymbolicLink || !file.isFile || file.uid !== 0 || file.gid !== REQUIRED_SECRET_FILE_GID || file.mode !== REQUIRED_SECRET_FILE_MODE || !file.contents?.trim()) {
      errors.push(`Secret ${name} must be a non-empty regular root:10001 file with mode 0440.`);
    }
  }
  return errors;
}

function inspectSecretInventory(secrets) {
  const declared = Object.entries(secrets || {});
  const directories = new Set(declared.map(([, secret]) => resolve(secret?.file || '/invalid')).map(file => file.slice(0, file.lastIndexOf(sep))));
  if (directories.size !== 1) return { directory: null, entries: [], files: {}, paths: {} };
  const directoryPath = [...directories][0];
  const expectedPaths = Object.fromEntries(declared.map(([name, secret]) => [name, resolve(secret?.file || '/invalid')]));
  const files = {};
  let directory;
  let entries = [];
  try {
    const info = lstatSync(directoryPath);
    directory = { isSymbolicLink: info.isSymbolicLink(), isDirectory: info.isDirectory(), uid: info.uid, gid: info.gid, mode: info.mode & 0o777 };
    if (realpathSync(directoryPath) !== resolve(directoryPath)) directory.isSymbolicLink = true;
    entries = readdirSync(directoryPath);
  } catch { directory = null; }
  for (const [name, filePath] of Object.entries(expectedPaths)) {
    try {
      const info = lstatSync(filePath);
      files[name] = {
        isSymbolicLink: info.isSymbolicLink(), isFile: info.isFile(), uid: info.uid, gid: info.gid,
        mode: info.mode & 0o777, contents: readFileSync(filePath, 'utf8'),
      };
    } catch { files[name] = null; }
  }
  return { directory, entries, files, paths: expectedPaths };
}

function validateSecretFiles(secrets, repoRoot, suppliedInventory) {
  const errors = [];
  const values = {};
  const inventory = suppliedInventory || inspectSecretInventory(secrets);
  errors.push(...validateSecretInventory(inventory));
  for (const [name, secret] of Object.entries(secrets || {})) {
    const file = resolve(secret?.file || '/invalid');
    const rel = relative(repoRoot, file);
    if (rel === '.' || (rel !== '..' && !rel.startsWith(`..${sep}`))) errors.push(`Secret ${name} file must be outside the repository.`);
    if (file.slice(file.lastIndexOf(sep) + 1) !== name) errors.push(`Secret ${name} must use its named file in the dedicated secret directory.`);
    const contents = inventory.paths && inventory.paths[name] !== file ? '' : inventory.files?.[name]?.contents;
    if (typeof contents !== 'string' || !contents.trim()) errors.push(`Required secret file is missing or unreadable: ${name}.`);
    else values[name] = contents.trim();
  }
  const databaseSecrets = [
    ['catalog_runtime_database_url', 'aroman_app', 'catalog_runtime_password'],
    ['catalog_migration_database_url', 'aroman_migrator', 'catalog_migration_password'],
  ];
  for (const [name, user, passwordName] of databaseSecrets) {
    try {
      const url = new URL(values[name]);
      const password = decodeURIComponent(url.password);
      if (!['postgresql:', 'postgresql+psycopg:'].includes(url.protocol) || url.username !== user || url.hostname !== 'database'
        || (url.port && url.port !== '5432') || url.pathname !== '/aroman' || url.search || url.hash || !password
        || password !== values[passwordName] || password.length < 32) errors.push(`Database secret ${name} must match a strong, role-specific local PostgreSQL credential for ${user}@database/aroman.`);
    } catch {
      errors.push(`Database secret ${name} is missing or is not a valid role-specific PostgreSQL URL.`);
    }
  }
  const bootstrap = values.database_bootstrap_password;
  const runtimePassword = values.catalog_runtime_password;
  const migrationPassword = values.catalog_migration_password;
  const otp = values.otp_pepper;
  const session = values.session_pepper;
  if (Object.values(values).length === REQUIRED_SECRETS.length && new Set(Object.values(values)).size !== REQUIRED_SECRETS.length) errors.push('Each secret and credential file must contain a distinct value.');
  if ([bootstrap, runtimePassword, migrationPassword].some(value => typeof value !== 'string' || value.length < 32)
    || new Set([bootstrap, runtimePassword, migrationPassword]).size !== 3) errors.push('Bootstrap, runtime and migration database passwords must be strong, non-empty and mutually distinct.');
  if (typeof otp !== 'string' || typeof session !== 'string' || otp.length < 32 || session.length < 32 || otp === session) errors.push('Backend-required OTP and session peppers must each contain at least 32 characters and differ.');
  return errors;
}

export function validateEffectiveCompose(config, { secretInventory } = {}) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['Rendered Compose configuration must be an object.'];
  if (Object.keys(config).sort().join(',') !== ['configs', 'name', 'networks', 'secrets', 'services', 'volumes'].sort().join(',')) error(errors, 'Rendered Compose contains unapproved top-level configuration.');
  if (config.name !== 'aroman-private-preproduction') error(errors, 'Compose project identity must be aroman-private-preproduction.');
  const services = config.services;
  if (!services || Object.keys(services).sort().join(',') !== [...SERVICES].sort().join(',')) error(errors, `Service set must be exactly: ${SERVICES.join(', ')}.`);
  const networks = config.networks;
  if (!networks || Object.keys(networks).sort().join(',') !== [...NETWORKS].sort().join(',')) error(errors, `Network set must be exactly: ${NETWORKS.join(', ')}.`);
  for (const [name, network] of Object.entries(networks || {})) {
    if (!NETWORKS.includes(name) || network?.name !== `aroman-private-preproduction_${name}` || network?.external === true || network?.internal !== true || network?.attachable === true || (network?.driver && network.driver !== 'bridge') || JSON.stringify(network?.ipam) !== '{}' || Object.keys(network || {}).sort().join(',') !== ['internal', 'ipam', 'name'].sort().join(',')) error(errors, `Network ${name} must use its unique project name and remain internal, bridge-only and non-attachable.`);
  }
  const volumes = config.volumes || {};
  if (Object.keys(volumes).join(',') !== 'aroman_catalog_data' || volumes.aroman_catalog_data?.external === true || volumes.aroman_catalog_data?.name !== 'aroman-private-preproduction_aroman_catalog_data') error(errors, 'Only the unique project-local aroman_catalog_data volume is permitted.');
  const declaredSecrets = config.secrets || {};
  if (Object.keys(declaredSecrets).sort().join(',') !== [...REQUIRED_SECRETS].sort().join(',')) error(errors, 'Required secret references must be present exactly once with no additions.');
  for (const [name, secret] of Object.entries(declaredSecrets)) if (secret?.name !== `aroman-private-preproduction_${name}` || secret?.external === true) error(errors, `Secret ${name} must use its project-local identity.`);
  const inventory = secretInventory || inspectSecretInventory(declaredSecrets);
  errors.push(...validateSecretFiles(declaredSecrets, REPO, inventory));
  if (Object.keys(config.configs || {}).sort().join(',') !== ['aroman_catalog_grants', 'aroman_role_init'].sort().join(',')
    || resolve(config.configs?.aroman_role_init?.file || '/') !== ROLE_INIT_FILE
    || config.configs?.aroman_role_init?.name !== 'aroman-private-preproduction_aroman_role_init'
    || resolve(config.configs?.aroman_catalog_grants?.file || '/') !== CATALOG_GRANTS_FILE
    || config.configs?.aroman_catalog_grants?.name !== 'aroman-private-preproduction_aroman_catalog_grants') error(errors, 'Only the two uniquely named, reviewed database privilege configuration files are permitted.');
  let roleScript = '';
  let grantsScript = '';
  try { roleScript = readFileSync(ROLE_INIT_FILE, 'utf8'); } catch { error(errors, 'Reviewed database role initialization script is unreadable.'); }
  try { grantsScript = readFileSync(CATALOG_GRANTS_FILE, 'utf8'); } catch { error(errors, 'Reviewed catalog-only grant script is unreadable.'); }
  errors.push(...validateDatabasePrivilegePolicy(roleScript, grantsScript));
  let databaseDockerfile = '';
  try { databaseDockerfile = readFileSync(DATABASE_DOCKERFILE, 'utf8'); } catch { error(errors, 'Reviewed PostgreSQL image build recipe is unreadable.'); }
  if (!/ARG POSTGRES_BASE_IMAGE[\s\S]*FROM \$\{POSTGRES_BASE_IMAGE\}[\s\S]*addgroup -S -g 10001 aroman_secret_readers[\s\\]*&& addgroup postgres aroman_secret_readers/.test(databaseDockerfile)) error(errors, 'PostgreSQL image must be derived from a digest-pinned Alpine base and place postgres in the dedicated secret-reader GID 10001.');
  for (const serviceName of SERVICES) {
    const service = services?.[serviceName];
    if (!service) continue;
    if (!SHA_IMAGE.test(service.image || '')) error(errors, `${serviceName} image must be an immutable sha256 digest reference.`);
    if ('container_name' in service) error(errors, `${serviceName} must not set container_name.`);
    for (const key of ['build', 'env_file', 'extends', 'extra_hosts', 'external_links', 'links', 'volumes_from', 'devices', 'device_cgroup_rules', 'sysctls', 'dns', 'dns_search', 'ipc', 'pid', 'uts', 'cgroup', 'userns_mode', 'runtime']) {
      if (key in service) error(errors, `${serviceName} contains prohibited override field ${key}.`);
    }
    if (service.privileged === true || service.network_mode === 'host') error(errors, `${serviceName} uses a prohibited privilege or network mode.`);
    const expectedCapabilities = serviceName === 'database' ? ['CHOWN', 'DAC_READ_SEARCH', 'SETGID', 'SETUID'] : [];
    if (JSON.stringify([...(service.cap_add || [])].sort()) !== JSON.stringify(expectedCapabilities) || service.cap_drop?.join(',') !== 'ALL' || JSON.stringify(service.security_opt) !== JSON.stringify(['no-new-privileges:true'])) error(errors, `${serviceName} has an unsafe capability or security-option override.`);
    if (service.restart !== (serviceName === 'migrate' ? 'no' : 'on-failure:3')) error(errors, `${serviceName} restart policy is not the approved bounded policy.`);
    if (serviceName !== 'database' && service.user !== '10001:10001') error(errors, `${serviceName} must run as UID/GID 10001:10001.`);
    if ('group_add' in service) error(errors, `${serviceName} must not receive runtime supplementary groups; the database image contains only the reviewed secret-reader group.`);
    if (service.read_only !== true) error(errors, `${serviceName} must use a read-only root filesystem.`);
    if (!service.security_opt?.includes('no-new-privileges:true')) error(errors, `${serviceName} must disable privilege escalation.`);
    if (!service.cap_drop?.includes('ALL')) error(errors, `${serviceName} must drop all Linux capabilities.`);
    if (service.pids_limit > 256 || !Number.isInteger(service.pids_limit) || service.pids_limit <= 0) error(errors, `${serviceName} requires a bounded positive PID limit.`);
    if ((service.ports?.length || 0) > 0 && serviceName !== 'showcase') error(errors, `${serviceName} must not publish a host port.`);
    const expectedTmpfs = {
      showcase: ['/tmp:rw,noexec,nosuid,size=64m,mode=1777', '/app/.next/cache:rw,noexec,nosuid,size=64m,mode=755', '/app/.next/server/route-cache:rw,noexec,nosuid,size=64m,mode=755'],
      'catalog-api': ['/tmp:rw,noexec,nosuid,size=64m,mode=1777'],
      database: ['/tmp:rw,noexec,nosuid,size=64m,mode=1777', '/var/run/postgresql:rw,noexec,nosuid,size=16m,mode=3775'],
      migrate: ['/tmp:rw,noexec,nosuid,size=64m,mode=1777'],
    }[serviceName];
    if ([...(service.tmpfs || [])].sort().join('|') !== [...expectedTmpfs].sort().join('|')) error(errors, `${serviceName} has an unapproved tmpfs mount or cache override.`);
    if (service.volumes?.some(volume => volume.type === 'bind' || volume.source?.startsWith('/'))) error(errors, `${serviceName} contains an unapproved host bind mount.`);
    const limits = service.deploy?.resources?.limits;
    const cpu = Number(limits?.cpus);
    const mem = memoryBytes(limits?.memory);
    if (!Number.isFinite(cpu) || cpu <= 0 || cpu > (serviceName === 'showcase' ? 0.75 : serviceName === 'migrate' ? 0.25 : 0.5)) error(errors, `${serviceName} CPU limit is missing or exceeds the provisional allocation.`);
    if (!mem || mem > (serviceName === 'showcase' ? 768 : serviceName === 'catalog-api' ? 640 : serviceName === 'database' ? 768 : 384) * 1024 ** 2) error(errors, `${serviceName} memory limit is missing or exceeds the provisional allocation.`);
    if (serviceName !== 'migrate' && !service.healthcheck?.test) error(errors, `${serviceName} health check is required.`);
    const refs = service.secrets || [];
    const secretNames = refs.map(item => typeof item === 'string' ? item : item.source);
    for (const item of refs) {
      if (typeof item !== 'string' && item.target !== `/run/secrets/${item.source}`) error(errors, `${serviceName} secret ${item.source} has an unexpected mount target.`);
    }
    if (serviceName === 'catalog-api' && [...secretNames].sort().join(',') !== ['catalog_runtime_database_url', 'otp_pepper', 'session_pepper'].sort().join(',')) error(errors, 'Restricted runtime API must use its runtime database credential and the two Backend-required security peppers only.');
    if (serviceName === 'migrate' && [...secretNames].sort().join(',') !== ['catalog_migration_database_url', 'otp_pepper', 'session_pepper'].sort().join(',')) error(errors, 'Migration service must use its separate migration credential and only the Backend-required security peppers.');
    if (serviceName === 'database' && [...secretNames].sort().join(',') !== ['database_bootstrap_password', 'catalog_migration_password', 'catalog_runtime_password'].sort().join(',')) error(errors, 'Database bootstrap requires isolated admin, migration and runtime password secrets.');
    if (serviceName === 'catalog-api' && service.environment?.DATABASE_URL) error(errors, 'Runtime database credentials must not be placed in environment values.');
    if (serviceName === 'migrate' && service.environment?.DATABASE_URL) error(errors, 'Migration credentials must not be placed in environment values.');
    const expectedNetworks = {
      showcase: ['aroman_catalog'], 'catalog-api': ['aroman_catalog', 'aroman_database'],
      database: ['aroman_database'], migrate: ['aroman_database'],
    }[serviceName];
    if (!service.networks || Object.keys(service.networks).sort().join(',') !== expectedNetworks.sort().join(',') || Object.values(service.networks || {}).some(value => value !== null)) error(errors, `${serviceName} is attached to an unexpected network or alias.`);
  }
  if ((services?.showcase?.ports || []).length !== 1) error(errors, 'Frontend must publish exactly one loopback-only upstream port.');
  if ((services?.showcase?.volumes || []).length) error(errors, 'Frontend must not mount host or shared volumes.');
  if ((services?.['catalog-api']?.volumes || []).length || (services?.migrate?.volumes || []).length) error(errors, 'Backend services must not mount host or shared volumes.');
  const dbVolumes = services?.database?.volumes || [];
  if (dbVolumes.length !== 1 || dbVolumes[0]?.type !== 'volume' || dbVolumes[0]?.source !== 'aroman_catalog_data' || dbVolumes[0]?.target !== '/var/lib/postgresql/data' || dbVolumes[0]?.read_only === true) error(errors, 'Database may use only its project-local writable catalog data volume.');
  if (JSON.stringify(services?.showcase?.depends_on || {}) !== JSON.stringify({ 'catalog-api': { condition: 'service_healthy', required: true } })
    || JSON.stringify(services?.['catalog-api']?.depends_on || {}) !== JSON.stringify({ database: { condition: 'service_healthy', required: true } })
    || JSON.stringify(services?.migrate?.depends_on || {}) !== JSON.stringify({ database: { condition: 'service_healthy', required: true } })) error(errors, 'Service health dependencies must match the isolated Frontend/API/database startup order.');
  for (const port of services?.showcase?.ports || []) {
    if (port.target !== 3000 || port.host_ip !== '127.0.0.1' || port.protocol !== 'tcp' || port.mode !== 'ingress') error(errors, 'Frontend host mapping must be TCP 127.0.0.1:<port>:3000 only.');
    const published = Number(port.published);
    if (!Number.isInteger(published) || published < 1024 || published > 65535) error(errors, 'Frontend published port must be a configured unprivileged port.');
    if (STATIC_PORT_CONFLICTS.has(published)) error(errors, `Frontend host port ${published} conflicts with protected/common service ports.`);
  }
  const frontendEnv = services?.showcase?.environment || {};
  if (services?.showcase?.command !== null || services?.showcase?.entrypoint !== null) error(errors, 'Frontend startup overrides are prohibited; use the reviewed image command.');
  const allowedFrontendEnv = ['AROMAN_RELEASE_SCOPE', 'NEXT_PUBLIC_AROMAN_API_BASE_URL', 'AROMAN_CATALOG_UPSTREAM_URL', 'PORT', 'HOSTNAME'];
  if (Object.keys(frontendEnv).sort().join(',') !== allowedFrontendEnv.sort().join(',')) error(errors, 'Frontend environment contains missing or unapproved overrides.');
  if (frontendEnv.AROMAN_RELEASE_SCOPE !== 'public-showcase' || frontendEnv.NEXT_PUBLIC_AROMAN_API_BASE_URL !== '/api/v1') error(errors, 'Frontend must preserve the public-showcase same-origin API contract.');
  if (frontendEnv.AROMAN_CATALOG_UPSTREAM_URL !== 'http://catalog-api:8000/api/v1') error(errors, 'Server-only catalog upstream must use the private catalog API /api/v1 path.');
  if (frontendEnv.AROMAN_CATALOG_UPSTREAM_URL?.startsWith('NEXT_PUBLIC_')) error(errors, 'Catalog upstream must never be a browser-exposed environment variable.');
  if (frontendEnv.PORT !== '3000' || frontendEnv.HOSTNAME !== '0.0.0.0') error(errors, 'Next server must listen on its isolated container interface and the declared port.');
  const expectedHealthchecks = {
    showcase: { test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], timeout: '5s', interval: '30s', retries: 3, start_period: '30s' },
    'catalog-api': { test: ['CMD', 'python', '-c', "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/brands?limit=1', timeout=3)"], timeout: '5s', interval: '30s', retries: 3, start_period: '20s' },
    database: { test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}"'], timeout: '5s', interval: '15s', retries: 5, start_period: '30s' },
  };
  for (const [serviceName, expected] of Object.entries(expectedHealthchecks)) if (JSON.stringify(services?.[serviceName]?.healthcheck) !== JSON.stringify(expected)) error(errors, `${serviceName} healthcheck is missing, disabled or overridden.`);
  if (services?.migrate?.healthcheck) error(errors, 'One-off migration service must not add a startup healthcheck override.');
  const backend = services?.['catalog-api'];
  if (backend?.entrypoint !== null) error(errors, 'Backend entrypoint overrides are prohibited.');
  const expectedBackendCommand = [
    'sh', '-ec',
    'export DATABASE_URL="$$(cat /run/secrets/catalog_runtime_database_url)"\nexport OTP_PEPPER="$$(cat /run/secrets/otp_pepper)"\nexport SESSION_PEPPER="$$(cat /run/secrets/session_pepper)"\nexec uvicorn aroman.exploration_api:app --host 0.0.0.0 --port 8000 --no-access-log --no-proxy-headers\n',
  ];
  if (JSON.stringify(backend?.command) !== JSON.stringify(expectedBackendCommand)) error(errors, 'Backend startup command must exactly load secret files and run only aroman.exploration_api:app.');
  if (backend?.environment?.ENVIRONMENT !== 'production' || backend?.environment?.COOKIE_SECURE !== 'true') error(errors, 'Restricted Backend must use production settings and secure cookies.');
  if (Object.keys(backend?.environment || {}).sort().join(',') !== ['CORS_ORIGINS', 'COOKIE_SECURE', 'ENVIRONMENT'].sort().join(',')) error(errors, 'Catalog API environment contains missing or unapproved overrides.');
  const cors = String(backend?.environment?.CORS_ORIGINS || '').split(',').map(value => value.trim());
  if (!cors.length || cors.some(value => {
    try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value.includes('*'); }
    catch { return true; }
  })) error(errors, 'Backend CORS must be a required exact HTTPS origin list with no wildcard.');
  if (Object.keys(services?.migrate?.environment || {}).sort().join(',') !== ['CORS_ORIGINS', 'COOKIE_SECURE', 'ENVIRONMENT'].sort().join(',')
    || services?.migrate?.environment?.ENVIRONMENT !== 'production' || services?.migrate?.environment?.COOKIE_SECURE !== 'true') error(errors, 'Migration settings must match secure production Backend configuration with no extra overrides.');
  const migrationCommand = [
    'sh', '-ec',
    'export DATABASE_URL="$$(cat /run/secrets/catalog_migration_database_url)"\nexport OTP_PEPPER="$$(cat /run/secrets/otp_pepper)"\nexport SESSION_PEPPER="$$(cat /run/secrets/session_pepper)"\nalembic upgrade head\nexec python /run/configs/apply-catalog-read-only-grants.py\n',
  ];
  if (JSON.stringify(services?.migrate?.entrypoint) !== JSON.stringify(migrationCommand) || services?.migrate?.command !== null) error(errors, 'Migration command must use only the separate migration URL secret and approved Alembic upgrade operation.');
  const migrationConfigs = services?.migrate?.configs || [];
  if (migrationConfigs.length !== 1 || migrationConfigs[0]?.source !== 'aroman_catalog_grants' || migrationConfigs[0]?.target !== '/run/configs/apply-catalog-read-only-grants.py') error(errors, 'Migration process must mount only the reviewed catalog grant script.');
  if (Object.keys(services?.database?.environment || {}).sort().join(',') !== ['POSTGRES_DB', 'POSTGRES_PASSWORD_FILE', 'POSTGRES_USER'].sort().join(',')) error(errors, 'Database environment contains missing or unapproved overrides.');
  if (services?.database?.environment?.POSTGRES_DB !== 'aroman' || services?.database?.environment?.POSTGRES_USER !== 'aroman_bootstrap') error(errors, 'Database must use the dedicated aroman database and bootstrap identity required by the pinned role setup.');
  if (services?.database?.environment?.POSTGRES_PASSWORD_FILE !== '/run/secrets/database_bootstrap_password') error(errors, 'Database bootstrap password must be read from its mounted secret file.');
  if (services?.database?.command !== null || services?.database?.entrypoint !== null) error(errors, 'Database command and entrypoint overrides are prohibited.');
  if (services?.database?.configs?.length !== 1 || services.database.configs[0]?.source !== 'aroman_role_init' || services.database.configs[0]?.target !== '/docker-entrypoint-initdb.d/10-aroman-role-init.sh') error(errors, 'Database must mount only the reviewed role initialization config at the official init-script path.');
  if (services?.migrate?.profiles?.join(',') !== 'controlled-migration') error(errors, 'Migration service must remain behind the controlled-migration profile.');
  for (const [name, secret] of Object.entries(declaredSecrets)) {
    const source = secret?.file;
    if (typeof source !== 'string' || !source) error(errors, `${name} must reference an external secret file.`);
    else {
      const absolute = resolve(source);
      const rel = relative(REPO, absolute);
      if (!isAbsolute(source) || rel === '.' || (rel !== '..' && !rel.startsWith(`..${sep}`))) error(errors, `${name} secret file must be supplied outside the repository.`);
    }
  }
  const secretFiles = Object.values(declaredSecrets).map(secret => resolve(secret?.file || '/invalid'));
  if (new Set(secretFiles).size !== REQUIRED_SECRETS.length) error(errors, 'Every credential and Backend-required pepper must use a distinct secret file.');
  return [...new Set(errors)];
}

export function renderCompose({ composeFile = COMPOSE_FILE, env = {}, cwd = REPO } = {}) {
  const result = execFileSync('docker', ['compose', '--profile', 'controlled-migration', '-f', composeFile, 'config', '--format', 'json'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env, COMPOSE_PROJECT_NAME: 'aroman-private-preproduction' },
  });
  return JSON.parse(result);
}

export function main(argv = process.argv.slice(2)) {
  const file = argv[0] || COMPOSE_FILE;
  try {
    const config = renderCompose({ composeFile: file });
    const errors = validateEffectiveCompose(config);
    if (errors.length) { errors.forEach(item => console.error(`FAIL ${item}`)); return 1; }
    console.log('PASS effective Compose security policy. This does not approve deployment or validate target state.');
    return 0;
  } catch (cause) {
    console.error(`FAIL unable to inspect effective Compose JSON: ${cause.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
