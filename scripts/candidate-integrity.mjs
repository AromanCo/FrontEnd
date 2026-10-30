import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { backendSha } from './backend-pin.mjs';

export const CANDIDATE_MANIFEST = 'release-candidate.json';
export const BUILD_METADATA = 'public-showcase-build.json';
export const CANDIDATE_FORMAT = 1;
export const MUTABLE_NEXT_OUTPUTS = Object.freeze(['server/route-cache']);

const sha256 = value => createHash('sha256').update(value).digest('hex');

function displayPath(root, path) {
  return relative(root, path).split(sep).join('/') || '.';
}

function assertContainedPath(root, path, label) {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} path escapes its authorized root: '${displayPath(root, path)}'.`);
  }
}

function inspectPath(path, root, label, expectedType) {
  let info;
  try { info = lstatSync(path); }
  catch (error) { throw new Error(`Cannot inspect ${label} '${displayPath(root, path)}' (${error.code || 'filesystem error'}).`); }
  if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in ${label}: '${displayPath(root, path)}'.`);
  if (expectedType === 'file' && !info.isFile()) throw new Error(`Expected a regular file for ${label}: '${displayPath(root, path)}'.`);
  if (expectedType === 'directory' && !info.isDirectory()) throw new Error(`Expected a regular directory for ${label}: '${displayPath(root, path)}'.`);
  return info;
}

function assertDirectory(path, root, label) {
  inspectPath(path, root, label, 'directory');
  let actual;
  try { actual = realpathSync(path); }
  catch (error) { throw new Error(`Cannot resolve ${label} '${displayPath(root, path)}' (${error.code || 'filesystem error'}).`); }
  assertContainedPath(root, actual, label);
  return actual;
}

function assertRegularFilePath(path, root, label) {
  assertContainedPath(root, path, label);
  const rel = relative(root, path);
  const components = rel.split(sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < components.length; index += 1) {
    current = join(current, components[index]);
    inspectPath(current, root, label, index === components.length - 1 ? 'file' : 'directory');
  }
  let actual;
  try { actual = realpathSync(path); }
  catch (error) { throw new Error(`Cannot resolve ${label} '${displayPath(root, path)}' (${error.code || 'filesystem error'}).`); }
  assertContainedPath(root, actual, label);
  return lstatSync(path);
}

function readRegularFile(path, root, label) {
  assertRegularFilePath(path, root, label);
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!fstatSync(fd).isFile()) throw new Error(`Expected a regular file for ${label}: '${displayPath(root, path)}'.`);
    return readFileSync(fd);
  } catch (error) {
    if (error instanceof Error && /^(?:Expected a regular file|Symbolic links are not allowed|Cannot inspect)/.test(error.message)) throw error;
    throw new Error(`Cannot safely read ${label} '${displayPath(root, path)}' (${error.code || 'filesystem error'}).`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Filesystem policy: source and build trees must contain only regular files and
 * directories. Reject every symlink, including links that resolve inside the
 * root, so no identity depends on traversal or alias normalization.
 */

export function sourceIdentity(cwd = process.cwd()) {
  const root = realpathSync(cwd);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Unable to identify a full Frontend Git revision.');
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer' })
    .toString('utf8').split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const path = resolve(root, file);
    const info = assertRegularFilePath(path, root, 'Frontend source');
    const mode = info.mode & 0o777;
    hash.update(file).update('\0');
    hash.update(String(mode)).update('\0');
    hash.update(readRegularFile(path, root, 'Frontend source')).update('\0');
  }
  return { revision, treeSha256: hash.digest('hex') };
}

export function candidateConfiguration({ scope, apiBase, cwd = process.cwd(), nodeVersion = process.version } = {}) {
  const root = realpathSync(cwd);
  const packageLock = readRegularFile(resolve(root, 'package-lock.json'), root, 'Frontend package lock');
  const config = {
    format: 1,
    scope,
    apiBase,
    catalogProxyEnabled: apiBase === '/api/v1',
    backendRevision: backendSha,
    nextVersion: JSON.parse(readFileSync(resolve(cwd, 'node_modules/next/package.json'), 'utf8')).version,
    nodeVersion,
    packageLockSha256: sha256(packageLock),
  };
  return { ...config, sha256: sha256(JSON.stringify(config)) };
}

export function artifactIdentity(distDirectory) {
  const root = resolve(distDirectory);
  inspectPath(root, root, 'compiled artifact root', 'directory');
  assertDirectory(root, root, 'compiled artifact root');
  const entries = [];
  const walk = (directory, excludedFromDigest = false) => {
    assertDirectory(directory, root, 'compiled artifact directory');
    let names;
    try { names = readdirSync(directory).sort(); }
    catch (error) { throw new Error(`Cannot list compiled artifact directory '${displayPath(root, directory)}' (${error.code || 'filesystem error'}).`); }
    for (const name of names) {
      const path = join(directory, name);
      const rel = displayPath(root, path);
      const info = inspectPath(path, root, 'compiled artifact entry');
      const runtimeMutable = excludedFromDigest || MUTABLE_NEXT_OUTPUTS.some(prefix => rel === prefix || rel.startsWith(`${prefix}/`));
      if (info.isDirectory()) walk(path, runtimeMutable);
      else if (info.isFile()) {
        if (runtimeMutable || rel === BUILD_METADATA || rel === CANDIDATE_MANIFEST) continue;
        const content = readRegularFile(path, root, 'compiled artifact file');
        entries.push([rel, String(info.mode & 0o777), sha256(content)]);
      } else throw new Error(`Unsupported compiled artifact entry: '${rel}'.`);
    }
  };
  walk(root);
  if (entries.length === 0) throw new Error('Compiled artifact is empty.');
  const digest = createHash('sha256');
  for (const [path, mode, fileHash] of entries) digest.update(path).update('\0').update(mode).update('\0').update(fileHash).update('\0');
  return { sha256: digest.digest('hex'), fileCount: entries.length };
}

function compiledClientContains(distDirectory, value) {
  const artifactRoot = resolve(distDirectory);
  assertDirectory(artifactRoot, artifactRoot, 'compiled artifact root');
  const root = resolve(artifactRoot, 'static');
  assertDirectory(root, artifactRoot, 'compiled browser asset directory');
  const visit = directory => {
    assertDirectory(directory, artifactRoot, 'compiled browser asset directory');
    let names;
    try { names = readdirSync(directory).sort(); }
    catch (error) { throw new Error(`Cannot list compiled browser asset directory '${displayPath(artifactRoot, directory)}' (${error.code || 'filesystem error'}).`); }
    let found = false;
    for (const name of names) {
      const path = join(directory, name);
      const info = inspectPath(path, artifactRoot, 'compiled browser asset');
      if (info.isDirectory()) found = visit(path) || found;
      if (info.isFile() && name.endsWith('.js') && readRegularFile(path, artifactRoot, 'compiled browser JavaScript').toString('utf8').includes(value)) found = true;
      if (!info.isDirectory() && !info.isFile()) throw new Error(`Unsupported compiled browser asset: '${displayPath(artifactRoot, path)}'.`);
    }
    return found;
  };
  return visit(root);
}

export function createCandidateManifest({ cwd = process.cwd(), distDirectory, scope, apiBase }) {
  if (scope !== 'public-showcase') throw new Error('Candidate manifests are only defined for public-showcase builds.');
  const source = sourceIdentity(cwd);
  const config = candidateConfiguration({ scope, apiBase, cwd });
  const artifact = artifactIdentity(distDirectory);
  return {
    format: CANDIDATE_FORMAT,
    complete: true,
    scope,
    source: { revision: source.revision, treeSha256: source.treeSha256 },
    backendRevision: backendSha,
    compiled: { apiBase, configurationSha256: config.sha256, artifactSha256: artifact.sha256, fileCount: artifact.fileCount },
    build: { metadataVersion: 2, nodeVersion: process.version, nextVersion: config.nextVersion, packageLockSha256: config.packageLockSha256 },
  };
}

export function verifyCandidate({ cwd = process.cwd(), distDirectory, env = process.env, manifest: supplied } = {}) {
  const passed = [];
  const failed = [];
  const unverified = ['Production target evidence is unavailable and remains UNVERIFIED.'];
  const fail = message => failed.push(message);
  let manifest = supplied;
  try {
    if (supplied === undefined) {
      const root = resolve(distDirectory);
      manifest = JSON.parse(readRegularFile(resolve(root, CANDIDATE_MANIFEST), root, 'candidate manifest').toString('utf8'));
    }
  } catch (error) { fail(`Candidate manifest is missing, invalid, or unsafe: ${error.message}`); }
  if (!manifest && !failed.some(item => item.includes('manifest'))) fail('Candidate manifest is missing or invalid.');
  if (manifest) {
    if (!manifest || manifest.format !== CANDIDATE_FORMAT || manifest.complete !== true) fail('Candidate manifest is invalid or does not claim a complete candidate.');
    if (manifest.scope !== 'public-showcase' || env.AROMAN_RELEASE_SCOPE !== manifest.scope) fail('Candidate release scope does not match the explicitly requested scope.');
    else passed.push('Release scope matches the explicit request.');
    if (manifest.backendRevision !== backendSha) fail('Candidate Backend revision does not match the authorized Backend pin.');
    else passed.push('Pinned Backend revision matches.');
    try {
      const source = sourceIdentity(cwd);
      if (manifest.source?.revision !== source.revision || manifest.source?.treeSha256 !== source.treeSha256) fail('Candidate Frontend source identity does not match the current source checkout.');
      else passed.push('Frontend source revision and source tree digest match.');
    } catch (error) { fail(`Frontend source identity could not be verified: ${error.message}`); }
    const compiledApiBase = manifest.compiled?.apiBase;
    if (typeof compiledApiBase !== 'string' || compiledApiBase.length === 0 || compiledApiBase !== env.NEXT_PUBLIC_AROMAN_API_BASE_URL) fail('Candidate compiled browser API base does not match the requested configuration.');
    if (typeof compiledApiBase === 'string' && compiledApiBase.length > 0) {
      try {
        if (!compiledClientContains(distDirectory, compiledApiBase)) fail('Compiled browser JavaScript does not contain the declared API base.');
        else passed.push('Compiled browser JavaScript contains the declared API base.');
      } catch (error) { fail(`Compiled browser JavaScript is missing, unsafe, or cannot be inspected: ${error.message}`); }
    }
    try {
      const config = candidateConfiguration({ scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL, cwd });
      if (manifest.compiled?.configurationSha256 !== config.sha256) fail('Candidate non-secret build configuration identity does not match.');
      else passed.push('Non-secret compiled configuration identity matches; runtime-only upstream is not recorded.');
      if (manifest.build?.metadataVersion !== 2 || manifest.build?.nextVersion !== config.nextVersion || manifest.build?.nodeVersion !== process.version || manifest.build?.packageLockSha256 !== config.packageLockSha256) fail('Candidate build metadata or toolchain identity is stale or inconsistent.');
      else passed.push('Build metadata, Node/Next versions and dependency lock identity match.');
    } catch { fail('Candidate build configuration identity could not be verified.'); }
    try {
      const root = resolve(distDirectory);
      const metadata = JSON.parse(readRegularFile(resolve(root, BUILD_METADATA), root, 'compiled public build metadata').toString('utf8'));
      if (metadata.format !== 2 || metadata.scope !== manifest.scope || metadata.apiBase !== manifest.compiled?.apiBase
        || metadata.sourceRevision !== manifest.source?.revision || metadata.backendRevision !== backendSha
        || metadata.configurationSha256 !== manifest.compiled?.configurationSha256) fail('Compiled public build metadata is missing, stale, or inconsistent with the candidate manifest.');
      else passed.push('Compiled public build metadata matches the candidate manifest.');
    } catch (error) { fail(`Compiled public build metadata is missing, invalid, or unsafe: ${error.message}`); }
    try {
      const artifact = artifactIdentity(distDirectory);
      if (manifest.compiled?.artifactSha256 !== artifact.sha256 || manifest.compiled?.fileCount !== artifact.fileCount) fail('Compiled artifact digest or file count differs from the candidate manifest.');
      else passed.push('Compiled artifact file digest and file count match.');
    } catch (error) { fail(`Compiled artifact digest could not be verified: ${error.message}`); }
  }
  return {
    passed,
    failed,
    unverified,
    identity: manifest ? {
      frontendRevision: manifest.source?.revision,
      sourceTreeSha256: manifest.source?.treeSha256,
      backendRevision: manifest.backendRevision,
      artifactSha256: manifest.compiled?.artifactSha256,
    } : null,
  };
}
