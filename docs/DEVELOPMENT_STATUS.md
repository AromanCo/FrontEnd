# AROMAN Development Status

**Status date:** 2026-10-28
**Evidence baseline:** the commits listed below. This is a repository and milestone status report, not a deployment report.

## Repository baselines

| Repository | Baseline | Branch / milestone evidence |
| --- | --- | --- |
| Frontend | `9bea6ff38473d54fcc8b9900611aa5433ebd93f3` | M6-A8, PR #32, merged to `develop`. |
| Backend | `df603654aaec03e4aeada20ab21d6e05803d8488` | M6-A7C, PR #23, merged to `develop`. |

The current Frontend Backend pin is `0be24c4597bd693e70348243c26e550a20a8ad0e`, recorded in `scripts/backend-pin.mjs` and Frontend CI. Earlier milestone rows below retain their original evidence baselines.

The commit histories show the merge commits for Frontend PR #32 and Backend PR #23. The milestone handoff reports CI passed for each. A successful CI run verifies configured checks at the revision and runner used; it does not prove a production deployment, live SMS delivery, or commercial operation.

## Capability and status matrix

| Area | Status | Evidence and limits |
| --- | --- | --- |
| Persian-first RTL application | Implemented | Next.js 16, React 19, TypeScript; browser checks cover responsive RTL flows. |
| Public catalog | Implemented | Backend is authoritative; seeded/demo data is not evidence of commercial products or stock. |
| Guided Studio | Implemented | Editorial, deterministic recommendations based on catalog data. |
| Creative Studio | Implemented | Conceptual composition and saved concept journeys exist. |
| Smart Perfumer | Implemented as conceptual experience | Advice is not a formulation, physical compatibility, safety, or manufacturing certification. |
| Authentication and saved concepts | Implemented in code and tested | Frontend integrates with Backend. Current Backend default SMS provider is unconfigured and OTP delivery returns unavailable; no real SMS is active. |
| API contract and generated types | Verified in CI configuration | Pinned OpenAPI snapshot/type checks detect declared schema drift, not all runtime behavior. |
| SQLite real-stack browser journey | CI gate configured | Disposable local test database, real FastAPI/Next.js processes, FakeSMS test access. No real SMS or production DB. |
| PostgreSQL real-stack browser and transaction checks | CI gates configured | Disposable PostgreSQL 17 container and synthetic test data. Does not prove intended production role topology, capacity, or operations. |
| Backend OTP transaction safety | Completed, M6-A4B | Repository milestone history and tests. |
| Kavenegar adapter | Completed offline-only, M6-A6A/A6B | Adapter/regression coverage; not configured for real delivery. |
| PostgreSQL role isolation/hardening | Completed, M6-A7A/A7A-R1 | Disposable role/grant gates; production provisioning remains unverified. |
| PostgreSQL backup/restore rehearsal | Completed, M6-A7B | Disposable PostgreSQL rehearsal; no production backup schedule, retention, RPO/RTO, or managed-service restore established. |
| Transport-security configuration | Completed, M6-A7C | Configuration and in-process checks; no actual TLS proxy, DNS, firewall, or public-origin rehearsal. |
| Signature Collection B | Proposed physical product line | Product direction is recorded; no verified finished product, manufacturer, SKU, price, or fulfillment capability. |
| Controlled Personalization C | Proposed constrained physical product line | No approved production configuration library or verified production integration. |
| Commerce | Not implemented as operational service | Cart, checkout, order, price, inventory, and payment are not demonstrated; routes are placeholders. |
| Production deployment | Unverified | Repository and CI evidence do not establish an environment or deployed service. |
| Real SMS delivery | Inactive | Provider preference and offline adapter do not establish a live integration. |

## Operational blockers

For a public environment that offers authentication or persists user data, current Backend guidance requires the following to be designed and verified for the actual target environment:

- Production SMS provider choice, integration, delivery and failure tests, abuse limits, and accountable operations owner.
- Production PostgreSQL with distinct least-privilege application and migrator roles.
- Backup retention and access controls, agreed recovery objectives, and a restore rehearsal with application validation.
- HTTPS termination, exact CORS origins, trusted proxy peers, secure cookie/CSRF behavior, and private API/database network paths.
- Secret injection, access restrictions, rotation, and incident handling.
- Deployment and migration runbook, health checks, rollback, redacted logs, monitoring, alerting, and incident response.
- Proof that FakeSMS and private test OTP access cannot be exposed by deployment.
- Rate-limit and client-address behavior tested through the intended proxy and worker topology.

For a commercial release, also resolve the relevant B/C product scope and obtain evidence for qualified production, product safety and labeling, legal eligibility, pricing, availability, fulfillment, returns, and customer support. No commercial or manufacturing readiness is established by this status report.

## Unresolved owner decisions

Repository decision records leave these questions open:

- What is the initial release scope: conceptual exploration, accounts and saved data, physical commerce, or a combination?
- Is B allowed to launch independently of C, and what is the release sequence?
- Is real SMS authentication required for the first public release, and which provider and operator will be approved?
- What target hosting, domains, proxy, database service, secret management, and operational owners will be used?
- Which qualified parties will approve product safety, labeling, production configurations, product claims, and withdrawal of stale options?
- What evidence and owner approvals are required before commercial transactions are enabled?

These decisions should be recorded before dependent infrastructure or commerce work is authorized. No provider, cost, launch date, supplier, or manufacturing capability is inferred here.

## Proposed next milestone

**M6-A10 — Preproduction Scope and Readiness Definition (proposed).** The project owner and technical architect should agree on launch scope, target environment/topology, operational owners, provider decision process, and measurable private-environment acceptance gates. This unblocks a properly scoped preproduction implementation. It does not authorize a provider, deployment, or commerce build by itself.

See [Project Master Plan](PROJECT_MASTER_PLAN.md) for dependencies and [Codex Workflow](CODEX_WORKFLOW.md) for milestone execution.
