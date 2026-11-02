#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceIdentity } from './candidate-integrity.mjs';

export const ATTESTATION_SCHEMA_VERSION = 1;
const FULL_SHA = /^[a-f0-9]{40}$/;
const REPOSITORIES = Object.freeze({ 'AromanCo/FrontEnd': 'frontend', 'AromanCo/Backend': 'backend' });
const GIT_ENV = Object.freeze({ PATH: '/usr/bin:/bin', HOME: '/tmp', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' });
function git(args, cwd) { return execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd(); }
function safeRepoIdentity(identifier) {
  if (!Object.hasOwn(REPOSITORIES, identifier)) throw new Error('Unsupported logical repository identifier.');
}
function originMatches(identifier, cwd) {
  const origin = git(['config', '--get', 'remote.origin.url'], cwd);
  let host;
  let path;
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(origin);
  if (scp && !origin.includes('://')) { [, host, path] = scp; }
  else {
    const url = new URL(origin);
    if (url.username || url.password) return false;
    host = url.hostname;
    path = url.pathname;
  }
  return host.toLowerCase() === 'github.com'
    && path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '').toLowerCase() === identifier.toLowerCase();
}
function safeSubmoduleDirectory(root, path) {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).some(part => part === '..' || part === '.' || part === '')) return null;
  const candidate = resolve(root, path);
  const rel = relative(root, candidate);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  let current = root;
  for (const part of rel.split(sep)) {
    current = resolve(current, part);
    const info = lstatSync(current);
    if (info.isSymbolicLink() || !info.isDirectory()) return null;
  }
  if (realpathSync(candidate) !== candidate) return null;
  return candidate;
}
function submoduleState(cwd, depth = 0) {
  if (depth > 32) return { valid: false, failures: ['Submodule nesting exceeds the verification limit.'] };
  const raw = git(['submodule', 'status'], cwd);
  const lines = raw ? raw.split('\n') : [];
  const failures = [];
  for (const line of lines) {
    const match = /^([ +\-U])([a-f0-9]{40})\s+([^\s]+)(?:\s+\(.*\))?$/.exec(line);
    if (!match) { failures.push('Submodule status output is malformed.'); continue; }
    const [, marker, , path] = match;
    if (marker === '-') failures.push('A submodule is uninitialized.');
    if (marker === '+') failures.push('A submodule does not match its recorded revision.');
    if (marker === 'U') failures.push('A submodule has unresolved conflicts.');
    if (marker === ' ') {
      let child;
      try { child = safeSubmoduleDirectory(cwd, path); }
      catch { child = null; }
      if (!child) { failures.push('A submodule path is unsafe or is not an initialized directory.'); continue; }
      const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], child);
      if (status) failures.push('A submodule working tree is not clean.');
      const nested = submoduleState(child, depth + 1);
      failures.push(...nested.failures);
    }
  }
  return { valid: failures.length === 0, failures };
}

export function attestCleanCheckout({ repositoryPath, expectedCommit, repositoryIdentifier }) {
  const logicalRepository = Object.hasOwn(REPOSITORIES, repositoryIdentifier) ? repositoryIdentifier : 'UNKNOWN';
  const result = { schema_version: ATTESTATION_SCHEMA_VERSION, repository: logicalRepository, commit: FULL_SHA.test(expectedCommit) ? expectedCommit : null,
    git_tree_sha: null, source_tree_sha256: null, detached_head: false, tracked_index_clean: false,
    untracked_files_clean: false, submodules_verified: false, observed_at: new Date().toISOString(),
    result: 'FAIL', signed: false, trust_established: false };
  const failures = [];
  try {
    safeRepoIdentity(repositoryIdentifier);
    const cwd = realpathSync(resolve(repositoryPath));
    if (!originMatches(repositoryIdentifier, cwd)) failures.push('Repository origin does not match the logical repository identifier.');
    const head = git(['rev-parse', '--verify', 'HEAD^{commit}'], cwd);
    if (!FULL_SHA.test(expectedCommit) || head !== expectedCommit) failures.push('HEAD does not match the expected full commit SHA.');
    result.commit = head;
    result.git_tree_sha = git(['rev-parse', 'HEAD^{tree}'], cwd);
    const symbolicRef = spawnSync('git', ['-c', 'core.fsmonitor=false', 'symbolic-ref', '-q', 'HEAD'], { cwd, env: GIT_ENV, stdio: 'ignore' });
    result.detached_head = symbolicRef.status === 1 && !symbolicRef.error;
    if (symbolicRef.status !== 0 && symbolicRef.status !== 1) failures.push('Unable to determine whether HEAD is detached.');
    if (!result.detached_head) failures.push('HEAD is attached to a branch.');
    const trackedStatus = git(['status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=none'], cwd);
    const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], cwd);
    result.tracked_index_clean = trackedStatus === '';
    result.untracked_files_clean = !status.split('\0').some(record => record.startsWith('?? '));
    if (!result.tracked_index_clean) failures.push('Index or tracked working tree has changes.');
    if (!result.untracked_files_clean) failures.push('Non-ignored untracked files are present.');
    const submodules = submoduleState(cwd);
    result.submodules_verified = submodules.valid;
    failures.push(...submodules.failures);
    if (repositoryIdentifier === 'AromanCo/FrontEnd' && !/^160000 commit [a-f0-9]{40}\t/m.test(git(['ls-tree', '-r', 'HEAD'], cwd))) {
      const source = sourceIdentity(cwd);
      if (source.revision !== head) failures.push('M6-A25 source identity revision does not match HEAD.');
      result.source_tree_sha256 = source.treeSha256;
    }
  } catch { failures.push('Unable to complete repository inspection; details suppressed.'); }
  result.result = failures.length ? 'FAIL' : 'OBSERVED_CLEAN';
  return { report: result, failures };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--repo' && argv[i + 1]) options.repositoryPath = resolve(argv[++i]);
    else if (argv[i] === '--expected-commit' && argv[i + 1]) options.expectedCommit = argv[++i];
    else if (argv[i] === '--repository-id' && argv[i + 1]) options.repositoryIdentifier = argv[++i];
    else if (argv[i] === '--output' && argv[i + 1]) options.output = resolve(argv[++i]);
    else throw new Error('Usage: node scripts/attest-clean-checkout.mjs --repo <path> --expected-commit <sha> --repository-id AromanCo/FrontEnd|AromanCo/Backend [--output <outside-repository.json>]');
  }
  if (!options.repositoryPath || !options.expectedCommit || !options.repositoryIdentifier) throw new Error('Repository path, expected commit, and logical repository identifier are required.');
  return options;
}
export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const { report, failures } = attestCleanCheckout(options);
    if (options.output) {
      const root = realpathSync(resolve(options.repositoryPath));
      const outputParent = realpathSync(dirname(options.output));
      const actualOutput = resolve(outputParent, basename(options.output));
      const rel = relative(root, actualOutput);
      const outsideRepository = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
      if (!outsideRepository) throw new Error('Report destination must be outside the repository.');
      writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    console.log(JSON.stringify({ ...report, failures }, null, 2));
    return failures.length ? 1 : 0;
  } catch { console.error('FAIL clean-checkout attestation could not be written or completed; local paths and details were suppressed.'); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
