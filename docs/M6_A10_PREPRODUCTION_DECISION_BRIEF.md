# M6-A10 — Preproduction Decision Brief

**Evidence baseline:** Frontend `8cb4173b7925399dc848bee7b18cc71695ddd5b6`; adjacent Backend `df603654aaec03e4aeada20ab21d6e05803d8488`. These are repository baselines, not deployment evidence. The Frontend governance documents `PROJECT_MASTER_PLAN.md`, `DEVELOPMENT_STATUS.md`, and `LAUNCH_READINESS.md` contain older Frontend baselines; findings below were checked against the current pinned code and Backend documentation.

## 1. Verified engineering baseline

- Frontend is a Next.js 16, React 19, TypeScript application with public catalog, Guided and Creative Studio, Smart Perfumer, account/authentication UI, and saved concept flows. The account and concept flows integrate with the Backend. See [Frontend architecture](ARCHITECTURE.md), [API integration](API_INTEGRATION.md), and [development status](DEVELOPMENT_STATUS.md).
- Backend is a FastAPI service using Python 3.12, SQLAlchemy, Alembic, and PostgreSQL. Its `/health/live` is process liveness; `/health/ready` checks database access and the current migration head ([Backend `aroman/main.py`](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/aroman/main.py)).
- Backend supports `unconfigured` SMS, which returns 503 for challenge delivery, and explicitly enabled in-memory FakeSMS limited to development/test. The Kavenegar Lookup adapter is offline-only, has no live transport/runtime selection, and real delivery is inactive ([Backend SMS plan](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/docs/SMS_PROVIDER_PLAN.md)).
- PostgreSQL application/migrator role isolation, backup/restore behavior, and transport-security configuration have test coverage and milestone evidence. Their target-environment provisioning and operations remain unverified. Frontend CI has isolated SQLite and disposable PostgreSQL real-stack/browser journeys; Backend CI has disposable OTP PostgreSQL, role isolation, and backup/restore jobs. They do not establish operation of a private deployed environment ([Frontend CI](../.github/workflows/ci.yml), [Backend CI](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/.github/workflows/ci.yml)).
- Catalog entries are demo/conceptual data. Cart and checkout routes state that they do not create server-side carts, orders, or payments ([`src/app/cart/page.tsx`](../src/app/cart/page.tsx), [`src/app/checkout/page.tsx`](../src/app/checkout/page.tsx)). Neither Signature Collection nor Controlled Personalization is established as commercially ready; Smart Perfumer concepts are not manufacturing formulas ([Backend README](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/README.md), [Project Master Plan](PROJECT_MASTER_PLAN.md)).

## 2. Purpose and boundaries

A **private preproduction environment** is an owner-authorized, access-restricted deployment used to exercise a named release scope through its intended network path, with non-production data and secrets, operational monitoring, and rehearsed recovery. It is a place to gather evidence for a later release decision. It does not itself authorize public launch, real SMS activation, collection of real customer data, commerce, manufacturing, or any specific provider or hosting choice.

“Private” must be made measurable in the approved design: who can reach it, which routes are reachable, what data is allowed, who holds credentials, and who responds to alerts. Those choices are currently **OWNER DECISION REQUIRED**. If authentication is excluded, OTP routes must remain unavailable to users and no account or saved-concept data should be represented as operational. If accounts are included, the real OTP provider and all authentication gates in the readiness matrix apply.

## 3. Alternative release scopes

| Scope | User-facing capability | Readiness boundary |
| --- | --- | --- |
| **Public exploration without accounts or data persistence** | Public catalog and conceptual Studio exploration. It may use non-sensitive demo/catalog data. No login, saved concepts, user profiles, or persistent user submissions. | Requires a separately approved public exposure scope and public-service safeguards. It can be staged privately first. The current app has account routes, so scope must explicitly disable or remove access to those routes in a later approved implementation. Public catalog API exposure and demo-data copy must also be reviewed. No real OTP provider is required if authentication is not offered. |
| **Authentication and saved concepts with verified real OTP** | Account access and persistence of concepts for users. | Requires an owner-approved provider and approved real delivery activation, private delivery evidence, anti-abuse controls, infrastructure, privacy and operations gates. FakeSMS and synthetic OTP checks are not substitutes. Public authentication additionally requires public-service, privacy, support, and incident-response approval. |
| **Future commerce** | Purchase of physical products, potentially in Signature Collection and/or Controlled Personalization. | Separate scope and later commercial/operational approvals are required. Current code has no operational cart, checkout, orders, prices, stock, or payments. Product, manufacturing, safety, legal, fulfillment, pricing, support, and payment gates must be evidenced before commerce implementation or promises. |

The owner may select a narrow scope, combine compatible scopes, or defer release. No choice is implied by the current UI, roadmap, CI, or earlier product direction.

## 4. Dependency order — **proposed**

This is a proposed sequencing for review, not approval or authorization to implement.

1. Decide the first release scope, environment privacy boundary, allowed data, and whether accounts/real OTP or public access are included.
2. Decide the target topology and name accountable security, deployment, database, SMS (if applicable), monitoring, backup, and incident-response owners. Select recovery objectives and release acceptance criteria.
3. Implement the approved private environment foundation: isolated network, HTTPS/proxy/origins, secret delivery, PostgreSQL roles, migration/recovery procedures, monitoring, and deployment/rollback procedure.
4. If accounts are in scope, separately approve an SMS provider after technical, operational, cost, and compliance evidence; implement and verify its adapter and private delivery/failure/abuse behavior.
5. Rehearse only the approved scope end to end through the intended browser and infrastructure topology; close all applicable readiness-matrix blockers.
6. Seek a separate owner/architect decision for any public exposure. Seek a separate commercial gate before commerce or physical product claims.

## 5. Candidate component topology

The following is a component-level candidate only. It does not select a vendor, domain, region, network product, budget, or operational owner.

```text
Browser
  │ HTTPS (owner-approved frontend and API origins)
  ▼
HTTPS reverse proxy / ingress (sanitized forwarding headers)
  ├──> Private Next.js web service (pages / server rendering)
  └──> Private FastAPI API service ── runtime secret injection
            │ private DB connection  (least-privilege service identity)
            ▼
         PostgreSQL

Operations boundary: authorized operators, deployment/migration workflow,
health checks, redacted logs/metrics/alerts, backup and restore controls,
incident response and release/rollback procedure.
```

Browser traffic to the approved Frontend and API origins should go through authorized HTTPS ingress; neither the Next.js origin server nor the FastAPI origin server should be directly exposed. Whether they use one hostname or separate hostnames is an unresolved architecture decision. PostgreSQL should not be reachable from the browser and should accept connections only from approved service/operator paths. The proxy must remove untrusted forwarded headers before adding its own. Exact peers, ports, ingress rules, DNS, certificate lifecycle, secret system, and operator access must be specified by the approved target design. This candidate follows the Backend [transport-security guidance](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/docs/PREPRODUCTION_TRANSPORT_SECURITY.md); that guidance explicitly says no TLS listener, proxy, DNS, or firewall was exercised by its tests.

## 6. Owner decision register

Every item below is unresolved unless an owner records an explicit decision and scope. Decisions must not be inferred from historical preferences or examples.

| ID | Unresolved decision | Consequence if deferred | Dependency | Approval required |
| --- | --- | --- | --- | --- |
| D1 | Initial scope: private exploration only, public exploration, accounts/saved concepts, or commerce later? | Determines which routes/data and matrix gates apply; no implementation scope is authorized. | None | Project owner; architect records technical implications. |
| D2 | What makes preproduction private: access-control method, allowed users, routes, data class, and public reachability? | Cannot define or verify the privacy boundary. | D1 | Project owner and security/operations authority designated by owner. |
| D3 | Target hosting location, infrastructure architecture, network boundaries, and provider? | No infrastructure configuration or cost/operations model can be specified. | D1, D2 | Project owner; architect review. |
| D4 | Hostname/domain and DNS ownership; certificate issuance/renewal responsibility? | HTTPS/browser-origin acceptance cannot be fixed. | D3 | Project owner and designated DNS/certificate operator. |
| D5 | Reverse proxy/ingress behavior, exact CORS origin(s), trusted peer CIDRs, and cookie SameSite policy? | Proxy identity, cookies, CSRF, and rate-limit behavior cannot be validated end to end. | D3, D4; D1 if auth | Project owner approves exposed origins; architect specifies exact values; operator implements. |
| D6 | Database service, environment separation, application/migrator/operator identities, migration owner, and failed-migration recovery policy? | Least-privilege operations and schema recovery are undefined. | D3, D1 | Project owner assigns database owner; architect reviews. |
| D7 | Backup retention, RPO/RTO, encryption/key custody, restore authority, and rehearsal cadence? | Recovery cannot be judged or scheduled. | D6; D1 data scope | Project owner approves service objectives; database/operations owner proposes and accepts procedure. |
| D8 | Secret injection mechanism, service identities, access approval, rotation/revocation owner, and incident handling? | Credentials/peppers cannot be safely issued or lifecycle-managed. | D3, D6; D1 | Project owner designates security/operations owner; architect reviews boundaries. |
| D9 | Is real SMS required? If yes, which provider after evidence review, approved template, budget/cost authority, compliance terms, credentials and operations owner? | Accounts cannot be enabled for real users; current provider choices do not deliver real SMS. | D1; D3/D8 for activation | Explicit project-owner authorization after technical/commercial/compliance evidence; architect review. Kavenegar preference is not activation approval. |
| D10 | Monitoring/logging service, retention, alert thresholds, on-call/incident owner, support process, and response expectations? | No accountable response path or measurable operational acceptance. | D1, D3 | Project owner names accountable operations and incident roles. |
| D11 | Deployment/release owner, maintenance window, rollback authority, and acceptable downtime/data-loss policy? | A failed rollout cannot be operated safely. | D3, D6, D7, D10 | Project owner names release and recovery authorities. |
| D12 | Which product lines, if any, are in future commerce scope and who signs off on commercial/manufacturing gates? | No commerce scope, product claims, or transaction behavior may be represented as ready. | Separate from technical preproduction; D1 | Project owner plus qualified legal, safety, production, fulfillment, and commercial approvers as applicable. |

No provider, domain, budget, hosting location, or operational owner is selected in this brief.

## 7. Non-goals and security boundaries

- This brief does not authorize public deployment, provider procurement, live SMS, infrastructure creation, real data migration, commerce, or manufacturing.
- No credentials, secret values, private contact details, supplier details, unpublished infrastructure identifiers, or budget figures belong in these public repositories.
- Do not use FakeSMS, synthetic OTP fixtures, or CI-only sockets in a reachable environment. Backend configuration rejects FakeSMS in staging/production; the test runner’s private OTP socket is test infrastructure only ([Backend config](https://github.com/AromanCo/Backend/blob/df603654aaec03e4aeada20ab21d6e05803d8488/aroman/core/config.py), [Frontend real-stack runner](../scripts/real-stack-runner.mjs)).
- Treat all seeded products/brands and Studio outputs as demo/conceptual. They are not stock, validated formulations, safety approval, or a manufacturing offer.
- Private preproduction must use approved non-production data and secrets. Define whether any personal data is prohibited; absent that decision, assume no real user data is allowed.
- HTTPS/CORS are not network access controls. The API and database require explicit network isolation, authentication/authorization, secret controls, and operational monitoring.

## 8. Evidence for a later implementation milestone

The next implementation milestone should be proposed only after review of this brief and a recorded decision package containing:

1. Chosen release scope, explicitly excluded capabilities, and permitted data.
2. Approved component topology and access boundary, with owner-approved hostname/origin and operator responsibilities where applicable; no secrets in the record.
3. Named accountable owners for application release, database/migrations, secrets, backup/recovery, monitoring/incident response, and SMS if accounts are included.
4. Measurable acceptance criteria: allowed-origin behavior, network reachability, role grants, migration and recovery behavior, backup/restore objectives, health checks, logs/alerts, rollout/rollback, and browser journey.
5. If authentication is included: provider evaluation with current official documentation, approved activation scope, cost/compliance authorization, redacted sandbox evidence, and a plan for safe private delivery verification. Provider acceptance is not handset delivery proof.
6. If commerce is later considered: separate approved commercial scope and qualified evidence for each product line, regulatory/legal review, product safety/labeling, production/configuration authority, authoritative prices/availability, fulfillment/returns, customer support, and payment/order design.

Once those decisions are reviewed and approved, the architect and owner can authorize a narrowly scoped implementation milestone. This document itself is not that authorization. See [Readiness Matrix](M6_A10_READINESS_MATRIX.md) for the evidence gates.
