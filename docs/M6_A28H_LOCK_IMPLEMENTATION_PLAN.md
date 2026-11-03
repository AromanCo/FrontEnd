# M6-A28H — Backend Lock Implementation Plan

## Status and scope

**PROPOSED — not approved or executed.** Backend source identity for this design is `AromanCo/Backend` revision `0be24c4597bd693e70348243c26e550a20a8ad0e`. Any Backend file change requires explicit Backend-owner authorization and a later implementation milestone. This document does not create evidence or a new release gate.

## Proposed Backend file changes

Subject to owner approval, add:

| Path | Purpose |
|---|---|
| `requirements/lock-inputs/runtime.in` | Human-reviewed direct runtime inputs derived from `pyproject.toml`, retaining required extras (`uvicorn[standard]`, `psycopg[binary]`). |
| `requirements/lock-inputs/dev.in` | Development/test inputs, including the approved runtime input set and `.[dev]` package requirements as appropriate; the generated dev lock must be standalone and complete. |
| `requirements/lock-inputs/build.in` | Build backend inputs, initially reflecting `setuptools>=75`, with the actual approved build closure generated and reviewed separately. |
| `requirements/lock-inputs/lock-toolchain.in` | Exact approved lock-generation tools and pinned PEP 517 hook-inspection frontend; bootstrap artifacts must be independently seeded and hash-verified, not installed from mutable ranges. |
| `requirements/locks/<target>/lock-toolchain.txt` | Hash-pinned pip-tools, PEP 517 hook-inspection frontend and their closure for the approved lock-generation toolchain. The exact pip executable must come from an approved immutable Python builder/tool image or a separately approved bootstrap artifact. |
| `requirements/locks/<target>/runtime.txt` | Complete runtime closure with exact versions and hashes for one supported target. |
| `requirements/locks/<target>/dev.txt` | Complete dev/test closure with exact versions and hashes for the same target. |
| `requirements/locks/<target>/build.txt` | Complete build-system closure with exact versions and hashes for the same target. |
| `requirements/locks/README.md` | Target naming, generation/verification procedure, approved tool versions and review/update policy. |
| `scripts/verify_dependency_lock.sh` | Optional deterministic wrapper to validate target selection and invoke pip with the required fail-closed flags; no dynamic resolution. |

Exact paths and script necessity are owner decisions. Do not keep parallel unreviewed lock formats. The lock metadata should record the Backend source revision, direct input digests, Python patch, OS release or immutable builder identity, architecture, libc and Python ABI/wheel tags, pip and pip-tools versions, index/mirror identity, compile command, and reviewer record. Do not put credentials or secret index URLs in tracked files.

## Proposed generation and verification workflow

After owner approval and on a clean checkout of the authorized Backend revision:

1. Use a controlled native runner for each approved target. The runner must provide an owner-approved immutable Python builder identity with the exact Python patch and pip version, or an independently verified bootstrap artifact for that exact toolchain. Record `python --version`, `python -m pip --version`, `pip-compile --version`, OS release, architecture, and Python ABI; assert the recorded versions against approved constants and fail on mismatch. A version report alone is not a pin.
2. Assert the exact pip version supplied by the approved immutable builder. Bootstrap pip-tools only from an independently approved, hash-pinned bootstrap lock and verified wheelhouse, for example `python -m pip install --no-index --find-links "$BOOTSTRAP_WHEELHOUSE" --require-hashes -r requirements/locks/<target>/lock-toolchain.txt`. Verify the complete hashes and wheelhouse manifest before installation. The bootstrap lock and wheelhouse are trust anchors that must be separately reviewed and retained; do not create them by resolving unpinned ranges during the lock-generation job. Do not run generation from an unpinned globally installed tool.
3. Generate three lock scopes from reviewed inputs. The index identity must be configured by the controlled runner. Any authentication uses an ephemeral credential mechanism that is not written to logs, lock files, image layers, or command arguments. Example command shape, with `<approved-versions>` and `<target>` intentionally unresolved until owner decisions:

   ```sh
   python -m piptools compile \
     --generate-hashes \
     --resolver=backtracking \
     --output-file "requirements/locks/<target>/runtime.txt" \
     requirements/lock-inputs/runtime.in
   ```

   Repeat with `dev.in` and `build.in` and distinct output paths. Run this command once on a native approved runner for every supported target and record the target tuple in the lock metadata. The lock-toolchain bootstrap lock is not compiled as part of this operation. Confirm the selected pip-tools version supports the chosen options before implementation. Review the complete diff; generation is not approval.

4. In a separately controlled acquisition job, populate a target-specific wheelhouse from the approved package source using the already-reviewed lock, never by resolving input ranges. Example command shape:

   ```sh
   PIP_CONFIG_FILE="$APPROVED_PIP_CONFIG" python -m pip download \
     --no-deps --require-hashes --only-binary=:all: \
     --dest "$TARGET_WHEELHOUSE" \
     -r "requirements/locks/<target>/runtime.txt"
   ```

   Repeat for build, dev/test, and toolchain locks as appropriate. Run this command through an allowlisted environment containing only the approved pip configuration and required runtime variables; reject arbitrary `PIP_*` overrides. The pip configuration must identify only the approved index/mirror. Keep credentials out of the config file where possible by using an approved credential helper or ephemeral auth mechanism. Verify every downloaded wheel filename, normalized project/version, and SHA-256 against the corresponding lock; reject extra or missing files. Retain the source identity and wheelhouse manifest with the lock evidence. `pip download` runs only in this controlled acquisition step; CI and image consumers install offline from the verified wheelhouse.

5. Verify each output on the matching native target using only the matching lock and verified target-specific wheelhouse. Consumer jobs must not fall back to the default public index. The build lock must include the static `[build-system].requires` closure and any additional requirements returned by the backend's PEP 517 build hooks (such as `get_requires_for_build_wheel`). Under the approved build procedure, use a pinned PEP 517 frontend to call the backend hook in an isolated environment seeded only with the static build lock, capture the returned requirements without auto-installing them, review them, and resolve them into the build lock. Repeat until the hook requirements are fully represented; any change to source or backend that changes hook output requires lock regeneration and review. Then install:

   ```sh
   python -m pip install --no-index --find-links "$VERIFIED_WHEELHOUSE" \
     --require-hashes --only-binary=:all: \
     -r requirements/locks/<target>/build.txt
   python -m pip install --no-index --find-links "$VERIFIED_WHEELHOUSE" \
     --require-hashes --only-binary=:all: \
     -r requirements/locks/<target>/runtime.txt
   python -m pip install --no-index --find-links "$VERIFIED_WHEELHOUSE" \
     --no-deps --no-build-isolation .
   python -m pip check
   ```

   Before these commands, assert the active Python patch, pip version, OS release/libc, architecture, ABI/wheel tags and selected lock target. Dev/test jobs use the standalone dev lock instead of runtime plus dev locks, with the same `--no-index --find-links "$VERIFIED_WHEELHOUSE" --require-hashes --only-binary=:all:` flags. Keep package installation constrained to locked distributions; do not run `pip install -e '.[dev]'` after lock installation because that can invoke resolution. If the desired test workflow needs an editable install, use a verified no-dependency/no-build-isolation editable install and test that exact invocation. Run with a clean environment or compare the complete installed distribution name/version inventory against the lock, so packages preinstalled on a runner cannot silently satisfy undeclared requirements.

6. Enforce that all packages are pinned and hashed, there are no unexpected requirements, extras are represented, and `--only-binary=:all:` succeeds. A missing hash, new transitive dependency, unavailable wheel, unsupported target, or unrecognized lock metadata is a hard failure.
7. Review package and build-backend changes for provenance, licenses, vulnerabilities, and application compatibility. Commit locks and input changes together in the authorized Backend change; require an independent reviewer.

Mutable version ranges may remain as reviewed *inputs* used only by the pinned compiler during lock regeneration. They must never be install inputs in CI or images. All installs consume only exact generated lock entries with hashes from the verified wheelhouse and fail if any requirement is unhashed, unpinned, absent, or comes from an unapproved source. The pip-tools bootstrap lock is also a lock input: no `pip install pip-tools`, `pip install -e '.[dev]'`, build-isolation download, fallback to the default public index, or other range-based bootstrap is allowed in the generation or consumer jobs.

## Proposed CI and image migration

| Repository | Existing path | Proposed change |
|---|---|---|
| Backend | `.github/workflows/ci.yml` | Change all four Python jobs to install the approved target-specific dev lock with hash and wheel enforcement; pin or verify the target Python patch, OS release, architecture and wheel tags; retain the existing test commands. |
| Backend | `Dockerfile` | Pin Python base by immutable digest; install only approved build/runtime lock files; install the app without dependency resolution or build isolation. |
| Backend | `requirements/lock-inputs/*`, `requirements/locks/*`, `requirements/locks/README.md` | Add reviewed inputs, target-specific runtime/dev/build locks, and generation/verification policy. |
| Backend | `scripts/verify_dependency_lock.sh` (optional) | Add only if a shared wrapper is needed to enforce target and pip flags consistently. |
| Frontend | `.github/workflows/ci.yml` | Change the three Backend-consuming jobs to install the same approved runtime lock from the pinned Backend checkout; remove explicit ranged package lists and unpinned project installation. Pin or verify Python patch, runner OS release, architecture and wheel tags. Preserve all five jobs and existing checks. |
| Frontend | `deploy/private-preproduction/Dockerfile.catalog-api` | Consume the approved Backend runtime/build lock and immutable Python base; install the local app without a second resolver pass. |

`Backend/pyproject.toml` is not proposed for modification by this plan. Its declared ranges remain human-reviewed lock-generation inputs, not install-time inputs.

### Backend CI

Update `../Backend/.github/workflows/ci.yml` only in the authorized Backend implementation. Keep its four existing jobs and test commands. Each job selects one approved target lock. The `checks` job installs the dev lock; PostgreSQL jobs do likewise because their test suite requires dev/test packages. Add a shared verification step that rejects missing locks, wrong target metadata, editable dependency resolution, unapproved indexes, and hash omissions before tests run.

### Frontend integration CI

Update `.github/workflows/ci.yml` in an authorized Frontend implementation. Preserve the five jobs and existing tests. The three Backend-checkout jobs install the same approved runtime lock (and any narrowly justified test lock) from `backend-pinned`; remove explicit package lists and project installs that resolve ranges. Ensure the selected lock target matches the `setup-python` patch and hosted runner architecture. The other two Frontend-only jobs do not acquire Backend Python packages.

### Restricted Backend Dockerfiles

Update `../Backend/Dockerfile` and `deploy/private-preproduction/Dockerfile.catalog-api` only after authorization. Pin the Python base image by immutable OCI digest. Copy only the target's runtime and build lock files; install build and runtime dependencies with hash and wheel enforcement; install the local app using no dependency resolution and no build isolation. Do not mount or expose a package credential in image layers. Record base image, lock digests, target platform and final image digest in the existing provenance/evidence slots. Keep build inputs and OS package inputs separately controlled.

No Dockerfile or workflow changes are part of M6-A28H.

## Rollback and evidence binding

Retain each approved lock revision and its acquisition artifacts. Roll back by selecting a previously approved lock at its exact Git revision and digest, re-running hash/install and compatibility checks for the target, then recording the rollback decision under existing owner/release controls. Never fall back to ranges or regenerate from a prior input without review.

For a future release, bind the lock path/revision/digest, target tuple, toolchain versions, source revision, package source identity, and verification result to the existing Backend dependency/provenance evidence slots described by [M6-A28F readiness register](M6_A28F_RELEASE_EVIDENCE_READINESS.md) and the existing [M6-A28C manifest contract](M6_A28C_OFFLINE_MANIFEST_CONTRACT.md). Keep evidence `NOT_CAPTURED` until real evidence is collected and independently reviewed.

## Scope boundaries

This plan does not authorize Backend changes, dependency updates, package acquisition, image builds, signatures, deployment, production approval, or a lock. It establishes no reproducible environment and does not alter existing gates. Production remains `NO-GO`; all 13 target controls remain `UNVERIFIED`; D1–D12 remain `OPEN`.
