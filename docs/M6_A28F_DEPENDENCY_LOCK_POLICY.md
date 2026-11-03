# M6-A28F — Proposed Backend Dependency Lock Policy

## Decision state

**OPEN — no locking tool or install strategy is approved.** Backend remains read-only in M6-A28F. The Backend owner must authorize any future change to Backend metadata, lockfiles, Dockerfiles, CI, or dependency acquisition.

## Minimum contract for a future authorized lock

A candidate lock must bind to Backend repository `AromanCo/Backend` at authorized source revision `0be24c4597bd693e70348243c26e550a20a8ad0e` (or a separately authorized future pin). It must cover:

- Exact runtime Python patch version, OS, architecture, ABI, pip/resolver version and installation flags.
- PEP 517 build-system requirements including the build backend and its complete dependencies.
- Complete resolved runtime dependency closure, including `uvicorn[standard]` and `psycopg[binary]` extras.
- Separate complete development/test closure for `.[dev]`, without confusing development packages with production image dependencies.
- Every selected artifact hash and defined behavior for platform-specific wheels, source distributions and unsupported targets.
- Package/index provenance, approved index/mirror identity, artifact retention and policy for network access.
- A generation record binding tool versions, source revision, inputs, target environments, output lock digest and reviewer.

Installation must use the approved lock without re-resolving ranges, verify all hashes, fail on missing hashes or unlisted distributions, and use the owner-approved artifact source. Production image construction must consume the same reviewed runtime/build lock identities. The build should pin the Python base image by immutable digest and capture OS/package layer inputs separately. Offline installation is preferred after an authorized wheelhouse or immutable package mirror is populated and verified; any controlled online acquisition must verify index and downloaded artifact identity before use.

## Lifecycle and controls

1. Backend owner approves the tool, supported targets, index/mirror policy, build isolation design, update cadence, reviewer and lock-file ownership.
2. Generate from the exact authorized Backend revision in a documented, isolated workflow; record toolchain, resolver, target tags and source identity. Generation is not itself approval.
3. Review direct/transitive changes, extras, platform markers, artifact hashes, license findings, vulnerability findings, package provenance and build-system dependencies.
4. Independently regenerate or verify the lock, install using hash enforcement in every approved target environment, and compare resulting package/artifact identities.
5. Bind the approved lock digest and toolchain identity into future build evidence and existing release-record slots. Keep actual evidence `NOT_CAPTURED` until collected and reviewed.
6. Retain the last approved lock and acquisition artifacts. Roll back only through owner-approved source/lock review, re-verification and existing release controls; do not silently return to mutable ranges.

Dependency vulnerability and license reviews need named accountable roles, approved data sources, severity/exception policy, review cadence and evidence retention. None is assigned by this proposal.

## Options for owner review

| Approach | Benefits | Open concerns |
|---|---|---|
| `pip-tools` with fully pinned, hash-verified requirements | Familiar pip workflow; explicit generated requirements and `--require-hashes`; can separate runtime and development targets. | Must define per-platform lock outputs, build-system isolation/lock, constraints across extras, compiler/source-build policy and who maintains generated files. Tool and exact workflow remain unapproved. |
| `uv lock` with a separately reviewed deployment method | Unified resolver/lock format and target markers; can make lock generation deterministic across declared environments. | Production install behavior must be separately specified and proven to honor every lock/hash; tool bootstrap, version pin, wheelhouse/index, build backend and Docker integration remain decisions. `uv.lock` alone is not evidence of a hash-verified deployment. |
| Other PEP 621-compatible lock workflow (for example Poetry or PDM) | May fit Backend-owner workflow and toolchain governance. | Must demonstrate correct extras, build dependencies, hashes, deployment consumption, multi-platform behavior and reproducible review. No tool is preferred or approved here. |

## Explicit non-claims

This document creates no Backend lockfile, resolved package list, package hash, package approval, dependency vulnerability clearance, image identity, production evidence, or deployment authorization. Frontend CI passing does not prove the acquisition methods are equivalent or that a future production image uses an approved lock. D1–D12 and all existing release gates remain unchanged.
