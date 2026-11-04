# M6-A28I — Initial Backend Lock Implementation Direction

## Authorized initial direction

**AUTHORIZED — initial design direction only.** The Backend owner has approved `pip-tools` as the initial dependency-locking approach for AROMAN Backend. This record does not authorize implementation work.

The initial non-production target is Ubuntu 24.04 x86_64 with CPython 3.12. The approved direction is wheel-only dependencies, separate runtime, development, build, and bootstrap locks, and hash-verified offline installation.

The initial-direction authorization covers only the direction stated above. It does not authorize selecting pending toolchain or artifact decisions, dependency resolution, package downloads, lock generation, CI or Docker migration, or production deployment.

## P7 — Controlled solo-maintainer workflow

This amendment defines two distinct stages. It authorizes only this documentation change; it does not authorize candidate generation or acceptance.

P7 authorization evidence: [Backend owner comment on PR #60](https://github.com/AromanCo/FrontEnd/pull/60#issuecomment-6639064343). The comment authorizes this documentation-only amendment and explicitly defers candidate generation, CI/Docker adoption, and production deployment.

### A. Provisional candidate development

- Candidate development requires a separate, explicit, bounded Backend-owner implementation authorization before any candidate resolution, package acquisition, or lock generation. The authorization must identify the Backend source revision, target, permitted candidate toolchain and artifact-acquisition scope, output location, and exclusions.
- A solo maintainer may prepare candidate inputs and candidate lock files within that bound. Independent review is not a prerequisite to drafting them, and drafting must not be described as review or approval.
- Every candidate input, lock, wheelhouse, and report must be conspicuously marked **PROVISIONAL — NOT APPROVED**. Candidate versions, hashes, tools, and artifacts remain unapproved.
- Provisional work does not authorize CI or Docker adoption, production use, or a claim that release controls have passed.

### B. Authoritative lock acceptance

A provisional candidate may be accepted as authoritative only after the owner approves the exact toolchain and immutable builder/target; source and artifact provenance are established; vulnerability and license reviews meet approved policy; an independent human reviewer records review of the source, inputs, closures, hashes, target, and offline evidence; and the owner gives separate explicit acceptance authorization. Candidate generation, a passing install, or a documentation amendment does not satisfy these gates.

This amendment does not ratify any P5/R1 candidate. CPython 3.12.3, pip 26.3, pip-tools 7.6.2, the observed build frontend, package versions, wheel hashes, and artifacts in those experiments remain unapproved evidence only. A later bounded authorization must select its own candidate scope; nothing here pre-approves those values.

The [M6-A28H implementation plan](M6_A28H_LOCK_IMPLEMENTATION_PLAN.md) and [acceptance matrix](M6_A28H_LOCK_ACCEPTANCE_MATRIX.md) remain the Stage B criteria. Stage A does not waive or satisfy their toolchain, builder, provenance, security, license, verification, or review requirements. Stage A may use only the bounded provisional tools and artifacts in isolated temporary environments; for Stage B, bootstrap tools and artifacts must be approved and hash-verified before use.

## Attribution and authorization record

Complete this section with attributable evidence before treating this record as a completed owner sign-off. No identity, approval evidence, or reviewer identity was supplied in the source record.

| Field | Record |
|---|---|
| Owner full name | mohammadrezaqaderi |
| Owner role | Backend owner — initial direction sign-off attributed; later authorizations are separately scoped below |
| Approval date | 2026-11-04 |
| Approval evidence/reference | https://github.com/AromanCo/FrontEnd/pull/59#issuecomment-6626864111 |
| Authorization scope | Initial design and implementation direction only, subject to attribution and the limits below; no lock generation or implementation authorization. |
| Independent reviewer | **REQUIRED — not assigned** |
| Outstanding decisions | For authoritative acceptance: exact tool versions; immutable builder and complete target tuple; package source and artifact verification; wheelhouse retention/access and offline contract; security policy; lock maintainer; rollback governance; remaining build and lock scope details. |

The Backend owner’s initial design authorization is attributed to the named owner, dated November 4, 2026, and linked to the GitHub approval comment. Independent reviewer assignment, lock maintainer designation, and the remaining authoritative-acceptance decisions are still pending. This attribution section does not create or imply approval of any pending item. The P7 documentation authorization does not authorize candidate generation; Stage A still requires separate bounded approval.

## Acknowledged registry lookup exception

The owner acknowledges that the prior M6-A28I recommendation included a read-only lookup of public PyPI release metadata, despite the task restriction against accessing package registries. No package artifacts were downloaded. This exception is disclosed, not automatically accepted; it does not approve any package source, version, artifact, hash, or future registry access. Any future metadata or artifact access requires its own applicable authorization and controls.

The versions reported in that recommendation — CPython 3.12.16, pip 26.3, and pip-tools 7.6.2 — are unapproved candidates. The PEP 517 hook-inspection frontend version was not established. None may be used for lock generation based on this decision.

## Pending owner decisions before authoritative lock acceptance

The owner must resolve and record the following checklist before authoritative lock acceptance. Each unchecked item blocks Stage B. Stage A remains subject to its separate bounded authorization and does not waive any item for acceptance.

- [ ] Attribute the initial direction: enter owner full name, role, approval date, and a verifiable approval evidence/reference; name the independent reviewer and lock maintainer.
- [ ] Approve exact Python, pip, pip-tools, PEP 517 hook frontend, and build backend versions. **No exact versions are approved by this record.**
- [ ] Approve the immutable builder identity and the complete target tuple: OS release, architecture, Python ABI, and wheel tags.
- [ ] Approve package source identity, artifact verification process, wheelhouse retention and access governance, and the offline installation contract.
- [ ] Approve vulnerability and license data sources, severity thresholds, exception authority, review cadence, and evidence retention.
- [ ] Approve rollback authority and the procedure for selecting and re-verifying a previously approved lock.
- [ ] Confirm lock scopes and build-system closure, including static and dynamic PEP 517 requirements, before defining any generation inputs.

**Pending by default:** package source, wheelhouse governance, immutable builder, security policy, and rollback governance have not been approved here. The checklist does not pre-approve any of them.

For Stage B, the bootstrap lock and retained bootstrap artifacts must themselves be approved and hash-verified before the compiler or hook-inspection tools are installed. Build locks must cover static and dynamic PEP 517 requirements. Runtime and development locks must represent the declared project dependencies and extras for the approved target.

## Independent review requirements

Before any provisional candidate can be treated as authoritative, an independent human reviewer must be assigned and must verify the approved source identity, generation inputs, dependency and build-system closure, artifact hashes and provenance, target compatibility, and offline installation evidence. Reviewer identity and review evidence must be recorded. Review does not itself authorize authoritative acceptance, CI adoption, or production use.

## Future authorization sequence

The stages below remain separate; completing one does not authorize the next.

1. **Stage A — Provisional candidate development:** requires the separate bounded owner authorization described above. The solo maintainer may draft candidates only within that bound; all outputs remain provisional and unapproved.
2. **Stage B — Authoritative lock acceptance:** requires the pending owner decisions, approved toolchain and builder/target, source and artifact provenance, vulnerability/license review, recorded independent human review, and separate explicit owner acceptance authorization.
3. **CI or Docker adoption:** requires separate authorization after Stage B; it is not included in either candidate development or lock acceptance.
4. **Production release:** requires existing release gates and a separate production decision; it is not included here.

## Status

Production remains **NO-GO**. All 13 target controls remain **UNVERIFIED** and D1–D12 remain **OPEN**. This P7 documentation amendment authorizes no package resolution, download, or lock generation; Stage A requires a separate bounded owner authorization. CI/Docker adoption and production remain separately gated.
