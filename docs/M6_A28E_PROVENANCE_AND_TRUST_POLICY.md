# M6-A28E — Provenance and Trust Policy

## Status and scope

This is a future contract and offline descriptor validator. It creates no approval, trusted evidence, signature, key, image, or release authorization. A passing descriptor means only **STRUCTURALLY VALID** and **TRUST NOT ESTABLISHED**; deployable remains **NO**, public release remains **NO-GO**. All 13 production target controls remain **UNVERIFIED** and D1–D12 remain **OPEN**.

## Existing integrity capabilities

M6-A25 binds a compiled candidate to repository inputs using local hashes and candidate-integrity checks. M6-A26 records launch decisions and existing release gates. M6-A27 supplies private preproduction configuration and safety checks. M6-A28A inventories architecture/readiness; M6-A28B plans release artifacts and evidence; M6-A28C validates a strict offline manifest and canonical fingerprint; M6-A28D records clean-checkout observations and synthetic runtime/migration Compose fingerprints. These establish local identities and structure only. They do not authenticate a builder, approve source, prove registry contents or target state, verify signatures, or authorize deployment.

## Descriptor contract

`provenance-attestation.schema.json` defines format 1 and exact property sets. Supported subjects are Frontend compiled candidate, Frontend OCI image, restricted catalog API OCI image, PostgreSQL OCI image, effective runtime Compose configuration, and controlled-migration Compose configuration. Each descriptor binds artifact type and immutable digest to matching subject type and digest; records exact Frontend repository/revision/tree identity and Backend repository/revision/authorized pin; and reserves build-input, builder/workflow claim, invocation, dependency-lock, platform/toolchain/base-image, SBOM, statement, signature, and verification references. Missing real evidence is `NOT_CAPTURED`. References are digest-shaped claims only; the validator neither loads nor hashes referenced content.

OCI artifact identity requires a SHA-256 digest, never a mutable tag. A source revision must be a full Git object ID. Backend identity must match the existing pin in `scripts/backend-pin.mjs`. Descriptor self-fingerprinting reuses `aroman-canonical-json-v1`; this project-specific algorithm is not RFC 8785. Any computed fingerprint here identifies descriptor bytes only.

## Trust boundaries and lifecycle

A future authorized workflow must evaluate these stages independently and preserve evidence for each:

1. Evidence syntax is valid.
2. Referenced evidence exists at an approved location.
3. Retrieved bytes match the recorded digest.
4. Cryptographic signature verifies under a selected algorithm and exact signed payload.
5. Signer identity is authenticated from an approved identity source.
6. Signer is authorized by versioned policy for this artifact, repository, workflow, and time.
7. Provenance subject digest/type exactly matches the candidate artifact.
8. Build inputs match approved source, lockfiles, base images, and toolchain identities.
9. Independent reviewer reviews raw evidence, policy decisions, exceptions, and revocation state.
10. Existing release gates independently authorize the relevant release action.

No stage implies the next. This validator implements stage 1 shape checks and limited internal comparisons only; even those comparisons do not prove the claims are true. Signature verification, signer authentication/authorization, trust-root identity, and independent review are forced to `UNVERIFIED`/`NOT_CAPTURED`. The report must state **STRUCTURALLY VALID; TRUST NOT ESTABLISHED; DEPLOYABLE NO; PUBLIC RELEASE NO-GO**.

Future lifecycle: capture immutable artifact and source identities; retain original evidence bytes; resolve and hash references in an approved verifier; check signature and signer policy/revocation; compare all subjects and inputs; conduct independent review; then submit evidence to existing release gates. Release authorization remains a distinct project-owner decision under the existing gate. Failure, expiry, key compromise, identity compromise, builder compromise, digest mismatch, or revoked policy version means fail closed, quarantine affected evidence/artifact, block promotion, preserve audit records, notify assigned incident authority, and reconsider already produced artifacts from the affected trust interval. The responsible owner and recovery procedure are unresolved.

## Builder and evidence requirements

Before any trusted build, owners must approve authorized Frontend/Backend source identities, builder account/workload identities, exact workflow repository/path/ref, protected workflow revisions, permitted triggers, runner isolation, dependency acquisition policy, reproducibility expectations, and artifact publication rights. Workflow identity must not be inferred from a free-form claim. Build invocation evidence must bind workflow run identity, source revisions, inputs, outputs, and time. Lock evidence must identify complete lock bytes or explicitly approved lock semantics. Base images and all OCI subjects use immutable digests. SBOM and provenance statements must bind the same subject digest and be retained with verification reports.

## What remains impossible offline

Without access to the referenced bytes, offline structure validation cannot establish that references exist or hashes match. It cannot establish registry ownership/content, signature mathematics, certificate or workload identity chains, issuer status, key custody, revocation at verification time, builder isolation, workflow execution, source authorization, build reproducibility, SBOM completeness, target configuration, target behavior, reviewer independence, owner approval, or whether a policy was current. No descriptor can replace target evidence or release-gate decisions.

## Existing release record compatibility

M6-A28C provenance and evidence-reference fields remain the release-record integration point: build, SBOM, signature-verification, and approval references retain their existing vocabulary and remain unverified. This descriptor is a separately versioned detail record and is not copied into a production release record by this milestone. Existing records keep `deployable: false`, `production_acceptance_claim: false`, `public_release_disposition: NO-GO`, all 13 controls `UNVERIFIED`, and D1–D12 `OPEN`. Synthetic fixtures are test-only.

## Owner decisions

No choice is approved. Owners must resolve trust-root ownership and custody; signer/workload identities and authorization scope; permitted build workflows and runner model; signing and attestation formats; algorithm and canonical payload; key or identity issuance; rotation, expiry, revocation and incident response; evidence/artifact retention and access; audit log ownership; independent reviewer qualifications and separation; policy versioning; exceptions; and the handoff into existing release approval. These decisions should be recorded in the existing decision process without creating a parallel deployment approval gate.
