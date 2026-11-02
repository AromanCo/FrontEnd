import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { attestCleanCheckout } from '../scripts/attest-clean-checkout.mjs';
import { sourceIdentity } from '../scripts/candidate-integrity.mjs';

const run = (args, cwd, options = {}) => execFileSync('git', args, { cwd, stdio: 'ignore', ...options });
function repoFixture() {
  const temp = mkdtempSync(join(tmpdir(), 'clean-attestation-'));
  const repo = join(temp, 'repo'); mkdirSync(repo);
  run(['init', '-q'], repo); run(['config', 'user.email', 'fixture@example.invalid'], repo); run(['config', 'user.name', 'Fixture'], repo);
  run(['remote', 'add', 'origin', 'https://github.com/AromanCo/FrontEnd.git'], repo);
  writeFileSync(join(repo, 'tracked.txt'), 'fixture\n'); run(['add', 'tracked.txt'], repo); run(['commit', '-qm', 'fixture'], repo);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  run(['checkout', '--detach', '-q', sha], repo);
  return { temp, repo, sha, close: () => rmSync(temp, { recursive: true, force: true }) };
}
const attest = f => attestCleanCheckout({ repositoryPath: f.repo, expectedCommit: f.sha, repositoryIdentifier: 'AromanCo/FrontEnd' });

test('clean detached checkout passes with Git tree and M6-A25 source identity', t => {
  const f = repoFixture(); t.after(f.close); const value = attest(f);
  assert.equal(value.report.result, 'OBSERVED_CLEAN'); assert.match(value.report.git_tree_sha, /^[a-f0-9]{40}$/);
  assert.equal(value.report.git_tree_sha, execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: f.repo, encoding: 'utf8' }).trim());
  assert.match(value.report.source_tree_sha256, /^[a-f0-9]{64}$/); assert.equal(value.report.signed, false);
  assert.equal(value.report.trust_established, false);
});
test('wrong expected revision fails', t => { const f = repoFixture(); t.after(f.close); assert.equal(attestCleanCheckout({ repositoryPath: f.repo, expectedCommit: 'f'.repeat(40), repositoryIdentifier: 'AromanCo/FrontEnd' }).report.result, 'FAIL'); });
test('modified, staged, deleted and untracked files fail', t => {
  const f = repoFixture(); t.after(f.close);
  writeFileSync(join(f.repo, 'tracked.txt'), 'changed'); assert.equal(attest(f).report.result, 'FAIL');
  run(['checkout', '--', 'tracked.txt'], f.repo); writeFileSync(join(f.repo, 'new.txt'), 'new'); run(['add', 'new.txt'], f.repo); assert.equal(attest(f).report.result, 'FAIL');
  run(['reset', '--hard', '-q', f.sha], f.repo); run(['rm', 'tracked.txt'], f.repo); assert.equal(attest(f).report.result, 'FAIL');
  run(['reset', '--hard', '-q', f.sha], f.repo); writeFileSync(join(f.repo, 'loose.txt'), 'new'); assert.equal(attest(f).report.result, 'FAIL');
});
test('branch-attached checkout fails', t => { const f = repoFixture(); t.after(f.close); run(['checkout', '-q', '-b', 'attached'], f.repo); assert.equal(attest(f).report.result, 'FAIL'); });
test('report fields cannot include paths or secrets', t => {
  const f = repoFixture(); t.after(f.close); const { report } = attest(f);
  const text = JSON.stringify(report); assert.equal(text.includes(f.temp), false); assert.equal(text.includes('SYNTHETIC_SECRET'), false);
  const malformed = attestCleanCheckout({ repositoryPath: f.repo, expectedCommit: f.temp, repositoryIdentifier: f.temp });
  assert.equal(JSON.stringify(malformed).includes(f.temp), false);
});
test('logical repository identity is checked against exact GitHub host and repository path', t => {
  const f = repoFixture(); t.after(f.close);
  assert.equal(attestCleanCheckout({ repositoryPath: f.repo, expectedCommit: f.sha, repositoryIdentifier: 'AromanCo/Backend' }).report.result, 'FAIL');
  run(['remote', 'set-url', 'origin', 'https://evil.invalid/AromanCo/FrontEnd.git'], f.repo);
  assert.equal(attest(f).report.result, 'FAIL');
});
test('ignored build outputs do not change source identity and are not reported as build reproducibility', t => {
  const f = repoFixture(); t.after(f.close);
  writeFileSync(join(f.repo, '.gitignore'), 'build-output/\n'); run(['add', '.gitignore'], f.repo); run(['commit', '-qm', 'ignore build output'], f.repo);
  f.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim(); run(['checkout', '--detach', '-q', f.sha], f.repo);
  const before = sourceIdentity(f.repo).treeSha256;
  mkdirSync(join(f.repo, 'build-output')); writeFileSync(join(f.repo, 'build-output', 'generated'), 'ignored');
  const value = attest(f).report;
  assert.equal(value.result, 'OBSERVED_CLEAN'); assert.equal(value.source_tree_sha256, before);
  assert.equal(Object.hasOwn(value, 'build_environment_clean'), false);
});
test('Git environment overrides cannot redirect repository or source-tree checks', t => {
  const f = repoFixture(); t.after(f.close);
  const previous = process.env.GIT_DIR;
  try { process.env.GIT_DIR = f.temp; assert.equal(attest(f).report.result, 'OBSERVED_CLEAN'); }
  finally { if (previous === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = previous; }
});
test('CLI report output must stay outside the repository and does not dirty the checkout', t => {
  const f = repoFixture(); t.after(f.close);
  const script = new URL('../scripts/attest-clean-checkout.mjs', import.meta.url).pathname;
  const args = [script, '--repo', f.repo, '--expected-commit', f.sha, '--repository-id', 'AromanCo/FrontEnd'];
  const inside = join(f.repo, 'attestation.json');
  const denied = spawnSync(process.execPath, [...args, '--output', inside], { encoding: 'utf8' });
  assert.equal(denied.status, 1); assert.equal(existsSync(inside), false);
  const outside = join(f.temp, 'attestation.json');
  const accepted = spawnSync(process.execPath, [...args, '--output', outside], { encoding: 'utf8' });
  assert.equal(accepted.status, 0); assert.equal(JSON.parse(readFileSync(outside, 'utf8')).result, 'OBSERVED_CLEAN');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: f.repo, encoding: 'utf8' }), '');
});
test('unresolved merge conflicts fail while HEAD remains detached', t => {
  const f = repoFixture(); t.after(f.close);
  run(['checkout', '-q', '-b', 'left'], f.repo); writeFileSync(join(f.repo, 'tracked.txt'), 'left'); run(['commit', '-qam', 'left'], f.repo);
  const left = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim();
  run(['checkout', '--detach', '-q', f.sha], f.repo); writeFileSync(join(f.repo, 'tracked.txt'), 'right'); run(['commit', '-qam', 'right'], f.repo);
  f.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim();
  const merge = spawnSync('git', ['merge', left], { cwd: f.repo, stdio: 'ignore' });
  assert.equal(merge.status, 1); assert.equal(attest(f).report.detached_head, true); assert.equal(attest(f).report.result, 'FAIL');
});
test('uninitialized submodule fails', t => {
  const f = repoFixture(); t.after(f.close);
  const child = join(f.temp, 'child'); mkdirSync(child); run(['init', '-q'], child); run(['config', 'user.email', 'fixture@example.invalid'], child); run(['config', 'user.name', 'Fixture'], child);
  writeFileSync(join(child, 'child.txt'), 'x'); run(['add', '.'], child); run(['commit', '-qm', 'child'], child);
  run(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'sub'], f.repo); run(['commit', '-qam', 'add submodule'], f.repo);
  f.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim(); run(['submodule', 'deinit', '-f', 'sub'], f.repo);
  assert.equal(attest(f).report.result, 'FAIL');
});
test('submodule revision drift and modified submodule worktree fail', t => {
  const f = repoFixture(); t.after(f.close);
  const child = join(f.temp, 'child'); mkdirSync(child); run(['init', '-q'], child); run(['config', 'user.email', 'fixture@example.invalid'], child); run(['config', 'user.name', 'Fixture'], child);
  writeFileSync(join(child, 'child.txt'), 'first'); run(['add', '.'], child); run(['commit', '-qm', 'first'], child);
  const oldSubmoduleSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: child, encoding: 'utf8' }).trim();
  run(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'sub'], f.repo); run(['commit', '-qam', 'add submodule'], f.repo);
  f.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim();
  writeFileSync(join(child, 'child.txt'), 'second'); run(['add', '.'], child); run(['commit', '-qm', 'second'], child);
  run(['fetch', '-q', child], join(f.repo, 'sub')); run(['checkout', '-q', 'FETCH_HEAD'], join(f.repo, 'sub'));
  assert.equal(attest(f).report.result, 'FAIL');
  run(['checkout', '-q', oldSubmoduleSha], join(f.repo, 'sub'));
  writeFileSync(join(f.repo, 'sub', 'child.txt'), 'dirty'); assert.equal(attest(f).report.result, 'FAIL');
});
test('initialized submodule at its recorded revision can pass while source identity is unavailable', t => {
  const f = repoFixture(); t.after(f.close);
  const child = join(f.temp, 'child'); mkdirSync(child); run(['init', '-q'], child); run(['config', 'user.email', 'fixture@example.invalid'], child); run(['config', 'user.name', 'Fixture'], child);
  writeFileSync(join(child, 'child.txt'), 'clean'); run(['add', '.'], child); run(['commit', '-qm', 'child'], child);
  run(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'sub'], f.repo); run(['commit', '-qam', 'add submodule'], f.repo);
  f.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.repo, encoding: 'utf8' }).trim();
  const result = attest(f);
  assert.equal(result.report.result, 'OBSERVED_CLEAN', JSON.stringify(result.failures)); assert.equal(result.report.submodules_verified, true);
  assert.equal(result.report.source_tree_sha256, null);
});
