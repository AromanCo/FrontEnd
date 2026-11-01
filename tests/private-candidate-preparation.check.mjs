import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backendSha } from '../scripts/backend-pin.mjs';
import { BUILD_METADATA, candidateConfiguration, createCandidateManifest } from '../scripts/candidate-integrity.mjs';
import { preparePrivateCandidate } from '../scripts/prepare-private-candidate.mjs';

const root = resolve(import.meta.dirname, '..');
const env = { AROMAN_RELEASE_SCOPE: 'public-showcase', NEXT_PUBLIC_AROMAN_API_BASE_URL: '/api/v1', AROMAN_CATALOG_UPSTREAM_URL: 'http://127.0.0.1:8011/api/v1' };

function withCandidate(callback) {
  const dist = mkdtempSync(join(tmpdir(), 'aroman-m6-a27-candidate-'));
  try {
    mkdirSync(join(dist, 'static'));
    writeFileSync(join(dist, 'static', 'client.js'), 'catalog base /api/v1');
    const config = candidateConfiguration({ scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL, cwd: root });
    writeFileSync(join(dist, BUILD_METADATA), JSON.stringify({ format: 2, scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL, sourceRevision: 'pending', backendRevision: backendSha, configurationSha256: config.sha256 }));
    const manifest = createCandidateManifest({ cwd: root, distDirectory: dist, scope: env.AROMAN_RELEASE_SCOPE, apiBase: env.NEXT_PUBLIC_AROMAN_API_BASE_URL });
    const metadataPath = join(dist, BUILD_METADATA);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    metadata.sourceRevision = manifest.source.revision;
    writeFileSync(metadataPath, JSON.stringify(metadata));
    writeFileSync(join(dist, 'release-candidate.json'), JSON.stringify(manifest));
    callback(dist);
  } finally { rmSync(dist, { recursive: true, force: true }); }
}

test('preparation consumes M6-A25 candidate identity but keeps target evidence and public release blocked', () => {
  withCandidate(dist => {
    const result = preparePrivateCandidate({ cwd: root, distDirectory: dist, env });
    assert.deepEqual(result.candidate.failed, []);
    assert.equal(result.record.slots.frontend_source_revision, result.candidate.identity.frontendRevision);
    assert.equal(result.record.slots.frontend_compiled_artifact_sha256, result.candidate.identity.artifactSha256);
    assert.equal(result.record.slots.backend_source_revision, backendSha);
    assert.equal(result.record.public_release_disposition, 'NO-GO');
    assert.equal(result.record.deployable_claim, false);
    assert.ok(Object.values(result.record.target_control_statuses).every(status => status === 'UNVERIFIED'));
    assert.equal(result.validation.validForPreparation, false, 'image, operator, backup, rights and target evidence remain absent');
  });
});

test('tampered candidate cannot populate release record candidate slots', () => {
  withCandidate(dist => {
    writeFileSync(join(dist, 'static', 'client.js'), 'tampered');
    const result = preparePrivateCandidate({ cwd: root, distDirectory: dist, env });
    assert.ok(result.candidate.failed.some(item => item.includes('Compiled artifact')));
    assert.equal(result.record.slots.frontend_source_revision, 'NOT_CAPTURED');
    assert.equal(result.record.public_release_disposition, 'NO-GO');
  });
});
