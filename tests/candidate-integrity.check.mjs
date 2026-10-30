import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CANDIDATE_MANIFEST, BUILD_METADATA, artifactIdentity, candidateConfiguration, createCandidateManifest, sourceIdentity, verifyCandidate } from '../scripts/candidate-integrity.mjs';
import { backendSha } from '../scripts/backend-pin.mjs';

const cwd = resolve(import.meta.dirname, '..');
const env = { AROMAN_RELEASE_SCOPE: 'public-showcase', NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1', AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1' };

function candidateFixture(callback) {
  const distDirectory = mkdtempSync(join(tmpdir(), 'aroman-candidate-'));
  try {
    mkdirSync(join(distDirectory, 'static'));
    writeFileSync(join(distDirectory, 'static', 'chunk.js'), 'compiled output /api/v1');
    const config = candidateConfiguration({ scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL, upstreamUrl: env.AROMAN_CATALOG_UPSTREAM_URL, cwd });
    writeFileSync(join(distDirectory, BUILD_METADATA), JSON.stringify({
      format: 2, scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL,
      sourceRevision: 'will be filled from source', backendRevision: backendSha, configurationSha256: config.sha256,
    }));
    const manifest = createCandidateManifest({ cwd, distDirectory, ...env, scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL, upstreamUrl: env.AROMAN_CATALOG_UPSTREAM_URL });
    const metadata = JSON.parse(readFileSync(join(distDirectory, BUILD_METADATA), 'utf8'));
    metadata.sourceRevision = manifest.source.revision;
    writeFileSync(join(distDirectory, BUILD_METADATA), JSON.stringify(metadata));
    writeFileSync(join(distDirectory, CANDIDATE_MANIFEST), JSON.stringify(manifest));
    return callback(distDirectory, manifest);
  } finally { rmSync(distDirectory, { recursive: true, force: true }); }
}

test('candidate verifies source tree, Backend pin, scope, configuration, build metadata and artifact digest', () => {
  candidateFixture((distDirectory, manifest) => {
    const result = verifyCandidate({ cwd, distDirectory, env, manifest });
    assert.deepEqual(result.failed, []);
    assert.ok(result.passed.length >= 5);
    assert.match(manifest.compiled.artifactSha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.backendRevision, backendSha);
  });
});

test('candidate rejects wrong Frontend source and Backend pin', () => {
  candidateFixture((distDirectory, manifest) => {
    const wrongSource = structuredClone(manifest);
    wrongSource.source.revision = '0'.repeat(40);
    assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest: wrongSource }).failed.some(item => item.includes('source identity')));
    const wrongBackend = structuredClone(manifest);
    wrongBackend.backendRevision = '1'.repeat(40);
    assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest: wrongBackend }).failed.some(item => item.includes('Backend revision')));
  });
});

test('candidate rejects scope drift, missing or stale metadata, and artifact changes', () => {
  candidateFixture((distDirectory, manifest) => {
    assert.ok(verifyCandidate({ cwd, distDirectory, env: { ...env, AROMAN_RELEASE_SCOPE: 'full' }, manifest }).failed.some(item => item.includes('scope')));
    const metadataPath = join(distDirectory, BUILD_METADATA);
    const original = readFileSync(metadataPath, 'utf8');
    rmSync(metadataPath);
    assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest }).failed.some(item => item.includes('metadata is missing')));
    writeFileSync(metadataPath, original);
    writeFileSync(join(distDirectory, 'static', 'chunk.js'), 'changed output');
    assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest }).failed.some(item => item.includes('artifact digest')));
  });
});

test('candidate detects metadata and manifest drift that contradict compiled browser configuration', () => {
  candidateFixture((distDirectory, manifest) => {
    const alternateEnv = { ...env, NEXT_PUBLIC_AROMAN_API_BASE_URL: 'https://catalog.example.test/api/v1' };
    const config = candidateConfiguration({ scope: alternateEnv.AROMAN_RELEASE_SCOPE, apiBase: alternateEnv.NEXT_PUBLIC_AROMAN_API_BASE_URL, cwd });
    const altered = structuredClone(manifest);
    altered.compiled.apiBase = alternateEnv.NEXT_PUBLIC_AROMAN_API_BASE_URL;
    altered.compiled.configurationSha256 = config.sha256;
    const metadataPath = join(distDirectory, BUILD_METADATA);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    metadata.apiBase = alternateEnv.NEXT_PUBLIC_AROMAN_API_BASE_URL;
    metadata.configurationSha256 = config.sha256;
    writeFileSync(metadataPath, JSON.stringify(metadata));
    assert.ok(verifyCandidate({ cwd, distDirectory, env: alternateEnv, manifest: altered }).failed.some(item => item.includes('does not contain the declared API base')));
  });
});

test('complete claim with malformed or absent required manifest metadata fails closed', () => {
  candidateFixture((distDirectory, manifest) => {
    for (const invalid of [null, { ...manifest, format: 99 }, { ...manifest, complete: false }, { ...manifest, compiled: {} }]) {
      assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest: invalid }).failed.length > 0);
    }
    rmSync(join(distDirectory, CANDIDATE_MANIFEST));
    assert.ok(verifyCandidate({ cwd, distDirectory, env }).failed.some(item => item.includes('manifest')));
  });
});

test('normal regular-file artifacts and their existing candidate metadata remain valid', () => {
  candidateFixture((distDirectory, manifest) => {
    assert.equal(artifactIdentity(distDirectory).sha256, manifest.compiled.artifactSha256);
    assert.deepEqual(verifyCandidate({ cwd, distDirectory, env, manifest }).failed, []);
  });
});

test('external symlinked artifact files are rejected', () => {
  candidateFixture((distDirectory, manifest) => {
    const outside = mkdtempSync(join(tmpdir(), 'aroman-candidate-outside-file-'));
    try {
      const externalFile = join(outside, 'payload.bin');
      writeFileSync(externalFile, 'external artifact payload');
      symlinkSync(externalFile, join(distDirectory, 'outside.bin'));
      assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*outside\.bin/);
      assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest }).failed.some(item => item.includes("Symbolic links are not allowed in compiled artifact entry: 'outside.bin'")));
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
});

test('external symlinked artifact directories are rejected', () => {
  candidateFixture((distDirectory, manifest) => {
    const outside = mkdtempSync(join(tmpdir(), 'aroman-candidate-outside-dir-'));
    try {
      writeFileSync(join(outside, 'payload.bin'), 'external directory payload');
      symlinkSync(outside, join(distDirectory, 'external-dir'));
      assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*external-dir/);
      assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest }).failed.some(item => item.includes('external-dir')));
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
});

test('external client JavaScript cannot satisfy the compiled API-base check through a symlink', () => {
  candidateFixture((distDirectory, manifest) => {
    const outside = mkdtempSync(join(tmpdir(), 'aroman-candidate-external-js-'));
    try {
      writeFileSync(join(distDirectory, 'static', 'chunk.js'), 'regular client without the configured API value');
      const externalClient = join(outside, 'client.js');
      writeFileSync(externalClient, '/* expected API base */ const base="/api/v1";');
      symlinkSync(externalClient, join(distDirectory, 'static', 'zz-external-client.js'));
      const result = verifyCandidate({ cwd, distDirectory, env, manifest });
      assert.ok(result.failed.some(item => item.includes("Symbolic links are not allowed in compiled browser asset: 'static/zz-external-client.js'")));
      assert.ok(!result.passed.some(item => item.includes('Compiled browser JavaScript contains the declared API base')));
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
});

test('source identity rejects an untracked symlink to an external source file', () => {
  const outside = mkdtempSync(join(tmpdir(), 'aroman-source-outside-'));
  const symlinkPath = join(cwd, 'm6-a25-adversarial-source-link.js');
  try {
    const externalSource = join(outside, 'source.js');
    writeFileSync(externalSource, 'outside source content');
    symlinkSync(externalSource, symlinkPath);
    assert.throws(() => sourceIdentity(cwd), /Symbolic links are not allowed in Frontend source: 'm6-a25-adversarial-source-link\.js'/);
  } finally {
    rmSync(symlinkPath, { force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('dangling and circular symlinks fail closed', () => {
  candidateFixture((distDirectory) => {
    const staticDir = join(distDirectory, 'static');
    const dangling = join(staticDir, 'dangling.js');
    symlinkSync(join(staticDir, 'missing.js'), dangling);
    assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*dangling\.js/);
    rmSync(dangling);
    const loopA = join(staticDir, 'loop-a');
    const loopB = join(staticDir, 'loop-b');
    symlinkSync(loopB, loopA);
    symlinkSync(loopA, loopB);
    assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*loop-a/);
  });
});

test('nested internal symlinks are rejected rather than normalized', () => {
  candidateFixture((distDirectory, manifest) => {
    const nested = join(distDirectory, 'static', 'chunks');
    mkdirSync(nested);
    symlinkSync(join(distDirectory, 'static', 'chunk.js'), join(nested, 'internal-alias.js'));
    assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*chunks\/internal-alias\.js/);
    assert.ok(verifyCandidate({ cwd, distDirectory, env, manifest }).failed.some(item => item.includes('chunks/internal-alias.js')));
  });
});

test('Next runtime route-cache files are excluded from the digest but remain link-checked', () => {
  candidateFixture((distDirectory, manifest) => {
    const routeCache = join(distDirectory, 'server', 'route-cache');
    mkdirSync(routeCache, { recursive: true });
    const cachedResponse = join(routeCache, 'route.body');
    writeFileSync(cachedResponse, 'runtime generated cache response');
    assert.equal(artifactIdentity(distDirectory).sha256, manifest.compiled.artifactSha256);
    assert.deepEqual(verifyCandidate({ cwd, distDirectory, env, manifest }).failed, []);

    const outside = mkdtempSync(join(tmpdir(), 'aroman-cache-link-target-'));
    try {
      const target = join(outside, 'cache.body');
      writeFileSync(target, 'external runtime cache content');
      symlinkSync(target, join(routeCache, 'external.body'));
      assert.throws(() => artifactIdentity(distDirectory), /Symbolic links are not allowed.*server\/route-cache\/external\.body/);
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
});
