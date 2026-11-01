import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { assessCapacity } from '../scripts/assess-afra-capacity.mjs';
import { COMPOSE_FILE, REQUIRED_SECRETS, validateSecretInventory, renderCompose, validateDatabasePrivilegePolicy, validateEffectiveCompose } from '../scripts/validate-private-compose.mjs';

const digest = n => String(n).repeat(64);
function localComposeFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'aroman-m6-a27-'));
  const secrets = Object.fromEntries(REQUIRED_SECRETS.map(name => [name, join(root, name)]));
  try {
    const runtimePassword = 'SyntheticRuntimePasswordM6A27_00000000000000001';
    const migrationPassword = 'SyntheticMigrationPasswordM6A27_0000000000000001';
    const values = {
      catalog_runtime_database_url: `postgresql+psycopg://aroman_app:${runtimePassword}@database:5432/aroman`,
      catalog_migration_database_url: `postgresql+psycopg://aroman_migrator:${migrationPassword}@database:5432/aroman`,
      database_bootstrap_password: 'SyntheticBootstrapPasswordM6A27_00000000000000001',
      catalog_runtime_password: runtimePassword,
      catalog_migration_password: migrationPassword,
      otp_pepper: 'SyntheticOtpPepperM6A27_000000000000000001',
      session_pepper: 'SyntheticSessionPepperM6A27_00000000000000001',
    };
    for (const [name, path] of Object.entries(secrets)) writeFileSync(path, `${values[name]}\n`, { mode: 0o600 });
    const config = renderCompose({ composeFile: COMPOSE_FILE, env: {
      AROMAN_FRONTEND_IMAGE: `registry.invalid/aroman/showcase@sha256:${digest('a')}`,
      AROMAN_CATALOG_API_IMAGE: `registry.invalid/aroman/catalog@sha256:${digest('b')}`,
      AROMAN_POSTGRES_IMAGE: `registry.invalid/library/postgres@sha256:${digest('c')}`,
      AROMAN_FRONTEND_HOST_PORT: '18763',
      AROMAN_DB_NAME: 'aroman', AROMAN_BACKEND_CORS_ORIGINS: 'https://showcase.example.invalid',
      AROMAN_RUNTIME_DATABASE_URL_FILE: secrets.catalog_runtime_database_url,
      AROMAN_MIGRATION_DATABASE_URL_FILE: secrets.catalog_migration_database_url,
      AROMAN_DATABASE_BOOTSTRAP_PASSWORD_FILE: secrets.database_bootstrap_password,
      AROMAN_RUNTIME_PASSWORD_FILE: secrets.catalog_runtime_password,
      AROMAN_MIGRATION_PASSWORD_FILE: secrets.catalog_migration_password,
      AROMAN_OTP_PEPPER_FILE: secrets.otp_pepper, AROMAN_SESSION_PEPPER_FILE: secrets.session_pepper,
    } });
    const validate = value => validateEffectiveCompose(value, { secretInventory: syntheticSecretInventory(value, secrets) });
    callback(config, validate);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function syntheticSecretInventory(config, secretPaths) {
  const files = {};
  const paths = {};
  for (const name of REQUIRED_SECRETS) {
    const filePath = config.secrets[name]?.file;
    paths[name] = filePath;
    files[name] = filePath === secretPaths[name] && existsSync(filePath)
      ? { isSymbolicLink: false, isFile: true, uid: 0, gid: 10001, mode: 0o440, contents: readFileSync(filePath, 'utf8') }
      : null;
  }
  return {
    directory: { isSymbolicLink: false, isDirectory: true, uid: 0, gid: 0, mode: 0o700 },
    entries: [...REQUIRED_SECRETS], files, paths,
  };
}

test('effective synthetic Compose configuration passes only the offline structural policy', () => {
  localComposeFixture((config, validate) => {
    assert.deepEqual(validate(config), []);
    assert.equal(config.services.showcase.environment.AROMAN_RELEASE_SCOPE, 'public-showcase');
    assert.equal(config.services.showcase.environment.NEXT_PUBLIC_AROMAN_API_BASE_URL, '/api/v1');
    assert.equal(config.services.showcase.environment.AROMAN_CATALOG_UPSTREAM_URL, 'http://catalog-api:8000/api/v1');
    assert.deepEqual(config.services.showcase.ports.map(port => port.host_ip), ['127.0.0.1']);
    assert.deepEqual(config.services.database.cap_drop, ['ALL']);
    assert.deepEqual(config.services.database.cap_add, ['CHOWN', 'DAC_READ_SEARCH', 'SETGID', 'SETUID']);
  });
});

test('PostgreSQL capability policy keeps cap_drop ALL and adds only the entrypoint minimum', () => {
  localComposeFixture((config, validate) => {
    const missing = [['CHOWN'], ['DAC_READ_SEARCH'], ['SETGID'], ['SETUID']];
    for (const capability of missing) {
      const unsafe = structuredClone(config);
      unsafe.services.database.cap_add = unsafe.services.database.cap_add.filter(value => value !== capability[0]);
      assert.notDeepEqual(validate(unsafe), [], `missing ${capability[0]} was accepted`);
    }
    for (const extra of ['FOWNER', 'DAC_OVERRIDE', 'SYS_ADMIN']) {
      const unsafe = structuredClone(config);
      unsafe.services.database.cap_add.push(extra);
      assert.notDeepEqual(validate(unsafe), [], `extra ${extra} was accepted`);
    }
    const unsafe = structuredClone(config);
    unsafe.services.database.cap_drop = [];
    assert.notDeepEqual(validate(unsafe), [], 'cap_drop ALL removal was accepted');
  });
});

test('malicious effective-configuration fixtures are rejected', () => {
  localComposeFixture((config, validate) => {
    const fixtures = [
      ['extra service', copy => { copy.services.shell = structuredClone(copy.services.database); }],
      ['extra top-level config', copy => { copy.include = ['./override.yaml']; }],
      ['external network', copy => { copy.networks.aroman_database.external = true; }],
      ['project volume collision', copy => { copy.volumes.aroman_catalog_data.name = 'aroman'; }],
      ['project network collision', copy => { copy.networks.aroman_database.name = 'default'; }],
      ['external secret name collision', copy => { copy.secrets.catalog_runtime_database_url.name = 'production-db-secret'; }],
      ['external host alias', copy => { copy.services.showcase.extra_hosts = ['catalog:192.0.2.1']; }],
      ['env-file override', copy => { copy.services.showcase.env_file = ['.env.production']; }],
      ['published Backend', copy => { copy.services['catalog-api'].ports = [{ target: 8000, published: '18000', host_ip: '127.0.0.1', protocol: 'tcp' }]; }],
      ['published database', copy => { copy.services.database.ports = [{ target: 5432, published: '15432', host_ip: '127.0.0.1', protocol: 'tcp' }]; }],
      ['public Frontend mapping', copy => { copy.services.showcase.ports[0].host_ip = '0.0.0.0'; }],
      ['IPv6 public mapping', copy => { copy.services.showcase.ports[0].host_ip = '::'; }],
      ['host network', copy => { copy.services.database.network_mode = 'host'; }],
      ['privileged container', copy => { copy.services['catalog-api'].privileged = true; }],
      ['capability re-addition', copy => { copy.services['catalog-api'].cap_add = ['NET_ADMIN']; }],
      ['security profile override', copy => { copy.services.database.security_opt.push('seccomp=unconfined'); }],
      ['Docker socket bind', copy => { copy.services.showcase.volumes = [{ type: 'bind', source: '/var/run/docker.sock', target: '/var/run/docker.sock' }]; }],
      ['unexpected bind mount', copy => { copy.services.database.volumes.push({ type: 'bind', source: '/srv/data', target: '/backup' }); }],
      ['missing resource limit', copy => { delete copy.services.database.deploy.resources.limits.memory; }],
      ['excess resource limit', copy => { copy.services.showcase.deploy.resources.limits.cpus = '4'; }],
      ['wrong service identity', copy => { copy.services['catalog-api'].user = '0:0'; }],
      ['runtime migration credential', copy => { copy.services['catalog-api'].secrets = ['catalog_migration_database_url']; }],
      ['secret target substitution', copy => { copy.services['catalog-api'].secrets[0].target = '/tmp/other'; }],
      ['missing secret', copy => { delete copy.secrets.catalog_runtime_database_url; }],
      ['secret stored in repository', copy => { copy.secrets.otp_pepper.file = '/home/mrq/Dev/Aroman/FrontEnd-M6-A27/.env'; }],
      ['mutable image', copy => { copy.services.showcase.image = 'registry.invalid/aroman/showcase:latest'; }],
      ['missing digest pin', copy => { copy.services.database.image = 'postgres:17'; }],
      ['unsafe host port collision', copy => { copy.services.showcase.ports[0].published = '5432'; }],
      ['unsafe network override', copy => { copy.services.showcase.networks.default = {}; }],
      ['wrong upstream path', copy => { copy.services.showcase.environment.AROMAN_CATALOG_UPSTREAM_URL = 'http://catalog-api:8000/'; }],
      ['browser upstream leak', copy => { copy.services.showcase.environment.NEXT_PUBLIC_AROMAN_CATALOG_UPSTREAM_URL = 'http://catalog-api:8000/api/v1'; }],
      ['Backend command injection', copy => { copy.services['catalog-api'].command[2] += ' ; uvicorn aroman.main:app'; }],
      ['Frontend startup override', copy => { copy.services.showcase.command = ['sh', '-c', 'sleep infinity']; }],
      ['unapproved migration command', copy => { copy.services.migrate.command = ['downgrade', 'base']; }],
      ['unsafe CORS wildcard', copy => { copy.services['catalog-api'].environment.CORS_ORIGINS = '*'; }],
      ['missing Frontend mapping', copy => { copy.services.showcase.ports = []; }],
      ['wrong bootstrap secret path', copy => { copy.services.database.environment.POSTGRES_PASSWORD_FILE = '/run/secrets/catalog_runtime_password'; }],
      ['replacement role bootstrap', copy => { copy.configs.aroman_role_init.file = '/tmp/database-role-init.sh'; }],
      ['unbounded restart', copy => { copy.services.database.restart = 'always'; }],
    ];
    for (const [name, mutate] of fixtures) {
      const unsafe = structuredClone(config);
      mutate(unsafe);
      assert.notDeepEqual(validate(unsafe), [], `fixture ${name} was accepted`);
    }
  });
});

test('checked-in malicious Compose override fixtures are all rejected', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/m6-a27-malicious-compose-overrides.json', import.meta.url), 'utf8'));
  localComposeFixture((config, validate) => {
    for (const fixture of fixtures) {
      const unsafe = structuredClone(config);
      let parent = unsafe;
      for (const component of fixture.path.slice(0, -1)) parent = parent[Array.isArray(parent) ? Number(component) : component];
      const leaf = fixture.path.at(-1);
      if (fixture.delete) delete parent[Array.isArray(parent) ? Number(leaf) : leaf];
      else parent[Array.isArray(parent) ? Number(leaf) : leaf] = structuredClone(fixture.value);
      assert.notDeepEqual(validate(unsafe), [], `fixture ${fixture.name} was accepted`);
    }
  });
});

test('database role SQL is fail-closed and grants SELECT on five named catalog tables only', () => {
  const roleSql = readFileSync(new URL('../deploy/private-preproduction/database-role-init.sh', import.meta.url), 'utf8');
  const grantsSql = readFileSync(new URL('../deploy/private-preproduction/apply-catalog-read-only-grants.py', import.meta.url), 'utf8');
  assert.deepEqual(validateDatabasePrivilegePolicy(roleSql, grantsSql), []);
  assert.notDeepEqual(validateDatabasePrivilegePolicy(roleSql, grantsSql.replace('    "product_variants",\n', '    "product_variants",\n    "users",\n')), []);
  assert.notDeepEqual(validateDatabasePrivilegePolicy(roleSql, grantsSql.replace('GRANT SELECT ON TABLE', 'GRANT SELECT ON ALL TABLES')), []);
  assert.notDeepEqual(validateDatabasePrivilegePolicy(roleSql, grantsSql.replace('REVOKE ALL ON ALL SEQUENCES', 'GRANT UPDATE ON TABLE public.users TO aroman_app\nREVOKE ALL ON ALL SEQUENCES')), []);
  assert.notDeepEqual(validateDatabasePrivilegePolicy(roleSql.replace('REVOKE ALL ON TABLES FROM aroman_app', 'GRANT SELECT ON TABLES TO aroman_app'), grantsSql), []);
  assert.notDeepEqual(validateDatabasePrivilegePolicy(roleSql.replace('GRANT CONNECT ON DATABASE aroman TO aroman_app;', 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO aroman_app;\nGRANT CONNECT ON DATABASE aroman TO aroman_app;'), grantsSql), []);
});

test('required secret files fail closed on absence, URL mismatch and weak peppers', () => {
  localComposeFixture((config, validate) => {
    const good = validate(config);
    assert.deepEqual(good, []);
    const secretPath = name => config.secrets[name].file;
    const missing = structuredClone(config);
    missing.secrets.catalog_runtime_database_url.file = `${secretPath('catalog_runtime_database_url')}.missing`;
    assert.notDeepEqual(validate(missing), []);
    const originalPassword = readFileSync(secretPath('catalog_runtime_password'), 'utf8');
    writeFileSync(secretPath('catalog_runtime_password'), 'different synthetic password value with sufficient length\n', { mode: 0o600 });
    assert.ok(validate(config).some(item => item.includes('must match')));
    writeFileSync(secretPath('catalog_runtime_password'), originalPassword, { mode: 0o600 });
    assert.deepEqual(validate(config), []);
    writeFileSync(secretPath('session_pepper'), 'short\n', { mode: 0o600 });
    assert.ok(validate(config).some(item => item.includes('peppers')));
    writeFileSync(secretPath('session_pepper'), readFileSync(secretPath('otp_pepper'), 'utf8'), { mode: 0o600 });
    assert.ok(validate(config).some(item => item.includes('distinct value')));
  });
});

test('secret owner, group, mode, directory permissions, symlinks and unreadable files fail closed', () => {
  const valid = {
    directory: { isSymbolicLink: false, isDirectory: true, uid: 0, gid: 0, mode: 0o700 },
    entries: [...REQUIRED_SECRETS],
    files: Object.fromEntries(REQUIRED_SECRETS.map(name => [name, { isSymbolicLink: false, isFile: true, uid: 0, gid: 10001, mode: 0o440, contents: 'synthetic-secret' }])),
  };
  assert.deepEqual(validateSecretInventory(valid), []);
  const cases = [
    ['directory owner', inventory => { inventory.directory.uid = 1000; }],
    ['directory group', inventory => { inventory.directory.gid = 10001; }],
    ['directory mode', inventory => { inventory.directory.mode = 0o750; }],
    ['directory symlink', inventory => { inventory.directory.isSymbolicLink = true; }],
    ['unexpected directory entry', inventory => { inventory.entries.push('extra'); }],
    ['file owner', inventory => { inventory.files.otp_pepper.uid = 1000; }],
    ['file group', inventory => { inventory.files.otp_pepper.gid = 0; }],
    ['file mode', inventory => { inventory.files.otp_pepper.mode = 0o400; }],
    ['file symlink', inventory => { inventory.files.otp_pepper.isSymbolicLink = true; }],
    ['unreadable file', inventory => { inventory.files.otp_pepper.contents = ''; }],
  ];
  for (const [name, mutate] of cases) {
    const unsafe = structuredClone(valid);
    mutate(unsafe);
    assert.notDeepEqual(validateSecretInventory(unsafe), [], `${name} was accepted`);
  }
});

const baseAssessment = () => ({
  format: 1, source_kind: 'synthetic-fixture', hardware: {
    cpu_count: 4, memory_total_gib: 7.7, memory_available_gib: 5.4, swap_gib: 2,
    root_disk_total_gib: 37, root_disk_free_gib: 12, root_inode_used_percent: 19,
  },
  host_context: { existing_container_count: 16, nginx_active: true, ufw_active: true },
  docker_usage_gib: { images: 5, volumes: 4, build_cache: 1 },
  existing_workloads: [{ name: 'protected', cpu_limits: false, memory_limits: false }],
  existing_published_ports: [{ service: 'existing', port: 8123 }, { service: 'database', port: 5432 }],
  proposed_aroman: { frontend_memory_gib: 0.75, backend_memory_gib: 0.625, database_memory_gib: 0.75, frontend_cpu: 0.75, backend_cpu: 0.5, database_cpu: 0.5, migration_memory_gib: 0.375, migration_cpu: 0.25, host_port: 5432 },
  storage_estimates_gib: { release_image: 3, build_growth: 2, database_growth: 2, logs: 1, backup: 8, rollback_artifact: 3 },
  planned_root_disk_target_gib: 80, network_firewall_uncertainty: true, nginx_routing_checked: false,
});

test('unsafe capacity assumptions fail closed on disk headroom and port conflicts', () => {
  const report = assessCapacity(baseAssessment());
  assert.equal(report.disposition, 'BLOCKED');
  assert.equal(report.planning_only_root_disk_target_gib, 80);
  assert.equal(report.checks.find(item => item.id === 'disk_headroom').status, 'BLOCKED');
  assert.equal(report.checks.find(item => item.id === 'port_conflict').status, 'BLOCKED');
  assert.equal(report.target_acceptance, false);
});

test('unknown Docker and recovery storage measurements stay UNVERIFIED, not zero', () => {
  const input = baseAssessment();
  input.docker_usage_gib.build_cache = null;
  input.storage_estimates_gib.backup = null;
  const report = assessCapacity(input);
  assert.equal(report.checks.find(item => item.id === 'disk_headroom').status, 'UNVERIFIED');
  assert.equal(report.storage_projection_gib.free_after, null);
  assert.equal(report.checks.find(item => item.id === 'backup_recovery_storage').status, 'UNVERIFIED');
});

test('historical snapshot labels cannot be promoted to production acceptance', () => {
  const input = baseAssessment();
  input.source_kind = 'historical-owner-snapshot';
  const report = assessCapacity(input);
  assert.equal(report.target_acceptance, false);
  assert.equal(report.deployable, false);
  assert.equal(report.source_kind, 'historical-owner-snapshot');
  assert.ok(report.checks.every(item => item.status !== 'PASS'));
});
