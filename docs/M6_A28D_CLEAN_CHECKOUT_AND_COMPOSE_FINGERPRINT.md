# M6-A28D — Clean Checkout and Compose Fingerprint

M6-A28D adds two offline observations to the M6-A28C artifact-integrity workflow. Neither is signed provenance, source authorization, target-state evidence, or deployment approval. No production image or deployment is validated by this work.

## Clean-checkout observation

`scripts/attest-clean-checkout.mjs` accepts a repository path, expected full commit SHA, and logical repository ID (`AromanCo/FrontEnd` or `AromanCo/Backend`). It checks the configured `origin` identity, exact HEAD, detached HEAD, porcelain index/worktree state, non-ignored untracked files, and recursive submodule initialization, recorded revisions, and cleanliness. It records the Git tree object ID separately from the Frontend source-tree SHA-256. Frontend source hashing calls the existing M6-A25 `sourceIdentity()` implementation.

Reports contain logical identifiers only. When `--output` is used, the destination must be outside the repository; reports are created exclusively and do not dirty the checkout. Ignored outputs such as `node_modules` are excluded by Git status and are not evidence of a clean build environment. A clean checkout does not prove authorization. The report is unsigned and is not trusted provenance.

Example:

```sh
node scripts/attest-clean-checkout.mjs \
  --repo /checkout/frontend \
  --expected-commit 0123456789abcdef0123456789abcdef01234567 \
  --repository-id AromanCo/FrontEnd \
  --output /tmp/frontend-attestation.json
```

Backend can be observed with the same CLI and `AromanCo/Backend`; the utility writes no Backend files. The report remains a local observation, even when every check passes.

## Compose fingerprint

`scripts/fingerprint-private-compose.mjs` renders only `docker compose config --format json`, once for the unprofiled runtime service selection (`default`) and once with the source-defined `controlled-migration` profile. The selected profile is part of the fingerprint envelope even if service output were otherwise equal. It accepts no caller-supplied environment overrides. It starts with an explicit synthetic interpolation map, empty environment file, isolated temporary Docker CLI config, and a minimal process environment. It does not read `.env`, actual secret files, Docker contexts, daemon state, or registries. It does not build or start images.

The existing `validateEffectiveCompose()` policy validates the rendered service configuration. Its existing secret-inventory injection boundary receives synthetic metadata so the normal security checks run without reading secret contents. If rendering needs a secret-file path, it points under the temporary directory; no report contains that path. The validator still performs its ordinary secret-file inspection when invoked through its normal production validation path.

Each report includes canonical rendered configuration with host paths represented as `repo://...` or `secret://<logical-id>`, SHA-256 identities for Compose, all three service Dockerfiles and `.dockerignore` files, role initialization and catalog grants scripts, and the Compose security validator. It records runtime image, port, origin, network, volume, environment-reference and logical secret-reference values. Secret values and contents are never fingerprint inputs.

The report includes a Docker Compose CLI version supplied as `--compose-version`. Capture it from the approved toolchain inventory; this implementation deliberately does not invoke a version, context, or daemon command. Example:

```sh
node scripts/fingerprint-private-compose.mjs \
  --profile default \
  --compose-version 'Docker Compose version vX.Y.Z'
```

## Fingerprint envelope and canonicalization

The SHA-256 payload is the following object (observation timestamp is intentionally outside it):

```json
{
  "format": 1,
  "profile": "default or controlled-migration",
  "canonicalization_algorithm": "aroman-canonical-json-v1",
  "docker_compose_version": "Docker Compose version vX.Y.Z",
  "compose_source": { "path": "...", "sha256": "..." },
  "inputs": [{ "path": "...", "sha256": "..." }],
  "rendered_compose": {}
}
```

Canonical JSON recursively sorts object keys by JavaScript UTF-16 code-unit order, preserves array order, serializes with `JSON.stringify`, encodes UTF-8, then hashes with SHA-256. This project-specific algorithm is not RFC 8785. M6-A28C manifest hashing imports the same helper; compatibility is covered by its regression tests.

## Manifest and evidence states

The M6-A28C manifest schema now has optional-by-state (but required-by-shape) report references for Frontend and Backend checkout observations, profile-specific runtime and migration fingerprints, Compose source identity, and canonicalization algorithm. The example remains a planning template with all real reports and fingerprint values `NOT_CAPTURED`. A generated synthetic fingerprint is labeled `synthetic`; structural validation warns that synthetic evidence is not release evidence.

The vocabulary distinguishes `NOT_CAPTURED`, `OBSERVED_CLEAN`, and `STRUCTURALLY_VALID`. `TRUST_ESTABLISHED` is expressly rejected and cannot be produced here. Production disposition remains NO-GO, deployment remains false, production acceptance remains false, and all 13 production target controls remain UNVERIFIED.

## Security and limits

- A clean checkout does not prove source authorization.
- A Compose fingerprint does not prove target configuration.
- A fingerprint does not authorize deployment.
- An unsigned report is not trusted provenance.
- Synthetic evidence cannot become production acceptance evidence.
- No signing, trust-root selection, image creation, registry access, daemon operation, server access, migration, or deployment is part of M6-A28D.
- No production image or deployment has been validated.

Future signing requires a separately authorized signing design, explicit trust roots and identity policy, key custody, verification rules, and independent review. Those steps are outside this milestone.
