# M6-A28C — Offline Manifest Contract

## Purpose and limit

The version 1 offline artifact manifest is a strict, non-secret identity record for the M6-A25 Frontend candidate and M6-A27 private-preproduction artifact plan. It provides structural validation, deterministic JSON fingerprinting, and optional cross-checking against an M6-A25 candidate manifest (or full local M6-A25 verification when a candidate directory is supplied). It is not a release approval, deployment command, signature verifier, registry client, or evidence-authentication system.

Every successful validation reports `trusted: false`, `deployable: false`, `production_acceptance_claim: false`, `public_release_disposition: NO-GO`, and exactly 13 target controls as `UNVERIFIED`. A synthetic fixture that passes validation remains synthetic and cannot satisfy production acceptance.

## Files and invocation

- Schema: `docs/offline-artifact-manifest.schema.json` (JSON Schema draft 2020-12, closed objects).
- Non-secret planning template: `docs/offline-artifact-manifest.example.json`.
- Validator/CLI: `scripts/validate-offline-artifact-manifest.mjs`.
- Synthetic regression suite: `tests/offline-artifact-manifest.check.mjs`.
- Package commands: `npm run validate:offline-artifact-manifest -- <manifest.json> [--candidate-dir <.next>] [--source-dir <frontend-checkout>] [--json]`; `npm run test:offline-artifact-manifest`.

The validator uses only Node built-ins and the existing `scripts/backend-pin.mjs` / `scripts/candidate-integrity.mjs`; no dependency or lockfile change is needed. It performs no network calls. Without `--candidate-dir`, it checks manifest structure and internal pin/safety constraints, but has no candidate bytes to verify. With `--candidate-dir`, it reads that directory's existing `release-candidate.json`, cross-checks candidate fields, and calls the existing `verifyCandidate()` implementation using the selected Frontend checkout. That verifier receives an explicit two-key environment object containing only `AROMAN_RELEASE_SCOPE` and `NEXT_PUBLIC_AROMAN_API_BASE_URL`; unrelated process environment values are not copied or forwarded. The existing candidate checker does not itself prove a clean Git checkout; the manifest leaves clean-checkout attestation `NOT_CAPTURED` or `UNVERIFIED` and cannot elevate it to trusted.

Example human output for the captured-state template:

```text
UNVERIFIED Planning template: NOT_CAPTURED slots are placeholders, not evidence.
STRUCTURALLY VALID; SHA-256 <computed locally>; TRUST NOT ESTABLISHED; DEPLOYABLE NO; PUBLIC RELEASE NO-GO; 13 TARGET CONTROLS UNVERIFIED
```

The digest placeholder above is illustrative; no digest is embedded in this document. Use `--json` for machine-readable output including validation errors/warnings and the same mandatory release-safety values.

## Version 1 fields

The schema rejects unknown properties at every object level. Source fields identify the Frontend and Backend repository slugs, full Git revisions or `NOT_CAPTURED`, Frontend source-tree SHA-256 or `NOT_CAPTURED`, and a clean-checkout evidence status that cannot be marked verified by this tool. The authorized Backend pin is fixed by `scripts/backend-pin.mjs`; a captured Backend revision must equal that pin.

The Frontend candidate records `public-showcase`, `/api/v1`, metadata format, configuration and compiled artifact SHA-256 values, and compiled file count. Optional M6-A25 cross-checking compares these with the candidate's scope, source revision/tree, Backend revision, API base, metadata format, configuration/artifact hashes, file count, package-lock hash, Node version and Next version. For complete byte-level candidate verification, use `--candidate-dir`; a manifest cross-check alone authenticates no bytes.

Frontend dependencies record package-lock SHA-256 and captured Node/npm/Next/platform identities. Backend dependency-lock status/reference are required to remain `NOT_CAPTURED`; the pinned Backend's `pyproject.toml` declares version ranges and this milestone does not create or claim a lockfile. Python, pip, and build-backend identities may be recorded as non-secret strings or left `NOT_CAPTURED`.

The three image records are Frontend, restricted catalog API, and final PostgreSQL. Each is either `NOT_CAPTURED` with every image identity field set to `NOT_CAPTURED`, or `RECORDED_UNVERIFIED` with registry/repository (without tag or credentials), immutable `sha256` digest, platform, and immutable base-image identity. A recorded digest is a syntax/identity claim only; it is not proof an image exists, is signed, or is trusted. No real image digest was created in M6-A28C.

Runtime configuration records Compose source revision/path/file hash, non-secret reference identifiers and secret reference identifiers only. The effective Compose fingerprint and status are required to stay `NOT_CAPTURED`; deterministic effective Compose fingerprinting and approval are outside this milestone. No secret values, credential-bearing URLs, arbitrary secret fields, or environment values are part of this contract.

Every evidence-reference field uses the same single allowlisted syntax: `sha256:` followed by exactly 64 lowercase hexadecimal characters. This content digest identifies bytes but does not locate them. It is used for the clean-checkout report, build-provenance document, SBOM, signature-verification report, builder/operator/reviewer evidence, previous-artifact manifest, and rollback evidence, respectively. The reference validator rejects arbitrary identifiers, unsupported URI schemes, absolute paths, credential-bearing URLs, environment assignments, malformed digests, and token-like strings outside that exact form. The example keeps these references `NOT_CAPTURED`; no synthetic digest is inserted there.

Reference syntax validity is only the first distinction: a valid digest string does not prove that the referenced bytes exist, that they match the digest, that the evidence was verified, or that trust was established. Evidence status remains `NOT_CAPTURED` or `UNVERIFIED`; this tool does not fetch referenced data or turn either state into trusted evidence. Build provenance, SBOM, signature verification, builder/operator/reviewer evidence, previous artifact, and rollback references may be `NOT_CAPTURED` or explicitly `UNVERIFIED`. This tool rejects trusted/verified statuses and does not parse signatures, certificates, attestations, or SBOMs. Signing, provenance authentication, trust-root selection, and registry interactions remain future authorized work.

## `NOT_CAPTURED` and trust semantics

`NOT_CAPTURED` means the value/evidence has not been supplied. It is not zero, an empty value, a successful check, or an implicit default. Captured but unauthenticated evidence is labeled `UNVERIFIED`; a structural pass never changes that status. The planning example intentionally has uncaptured source/candidate/image/effective-Compose/approval evidence and should not be interpreted as a release candidate.

`evidence_class` is one of `planning_template`, `synthetic_fixture`, or `repository_candidate`; there is no `production` class. The validator accepts synthetic fixtures only to test the contract. It fixes the public release to NO-GO and every target control to UNVERIFIED, and reports trust as false regardless of evidence class. Synthetic values and fixture references must not be copied into target evidence.

## Deterministic manifest fingerprint

The manifest fingerprint is SHA-256 over UTF-8 bytes of a project-specific canonical JSON serialization:

1. Recursively sort object property names by JavaScript UTF-16 code-unit ordering.
2. Preserve array order.
3. Serialize strings, numbers, booleans and null using JavaScript `JSON.stringify` rules; reject non-finite numbers and non-JSON values.
4. Encode the canonical string as UTF-8 and calculate SHA-256.

This is explicitly **not claimed to be RFC 8785 canonical JSON**. The manifest has no fingerprint field, so there is no self-reference. Reordering object keys preserves the fingerprint; changing any value or array order changes it. This is an integrity checksum of the supplied document, not a signature or source of trust.

## Existing gates and controls

This contract reuses `scripts/candidate-integrity.mjs`, `scripts/prepare-private-candidate.mjs`, `scripts/validate-private-release-record.mjs`, `scripts/backend-pin.mjs`, `scripts/check-api-contract.mjs`, and the unchanged `scripts/assess-public-release-gate.mjs`. It does not replace or relax the existing private-record validator or public-release gate and does not create a parallel approval mechanism. Tests are added to the existing GitHub Actions `verify` job; the existing five job names and other checks remain.

The manifest validator does not implement a clean-checkout attestation, effective Compose canonical fingerprint, image-build provenance, SBOM verification, signature verification, registry policy, deployment, or target evidence collection. These remain explicitly unimplemented. The M6-A27 private preproduction runbook at `docs/M6_A27_PRIVATE_PREPRODUCTION_RUNBOOK.md` defines the approval-gated future operator boundaries.

Formal D1–D12 remain OPEN. The Afra 80 GB disk expansion remains PLANNED ONLY. The accepted minimatch advisory remains TEMPORARILY ACCEPTED — REMEDIATION OPEN. All 13 target controls remain UNVERIFIED; public release remains NO-GO. Backend dependency-lock work, signing/trust-root selection, image builds, promotion and target operations require separate authorization. No Backend files, secrets, Docker resources, real images or signatures are changed or created here.
