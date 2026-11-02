# M6-A28E — Signing and Trust-Root Decision Matrix

**Decision state: OPEN.** This comparison is preparatory; no provider, trust root, key, algorithm, or workflow is selected or approved.

| Approach | Trust root and signer identity | Custody / issuance | Verification and revocation | Main tradeoffs |
|---|---|---|---|---|
| Key-based artifact signatures | Owner-controlled public keys and an explicit signer allowlist; identity is the key fingerprint plus policy mapping | Owner selects hardware-backed or managed custody, access separation, backup and recovery | Verify exact subject digest and signed payload; publish key validity, rotation, compromise and revocation records | Portable and provider-neutral; key custody, distribution, rotation and attribution are operational burdens |
| Short-lived identity-based signing | Owner-approved identity issuer and constrained workload claims | Issuer grants short-lived credentials after workload authentication; no long-lived signing key in CI | Validate issuer chain, audience, subject, workflow claims, issuance time, transparency/audit records and current revocation policy | Reduces persistent key exposure; issuer and claim policy become critical trust roots |
| Trusted CI workload identity | CI platform identity constrained by repository, workflow path/ref, protected environment and event | CI issues ephemeral identity only to an approved workflow; owner controls repository/workflow protections | Verify exact platform issuer, repository/workflow/ref claims, run identity and policy snapshot; reject unapproved forks or refs | Tight workflow binding; CI platform, administrator, runner and workflow supply-chain compromise remain material risks |
| Independently verified build attestations | Trust roots are separately chosen for builder, verifier, signer, and reviewer | Build service emits signed statement; separate verifier checks it against owner policy | Independently re-evaluate subject, source, dependencies, builder claims, policy, signature and revocation; retain verifier output | Stronger separation and auditability; higher complexity, evidence retention cost and verifier governance burden |

## Required decision questions

| Area | Decision required from owner | Current state |
|---|---|---|
| Trust-root ownership | Which accountable organization controls root identity, policy publication, backup, and emergency revocation? | OPEN |
| Authorized signer | Which role or workload may sign each of the six artifact classes, under what scope and time bounds? | OPEN |
| Build workflow | Which immutable repository/workflow/ref and trigger conditions are authorized? | OPEN |
| Key custody / identity issuance | What hardware, managed custody, issuer, admin separation, and recovery controls are acceptable? | OPEN |
| Verification | Which signature/attestation formats, algorithms, payload binding, verifier version, and policy version are required? | OPEN |
| Rotation and revocation | Expiry, overlap, revocation propagation, historical verification, and emergency response timelines? | OPEN |
| Compromised builder | How to identify affected runs and artifacts, halt promotion, quarantine outputs, notify reviewers, and rebuild? | OPEN |
| Retention | Where and how long are artifact bytes, SBOMs, statements, signatures, verification reports, policy snapshots, and logs retained? | OPEN |
| Audit evidence | Which immutable records prove identity issuance, workflow execution, verification, policy decisions, exceptions, and access? | OPEN |
| Independent review | Who is independent of build/sign/release operations, what raw evidence must be checked, and how is review recorded? | OPEN |
| Existing gates | How does evidence enter current release gates without bypassing their owner decision and target-control requirements? | OPEN; existing gates remain authoritative |

## Lifecycle requirements for a future authorized workflow

1. Freeze exact artifact digest, source revision/tree identities, lock evidence, base image, platform, toolchain, workflow and invocation.
2. Generate provenance and SBOM bound to that immutable subject; store their original bytes with content digests.
3. Sign only through the approved identity/key path and record the exact signed payload and signature reference.
4. Verify signature, signer authentication, signer authorization, policy version, revocation, subject binding and build inputs independently.
5. Have a distinct reviewer inspect source identities, workflow/run evidence, signer policy, verification output, retention and exceptions.
6. Submit the complete evidence package to the existing release gates. Only the existing authorized owner process can decide a release action.

Any missing, mismatched, revoked, expired, inaccessible or policy-incompatible evidence is a fail-closed result. Preserve audit evidence and quarantine affected artifacts pending an owner-directed incident review. The incident authority, notification timeline, retention schedule, and recovery process remain undecided.

This matrix creates no authorization and makes no provider recommendation. M6-A28E leaves all decisions OPEN, all trust-dependent fields UNVERIFIED, deployment disabled, production acceptance false and public release NO-GO.
