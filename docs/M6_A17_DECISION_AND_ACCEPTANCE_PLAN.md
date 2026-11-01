# M6-A17 — Decision and Acceptance Plan

**Status: decision framework and proposed tests for review. Architecture acceptance is separate from deployment authorization.** No provider, architecture, location, domain, budget, or operation is approved. See the [architecture comparison](M6_A17_ACCESS_ARCHITECTURE_COMPARISON.md) and [identity and security model](M6_A17_IDENTITY_AND_SECURITY_MODEL.md).

## Baseline and governing scope

- Frontend baseline: `a2cfae07bf8898e916bf036c73581041f613f8ff`, branch `docs/m6-a17-private-access-architecture`.
- Backend baseline: `0be24c4597bd693e70348243c26e550a20a8ad0e`.
- Planning scenario: private exploration with synthetic/demo fragrance data; catalog, Guided Studio, Creative Studio, and Smart Perfumer; owner, authorized developers, and individually invited external testers.
- Only `aroman.exploration_api:app` serves the five catalog GET route templates. AROMAN application authentication, OTP/SMS, persistent concepts, commerce, payments, and real user data remain excluded.
- The full `aroman.main:app`, PostgreSQL, secrets, deployment systems, and management interfaces remain inaccessible to unauthorized users.
- M6-A15 D1–D12 remain open. The owner's agreement that a public identity gateway may be evaluated is permission to compare the pattern, not selection or deployment approval.

## Neutral comparison matrix

Scores are deliberately not assigned: capability depends on the specific candidate and current environment. Resolve each row with evidence and the owner-approved audience and threat assumptions.

| Criterion | VPN/private network | Public identity-protected gateway | Hybrid |
| --- | --- | --- | --- |
| Application public reachability | Intended private origins; verify control-plane exposure | Public gateway edge; all upstream origins private | Depends on gateway edge; private service origins |
| Individual MFA / attributable identity | Must verify for each enrolled user | Must verify per invited identity and role | Must verify consistently at identity layer and network enrollment if used |
| Least-privilege app access | Requires app/network route scoping; VPN alone may be broad | App-scoped policy and narrow upstream | App policy plus independent peer/network restrictions |
| Tester setup | Client/device enrollment and support | Browser identity/MFA flow | Browser only or client plus browser, depending on choice |
| Revocation behavior | Remove identity/device/routes and active tunnel/session | Deny identity and invalidate gateway sessions/tokens | Revoke both identity session and network/device grant |
| Direct-origin defense | Private routing plus peer rules | Gateway-only origin ingress, no alternate listeners | Both gateway-only ingress and network restrictions |
| Failure domains | Access control plane, tunnel, route/DNS | Gateway, identity service, policy, public edge | Both sets plus integration/policy drift |
| Identity-data processing | Depends on enrollment/auth service; assess fields and retention | Gateway/identity may process identifiers, MFA, device and auth metadata | Combined processing; map duplication and retention |
| Operational work | Client, routes, network, access lifecycle | Identity, gateway, sessions, privacy, origin policy | Highest coordination and audit burden |
| Cost inputs | Network, capacity, support, logging, labor | Gateway/identity usage, edge, logs, support, labor | Combination and integration; avoid double-counting shared capacity |
| M6-A15 evidence | Network probes, identity lifecycle, browser path | Identity/session tests, private-origin and bypass tests | All relevant evidence independently across both controls |

A public identity gateway is an internet-reachable component even when its application origin is private. The owner must state whether this satisfies the intended privacy boundary. CORS is not an access-control substitute.

## Unresolved owner choices and dependencies

Preserve the following M6-A15 register status; this study proposes no closures:

| Decision | Still-open choice relevant to this study | Dependency before implementation |
| --- | --- | --- |
| **D1** Scope | Confirm private exploration, audience, exact UI/API routes, synthetic data, exclusions, and later-scope separation. | Scope approval before applying gates. |
| **D2** Access boundary | Choose acceptable reachability and access method, including whether a public identity gateway is acceptable; approve eligibility, identity verification, revocation, permitted data. | Must precede topology-specific acceptance. |
| **D3** Hosting/network | Select candidate architecture, environment/location/provider and network boundaries or defer. | Peer/port, data-flow, failure-domain and cost study. |
| **D4** Domain/TLS | Decide hostname/DNS and certificate ownership/renewal. | Needed for exact origins and TLS tests. |
| **D5** Ingress/origins | Approve ingress/proxy, exact origins, trusted peers, forwarding headers and cookie relationship. | Needed before route and browser tests. |
| **D6** Database | Decide service/environment, app and migrator identities, migration owner and recovery. | Needed before runtime grant and migration evidence. |
| **D7** Recovery | Set retention, encryption/key custody, numeric RPO/RTO, restore authority/cadence or explicitly justified ephemeral-data disposition. | Needed before backup/restore and rollback acceptance. |
| **D8** Secrets | Approve service identities, delivery, access, rotation/revocation and incident owner. | Needed before runtime operation. |
| **D9** Real SMS | Remains outside scope; explicitly defer/not in scope for this evaluation. No SMS activation. | Separate explicit decision and gates if later reconsidered. |
| **D10** Operations | Assign logs/monitoring, retention, thresholds, alert/on-call and incident roles. | Needed before audience access. |
| **D11** Release/recovery | Assign release and rollback authority, maintenance window, downtime/data-loss limits. | Needed before deployment authorization. |
| **D12** Commerce | Separate future decision; no commerce/payment scope. | Independent product and qualified approval gates. |

The audience and synthetic-data scenario are planning inputs, not closures of D1 or D2. Identity-provider processing of personal data requires privacy review even if the AROMAN application stores none.

## Technical dependencies and design evidence

Before any implementation proposal, the architect and owner should record: (1) trust-boundary and data-flow diagram for selected candidate; (2) public/private component inventory; (3) peer/port matrix and denied paths; (4) browser-to-Frontend-to-restricted-API routing; (5) proof the Frontend/API/database origins have no bypass; (6) identity/role and session lifecycle; (7) exact five-route and method allowlist; (8) actual process target; (9) database object grants and separate migrator; (10) secret flow; (11) identity-data inventory, purpose, processor/storage locations and retention; (12) monitoring, incident, recovery and responsibility matrix; and (13) target acceptance evidence owner. Any new AROMAN identity, OTP, write, persistence, public catalog, or commerce requirement changes scope and requires a separate decision/gate set.

M6-A14 repository tests establish only local/CI behavior. They do not prove live identity policy, MFA enforcement, network segmentation, TLS, deployed origins, database grants, secret custody, log handling, revocation, backup, operations, or target browser behavior.

## Indicative cost-estimation assumptions

Do not insert assumed vendor rates or a synthetic total. Once candidates and requirements are known, estimate comparable evaluation-window and monthly costs with the same audience, traffic, retention, and support assumptions. Include:

- Named users, external tester count, MFA method/transaction volume, identity verification and recovery workload.
- Gateway/access seats, requests, bandwidth, egress, private network/control-plane capacity, DNS and certificate lifecycle.
- Frontend/API compute, database size/availability, storage, backup, restore tests, monitoring, audit-log ingestion and retention.
- Support/availability tier, security/privacy review, incident coverage, patching, operator hours, onboarding/offboarding and tester support.
- Data location constraints, redundancy, recovery objectives, evaluation duration, teardown/deletion, minimum commitments, usage thresholds and overage exposure.
- Existing capacity separately from incremental cost; identify assumptions that require current vendor quotes and owner confirmation.

The owner sets a spending ceiling and recurring-cost authority under D3/D10/D11 before any procurement or activation. This document authorizes neither.

## Risks and mitigations

| Risk | Candidate mitigation and evidence |
| --- | --- |
| Public edge mistaken for private service | Explicitly record gateway reachability; keep upstream private and gateway-only; test direct-origin paths from external and unauthorized peers. |
| Shared/broad identities or weak invitation binding | Individual identities, independent invitation approval, MFA, identity verification, role separation, single-use expiry, roster review and audit tests. |
| Active session survives removal | Revoke identity, roles and active sessions/tokens; repeat request with old browser and token; require denial within approved target. |
| Direct API/full-app/database bypass | Private origins, peer allowlists, firewall segmentation, restricted process target, route/method allowlist and independent network probes. |
| Gateway/identity outage allows fallback | Fail closed; no alternate origin/login or permissive cache; test outage and controlled recovery. |
| Gateway handles overlooked personal data | Inventory identity and telemetry fields/processors/locations; minimize, approve purpose and retention, restrict access, test redaction/deletion. |
| Over-broad forwarding headers or CORS | Strip/rewrite at trusted proxy, trust immediate peers only; exact CORS; spoofing tests and separate network-denial evidence. |
| VPN grants lateral access or gateway policy drifts | Scope routes and application authorization; independently review effective peer/port matrix and periodic access policy. |
| Complexity/cost exceeds evaluation need | Compare consistent workload and labor assumptions; owner-set cap and expiry; stop if thresholds exceeded. |
| Scope drifts into auth, persistence, real data, or commerce | Route/UI/database checks, synthetic-data confirmation, zero prohibited records, stop conditions, new owner decision and gates. |

## Measurable acceptance plan mapped to M6-A15

Run these only after separate implementation authorization, in the owner-selected isolated target. For each test capture timestamp, app and infrastructure revision, non-secret topology/config identifier, role, method, expected/actual result, redacted evidence, operator and reviewer. No unexplained failure passes. Tests must not create public infrastructure as part of this documentation task.

| Test | Procedure and measurable pass condition | M6-A15 mapping |
| --- | --- | --- |
| Invitation and onboarding | Invite a test identity through the approved flow; verify independent approval, intended identity binding, single use, expiry and role; reject forwarded/reused/expired invitation; record only minimum verification outcome. | Scope/data; identity lifecycle supporting D1/D2. |
| MFA | Attempt access without MFA and with failed/expired challenge; both deny. Complete supported MFA for each human role; access is attributable to individual. Exercise recovery under approved procedure. | Network isolation and browser journey; D2/D5. |
| Role separation | Tester can complete exploration only; cannot access admin, DB, deployment, secrets or other control paths. Verify developer/operator/administrator permissions against approved matrix. | Network isolation, restricted routing, secrets; D2/D6/D8. |
| Unauthorized requests | From two unauthorized locations/identities selected in the approved test plan, probe app/API origins and disallowed paths; no protected handler/data response. Only approved ingress responds. | Network isolation; restricted catalog routing. |
| Revocation of active sessions | Authenticate, retain active browser/session and token, revoke identity, role and session, then retry with old and fresh clients. All attempts deny within owner-approved revocation target; record elapsed time. | Network isolation and scope; D2/D5. |
| Expiration | Grant a time-bounded identity, verify access before expiry and denial after expiry without manual action; verify sessions cannot silently renew past grant expiry. | Scope and network isolation; D2/D10. |
| Direct-origin and API bypass | From external and unauthorized peer networks, try Frontend/API alternate addresses, direct catalog API calls, nonstandard ports and any preview/debug origin; all deny. Confirm only gateway/approved private ingress reaches Frontend and API only receives documented peer. | Network isolation; restricted catalog routing; origin restrictions. |
| Restricted API methods | Through intended path, exactly five catalog GET route templates succeed. POST/PUT/PATCH/DELETE/HEAD/OPTIONS, unknown/trailing-slash/encoded paths, auth/OTP/user/concept/health/docs/OpenAPI fail; process target is exactly `aroman.exploration_api:app`. | Restricted catalog routing; scope and synthetic data. |
| Network segmentation | From approved client and service peers, prove only documented peer/port matrix connects. PostgreSQL accepts only API and separately approved operations/migration peers. Full `aroman.main:app`, management, deployment, and secrets are inaccessible to testers; API cannot reach unrelated peers. | Network isolation; database grants; secrets. |
| Gateway or identity failure | Disable or isolate gateway, identity, and policy dependency in controlled target rehearsal. New requests and required authorization checks fail closed; no direct fallback, cached permissive access, full Backend route, or session extension occurs. | Network isolation; monitoring/incident handling. |
| Recovery | Restore dependency and policy from approved procedure; verify authorization state, revocation and audit continuity, then rerun restricted-route and browser smoke checks. Recovery only reopens intended access. | Rollback/recovery; monitoring/incident handling. |
| HTTPS, headers, CORS | Validate hostname/certificate/HTTPS and HTTP behavior; test spoofed, malformed and duplicated forwarding/identity headers; exact allowed origins work and unrelated origins receive no allow-origin header. Separate direct-client probes show CORS is not relied on for denial. | HTTPS/proxy; origin restrictions. |
| Database/migration/secrets | As actual runtime identity, required catalog SELECT succeeds and writes, DDL, prohibited table reads and escalation fail. Migration identity is separate. Canary secret is absent from artifacts/logs and unauthorized retrieval fails; rotation/revocation succeeds. | Database SELECT-only; migration controls; secrets. |
| Identity-data handling | Inventory observed identity fields and subprocessors; demonstrate approved access controls, audit, redaction, retention/deletion behavior, and no identity data in AROMAN catalog records or general app logs. | Monitoring/logging; scope and privacy boundary. |
| Complete browser journey | Clean supported browser completes catalog, product detail, Guided Studio, Creative Studio and Smart Perfumer on approved HTTPS origin; only allowlisted catalog requests occur; no auth/user/concept persistence, unexpected external call, secret leakage or bypass. | Scope/synthetic data; browser end-to-end through intended path. |

Also apply the remaining M6-A15 target gates: backup/restore against D7-approved disposition and RPO/RTO; migration failure rehearsal; alert delivery/tabletop under D10; second-operator rollback/recovery under D11. No local CI result substitutes for these target tests.

## Decision and authorization sequence

1. **Architecture review:** Owner and architect compare candidates, resolve the meaning of private reachability, identify identity-data processing, choose no architecture yet or record a candidate preference, and keep D1–D12 open until explicitly decided by their owners. Architecture acceptance records assumptions, residual risks, and test plan.
2. **Decision closure:** Before implementation, record applicable D1–D8 and D10–D11 decisions with approver, date, scope, evidence, spending authority, and named accountable roles. D9 remains out of scope; D12 remains separate.
3. **Implementation authorization:** A distinct owner authorization names the selected environment and provider (if any), location, domain, budget ceiling, phase boundary, operators, and allowed actions. Architecture acceptance alone grants no authority to provision, purchase, configure DNS, expose ports, deploy, or access production resources.
4. **Target acceptance:** Execute and review every applicable M6-A15 gate in the selected topology. Any failure or material topology/scope change returns to design review. Private evaluation remains no-go until evidence is accepted and the owner separately authorizes its start and time window.

This M6-A17 package itself authorizes documentation only. It does not authorize infrastructure changes or Git publishing; wait for architectural review before Git publishing.
