# M6-A28I — Initial Backend Lock Implementation Direction

## Authorized initial direction

**AUTHORIZED — initial design direction only.** The Backend owner has approved `pip-tools` as the initial dependency-locking approach for AROMAN Backend. This record does not authorize implementation work.

The initial non-production target is Ubuntu 24.04 x86_64 with CPython 3.12. The approved direction is wheel-only dependencies, separate runtime, development, build, and bootstrap locks, and hash-verified offline installation.

This authorization covers only the direction stated above. It does not authorize selecting pending toolchain or artifact decisions, dependency resolution, package downloads, lock generation, CI or Docker migration, or production deployment.

## Attribution and authorization record

Complete this section with attributable evidence before treating this record as a completed owner sign-off. No identity, approval evidence, or reviewer identity was supplied in the source record.

| Field | Record |
|---|---|
| Owner full name | Your actual full name |
| Owner role | Backend owner (authority confirmed; sign-off attribution pending) |
| Approval date | 2026-11-04 |
| Approval evidence/reference | https://github.com/AromanCo/FrontEnd/pull/59#issuecomment-6626864111 |
| Authorization scope | Initial design and implementation direction only, subject to attribution and the limits below; no lock generation or implementation authorization. |
| Independent reviewer | **REQUIRED — not assigned** |
| Outstanding decisions | Exact tool versions; immutable builder and complete target tuple; package source and artifact verification; wheelhouse retention/access and offline contract; security policy; lock maintainer; rollback governance; remaining build and lock scope details. |

The owner’s authority is confirmed, but the full name, dated approval reference, reviewer assignment, and pending decisions below remain to be recorded. This attribution section does not create or imply approval of any pending item.

## Acknowledged registry lookup exception

The owner acknowledges that the prior M6-A28I recommendation included a read-only lookup of public PyPI release metadata, despite the task restriction against accessing package registries. No package artifacts were downloaded. This exception is disclosed, not automatically accepted; it does not approve any package source, version, artifact, hash, or future registry access. Any future metadata or artifact access requires its own applicable authorization and controls.

The versions reported in that recommendation — CPython 3.12.16, pip 26.3, and pip-tools 7.6.2 — are unapproved candidates. The PEP 517 hook-inspection frontend version was not established. None may be used for lock generation based on this decision.

## Pending owner decisions before lock generation

Before any lock generation, the owner and independent reviewer must complete and record the following checklist. An unchecked item blocks lock generation authorization.

- [ ] Attribute the initial direction: enter owner full name, role, approval date, and a verifiable approval evidence/reference; name the independent reviewer and lock maintainer.
- [ ] Approve exact Python, pip, pip-tools, PEP 517 hook frontend, and build backend versions. **No exact versions are approved by this record.**
- [ ] Approve the immutable builder identity and the complete target tuple: OS release, architecture, Python ABI, and wheel tags.
- [ ] Approve package source identity, artifact verification process, wheelhouse retention and access governance, and the offline installation contract.
- [ ] Approve vulnerability and license data sources, severity thresholds, exception authority, review cadence, and evidence retention.
- [ ] Approve rollback authority and the procedure for selecting and re-verifying a previously approved lock.
- [ ] Confirm lock scopes and build-system closure, including static and dynamic PEP 517 requirements, before defining any generation inputs.

**Pending by default:** package source, wheelhouse governance, immutable builder, security policy, and rollback governance have not been approved here. The checklist does not pre-approve any of them.

The required bootstrap lock and retained bootstrap artifacts must themselves be approved and hash-verified before the compiler or hook-inspection tools are installed. Build locks must cover static and dynamic PEP 517 requirements. Runtime and development locks must represent the declared project dependencies and extras for the approved target.

## Independent review requirements

Before any candidate lock can be treated as authoritative, an independent reviewer must be assigned and must verify the approved source identity, generation inputs, dependency and build-system closure, artifact hashes and provenance, target compatibility, and offline installation evidence. Reviewer identity and review evidence must be recorded. Review does not itself authorize CI adoption or production use.

## Future implementation authorization

The following stages require distinct authorization and evidence. Completion of the pending-decision checklist alone does not authorize implementation:

1. **Toolchain and generation authorization:** after pending owner decisions are recorded, explicitly authorize the bounded lock-generation work and its inputs.
2. **Candidate lock generation:** only after stage 1; generated output remains a proposal until independent review and approval.
3. **Independent lock review:** perform and record the review requirements above.
4. **CI adoption:** requires separate authorization after lock review; it is not included here.
5. **Production release:** requires existing release gates and a separate production decision; it is not included here.

## Status

Production remains **NO-GO**. All 13 target controls remain **UNVERIFIED** and D1–D12 remain **OPEN**. No package resolution, download, or lock generation is authorized by this decision.
