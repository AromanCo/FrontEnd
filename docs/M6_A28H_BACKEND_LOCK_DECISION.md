# M6-A28H — Backend Dependency Lock Decision

## Decision state

**PROPOSED — owner approval required.** This design recommends `pip-tools` generated, fully pinned, hash-verified requirements consumed by pip in Backend CI, Frontend integration CI, and the restricted Backend image. It does not approve a tool, package set, index, platform, lock, image, or release. Backend remains read-only in this milestone.

## Current evidence

At Backend revision `0be24c4597bd693e70348243c26e550a20a8ad0e`, `pyproject.toml` requires Python `>=3.12`, build backend `setuptools.build_meta` with `setuptools>=75`, six ranged runtime dependencies, and four ranged `dev` extras. Runtime extras include `uvicorn[standard]` and `psycopg[binary]`. Backend CI installs `-e '.[dev]'` in four jobs. Frontend has three Backend-consuming jobs with two explicit package lists and one project install; the lists omit declared extras/dependencies in different ways. The two Python Dockerfiles resolve project ranges and setuptools during image build. No authoritative lock, complete hash closure, or approved artifact source is present. See [M6-A28F dependency audit](M6_A28F_BACKEND_DEPENDENCY_AUDIT.md) and [lock policy](M6_A28F_DEPENDENCY_LOCK_POLICY.md).

The four Backend CI jobs are `checks`, `otp-postgres`, `postgres-role-isolation`, and `postgres-backup-restore`. The proposed migration must update all four, the three Frontend Backend-consuming jobs, `../Backend/Dockerfile`, and `deploy/private-preproduction/Dockerfile.catalog-api` in a separately authorized implementation. Existing CI success does not establish equivalent or reproducible environments.

## Options

| Approach | Strengths | Costs and unresolved points |
|---|---|---|
| **A. pip-tools, proposed** | Fits current pip and PEP 517 workflows; `pip-compile --generate-hashes` emits requirements consumable with pip `--require-hashes`; separate runtime, dev/test, and build inputs can be reviewed. | Must define native target matrix, exact compiler/bootstrap versions, build-system closure, wheel-only policy, index provenance, and maintenance ownership. Per-platform lock generation and review add work. |
| **B. uv lock** | A universal `uv.lock` records exact resolutions across platform markers; `uv sync --locked` can verify metadata stays aligned with the lock and exact-sync the environment. uv also supports artifact hashes and build-hash policy. | This is technically viable, not inherently weaker. It would add uv as a pinned bootstrap/install tool across current pip-based Backend CI, Frontend CI, and Docker consumers, or require a separately validated lock export. The owner must approve uv binary provenance, hash enforcement settings, build dependency handling, index policy, and target-specific wheel-only behavior. A frozen install alone does not check that project metadata still matches the lock; prefer a mode that checks lock consistency. |
| **C. Poetry, PDM, or another compatible workflow** | Could align with Backend owner preference and existing tooling. | Adds a tool migration and must demonstrate extras, complete build dependencies, target-specific artifacts, hashes, container consumption, CI parity, and reviewability. No current evidence makes it superior. |

### Proposed rationale

Prefer pip-tools because deployment already uses pip and pip can enforce a complete hash set using `--require-hashes`. Generate separate complete locks for runtime, development/test, build-system, and lock-generation-tool bootstrap requirements. Treat each supported Python/OS/architecture/ABI combination as its own target, generated on a native matching runner. During installation, use only the matching approved lock and verified wheelhouse with `--no-index`, `--require-hashes`, and `--only-binary=:all:`; fail closed when a permitted wheel is unavailable. Build the local Backend package with `--no-deps --no-build-isolation` only after installing the complete static and dynamic build requirements and runtime lock. This prevents a hidden PEP 517 environment from resolving build dependencies outside the lock. Pin and assert the Python/pip toolchain itself; reporting its version is not sufficient.

The choice is a proposal, not authorization. If owners prefer uv or another tool, the same acceptance requirements apply. Do not create locks until owners approve the toolchain, target matrix, index, artifact policy, and reviewers.

## Required owner decisions

1. Approve or reject pip-tools and name the Backend lock maintainer and independent reviewer.
2. Approve exact Python patch, pip, pip-tools, PEP 517 hook-inspection frontend, and build-backend tool versions, their bootstrap artifact source, and update cadence.
3. Approve supported OS, architecture, ABI, and Python patch targets. Decide whether wheel-only installation is mandatory; the proposal says yes.
4. Approve package index/mirror identity, acquisition controls, artifact retention, and offline versus controlled-online policy.
5. Approve build-system dependency closure and how the project itself is built and installed.
6. Approve runtime and development/test lock scope and the Frontend CI consumers.
7. Define vulnerability and license sources, severity/exception rules, review frequency, and evidence retention.
8. Define lock approval, rollback, emergency update, and Backend change authorization.
9. Approve the image base digest policy and how lock digests are recorded in provenance and existing release evidence.

All choices remain `OWNER_DECISION_REQUIRED`; none is approved by this proposal.

## Claims explicitly not made

No dependency resolution was run, no package version or hash is asserted, and no package registry or Docker was accessed. Dependency resolution reproducibility is distinct from bit-for-bit image reproducibility: the latter additionally needs immutable base-image and OS inputs, controlled build tooling, timestamps/build context policy, and reproducible image output evidence. Production remains `NO-GO`; all 13 target controls remain `UNVERIFIED`; D1–D12 remain `OPEN`.

## Technical references used in this proposal

- [pip-tools compile documentation](https://pip-tools.readthedocs.io/en/stable/) describes compiling from project metadata or `.in` inputs, hash generation, and separate outputs for distinct Python environments.
- [pip secure install documentation](https://pip.pypa.io/en/stable/topics/secure-installs/) describes hash-checking mode, all-requirement hash enforcement and wheel-only installs. [pip's build-system documentation](https://pip.pypa.io/en/stable/reference/build-system/) explains isolated build environments and responsibility when `--no-build-isolation` is used.
- [uv locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/) and [uv project layout](https://docs.astral.sh/uv/concepts/projects/layout/) describe lock consistency checks, exact syncing and platform-aware resolution; [uv build settings](https://docs.astral.sh/uv/concepts/projects/build/) documents build dependency hash controls.
