# AROMAN Project Master Plan

**Planning baseline:** Frontend `9bea6ff38473d54fcc8b9900611aa5433ebd93f3`; Backend `df603654aaec03e4aeada20ab21d6e05803d8488`. This plan records repository evidence at those revisions. Roadmap items are proposals until separately approved.

## 1. Product vision and intended market

AROMAN is a Persian-first fragrance exploration and personalization platform intended for Iran. The current application helps people discover a catalog, explore fragrance ideas in Guided and Creative Studios, receive conceptual Smart Perfumer suggestions, and save fragrance concepts to an account.

The product direction also includes two future physical product lines: **B — AROMAN Signature Collection**, and **C — AROMAN Controlled Personalization**. Direction is not evidence of a product, supplier, production process, legal eligibility, safety review, or launch readiness.

## 2. Product boundaries

### Implemented product experience

- The public catalog supports fragrance exploration.
- Guided Studio presents editorial recommendations based on catalog data.
- Creative Studio supports conceptual composition and saved concepts.
- Smart Perfumer offers conceptual suggestions. Suggestions are not formulation instructions or certification of ingredient compatibility, safety, or manufacturability.
- Account authentication and saved concepts are implemented against the Backend API.
- Commerce routes remain placeholders. The repository does not establish live prices, stock, cart persistence, checkout, orders, or payment processing.

### Approved product direction

Product-owner direction recorded in the product documents identifies Iran as the intended initial market and B/C as intended product lines. B means AROMAN-branded finished perfumes. C means customization within future documented and approved production options.

### Proposed future capabilities

- B would require verified products, variants, provenance, approved product copy and media, price, availability, fulfillment, and order handling.
- C would require versioned configurations and options approved by accountable qualified production partners, current availability, a way to withdraw stale options, and an authoritative quote/production interface.
- No current Studio concept, note identifier, or Smart Perfumer response is a production specification. No B or C product is established as available.

## 3. Current architecture

### Frontend

The Frontend is a Next.js 16 App Router application using React 19 and TypeScript. Public pages use Server Components where appropriate; interactive Studio, account, and authentication flows use focused Client Components. The interface is Persian-first and RTL.

A centralized browser API client uses generated OpenAPI types. The browser calls the FastAPI API with credentialed requests. Authentication session restoration and CSRF token handling are documented in the architecture reference; private session state is not stored in browser storage. The commerce routes are placeholders.

### Backend

The adjacent Backend is a FastAPI service using Python 3.12, SQLAlchemy, Alembic, and PostgreSQL. It owns catalog, authentication/session, and saved concept data. Its readiness endpoint checks database connectivity and migration state. The current SMS setting supports an unconfigured mode and test-only FakeSMS; the Kavenegar Lookup adapter is offline-only.

### Integration and verification

The Frontend pins the Backend commit in `scripts/backend-pin.mjs` and CI. Contract checks compare the pinned service's OpenAPI schema with the committed snapshot and generated types. CI defines isolated SQLite and disposable PostgreSQL 17 real-stack browser journeys; additional checks cover PostgreSQL transaction behavior and synthetic cross-browser journeys. These checks exercise test environments and do not establish production infrastructure.

## 4. Implementation history and completed capabilities

The repositories' commit histories and milestone documentation establish these completed milestones:

| Repository | Completed milestone | Recorded result |
| --- | --- | --- |
| Backend | M6-A4B | OTP delivery reservation transaction safety and PostgreSQL-focused verification. |
| Backend | M6-A6A/A6B | Offline Kavenegar Lookup adapter and end-to-end regression coverage. |
| Backend | M6-A7A/A7A-R1 | PostgreSQL application/migrator role isolation and hardening checks. |
| Backend | M6-A7B | Disposable PostgreSQL backup and restore rehearsal. |
| Backend | M6-A7C, PR #23 | Transport-security configuration hardening; merged to `develop`. |
| Frontend | Earlier M1–M5 work | Main application foundation, authentication and saved concepts, Guided and Creative Studio journeys, Smart Perfumer experience, API contract checks, browser coverage, and real-stack integration gates. See the milestone references below. |
| Frontend | M6-A8, PR #32 | Backend pin refresh to the M6-A7C Backend commit; merged to `develop`. |

The repository history records the PR merges. CI success is reported by the supplied milestone context; it does not prove a currently deployed release or real-world operation.

## 5. Decisions and historical proposals

### Recorded product-owner direction

- Intended initial market: Iran.
- Intended lines: B — Signature Collection and C — Controlled Personalization.
- Product direction documents explicitly say these decisions do not establish production capability or authorize launch.

### Technical boundaries evidenced by current implementation and docs

- Backend remains authoritative for catalog, authentication/session, and saved concepts.
- FakeSMS is test tooling and is not a live SMS service.
- The Kavenegar adapter is explicitly offline-only. Earlier preference for Kavenegar does not constitute an approved active provider integration.
- Studios and Smart Perfumer provide exploration and conceptual guidance, not physical-product qualification.

### Historical proposals, not approvals

Older plans and decision records include research, product sequencing, pricing assumptions, supplier and manufacturing research, architecture options, and possible commerce flows. A proposal, hypothesis, supplier statement, or research plan is not proof of feasibility or an authorization to spend, contact suppliers, manufacture, or launch. Consult the current decision records before treating a proposal as approved.

## 6. Remaining technical dependencies

Before offering public authentication or storing user data in a production-like environment, the Backend's current guidance calls for:

- A real SMS provider decision and integration, delivery/failure evidence, abuse controls, and operational ownership. Real SMS is currently inactive.
- Intended production PostgreSQL provisioning with separate least-privilege application and migration identities.
- A production backup, retention, recovery target, and restore process validated on the intended service.
- HTTPS termination, exact browser origins, trusted proxy configuration, secure cookies, CSRF behavior, and private API/database network boundaries exercised through the intended topology.
- Secret delivery, access control, rotation, and incident procedures for database credentials and authentication peppers.
- A deployment, migration, health-check, rollback, logging, monitoring, alerting, and incident response runbook.
- Verification that test-only FakeSMS and OTP access cannot be reached from a public environment.
- Rate-limit and proxy behavior validated across the intended deployment topology.

Before commerce, additional dependencies include product and market decisions, jurisdiction-specific legal review, verified product/supply evidence, approved claims and media, safety and labeling review by qualified parties, fulfillment and returns, pricing and inventory sources, and an approved payment/order design. No such operational capability should be inferred from the current code.

## 7. Production and commercial readiness

Treat these as separate gates:

1. **Software verification:** local checks and CI pass for a specific revision.
2. **Private environment readiness:** intended infrastructure, secrets, real provider, permissions, HTTPS/proxy behavior, recovery, and monitoring are configured and rehearsed.
3. **Public service readiness:** owner-approved scope, operational ownership, support, incident response, privacy/security review, and release/rollback evidence exist.
4. **Commercial readiness:** for each physical product line in launch scope, qualified evidence exists for products/configurations, production, safety and labeling, legal eligibility, pricing, availability, fulfillment, returns, and customer communications.

Passing one gate does not imply passing the next. Successful CI does not prove deployment, live SMS delivery, commercial availability, or manufacturing feasibility.

## 8. Proposed development roadmap

This sequence is a recommendation, not an approved commitment. Each item needs a scoped milestone and acceptance criteria.

| Order | Proposed milestone | Depends on | Completion evidence |
| --- | --- | --- | --- |
| 1 | Owner and architect define target environment and launch scope: public exploration only, authentication/data persistence, and/or commerce. Name operational owners and decide whether production SMS is in scope. | Owner decisions | Recorded scope, topology, owners, and acceptance gates. |
| 2 | Private preproduction foundation: provision intended database roles and secrets, configure HTTPS/proxy/origins, and rehearse migrations, backup/restore, monitoring, and rollback. | 1 | Evidence from the intended isolated environment, with no production secrets in Git. |
| 3 | Real OTP delivery integration and abuse-control rehearsal, if account authentication is in approved launch scope. | 1; provider and operational owner decision | Provider approved by owner, private delivery tests, failure/limit checks, and documented operations. |
| 4 | Private end-to-end release rehearsal for the approved technical scope. | 2; 3 if authentication is included | Browser smoke checks through intended origins, health checks, monitoring, recovery and rollback evidence. |
| 5 | Separate B and C feasibility/product gates, then commerce implementation only for approved, evidenced scope. | Owner's B/C scope and qualified external evidence | Product-line-specific approvals, verified authoritative catalog/configuration data, and commercial operations acceptance. |

The next engineering milestone should be **M6-A10 (proposed): Preproduction Scope and Readiness Definition**: turn step 1 into an owner-approved target topology, launch scope, named operational responsibilities, and measurable acceptance gates. It should not implement provider or infrastructure choices until the owner resolves those decisions.

## 9. Main risks and architecture principles

- **Concept-to-product confusion:** label recommendations as conceptual and keep production eligibility sourced from approved, current production data.
- **False operational confidence:** report exactly what CI and local rehearsals exercise; distinguish mocks, disposable services, and actual deployment evidence.
- **Authentication exposure:** keep test-only OTP access isolated; use exact origins, secure cookies, CSRF protections, rate limits, and private secrets in the intended deployment.
- **Data recovery and permissions:** validate least privilege, backup access, restore ownership, and application behavior on the target database service.
- **Unverified commercial claims:** do not publish product, safety, price, stock, manufacturing, provider, or launch claims without appropriate evidence and approval.
- **Contract drift:** retain the pinned Backend/OpenAPI/generated-type checks and deliberately review changes to contracts and migrations.
- **Persian RTL quality:** preserve RTL behavior, keyboard access, responsive behavior, and browser coverage as product flows change.

## 10. Authoritative references

Frontend references:

- [Architecture](ARCHITECTURE.md)
- [Development setup and test boundaries](DEVELOPMENT.md)
- [API integration](API_INTEGRATION.md)
- [Launch readiness audit](LAUNCH_READINESS.md) — its recorded scope uses older Frontend/Backend SHAs; revalidate findings against current baselines before relying on them as current.
- [Product decisions](M1E1_PRODUCT_DECISIONS.md)
- [Product direction](M1E2_PRODUCT_DIRECTION.md)
- [Personalization architecture proposal](M1E2_PERSONALIZATION_ARCHITECTURE.md)
- [Smart Perfumer specification](M1E2_SMART_PERFUMER_SPEC.md)
- [Production go/no-go record](M1F_PRODUCTION_GO_NO_GO.md)

Backend references at the pinned Backend baseline:

- `README.md`
- `docs/API_CONTRACT.md`
- `docs/FRONTEND_INTEGRATION.md`
- `docs/SMS_PROVIDER_PLAN.md`
- `docs/PREPRODUCTION_DATABASE.md`
- `docs/POSTGRES_BACKUP_RESTORE.md`
- `docs/PREPRODUCTION_TRANSPORT_SECURITY.md`

The Backend references are in the adjacent `Aroman/Backend` repository, not this repository; paths above are repository-relative.
