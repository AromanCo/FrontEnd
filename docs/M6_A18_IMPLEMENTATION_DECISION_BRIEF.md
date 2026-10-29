# M6-A18 — Implementation Decision Brief

**Status: owner decision package for review. No architecture, provider, region, hostname, budget, infrastructure, or implementation phase is approved.** M6-A15 D1–D12 remain open unless the owner separately records a decision. The permission to evaluate a publicly reachable identity gateway permits comparison only.

## Decision requested now

The smallest useful decision set before a bounded implementation milestone is:

1. **D1 — scope and audience:** confirm or revise synthetic/demo exploration, allowed UI/catalog routes, named tester categories and exclusions (no AROMAN accounts/OTP, persistence, user data, SMS, or commerce).
2. **D2 — access boundary:** explicitly state whether a public identity gateway is acceptable as the only public application edge, and approve individual identity/MFA, eligibility, invitation/verification, revocation and session requirements. If not, direct the design toward VPN/private-only access or defer.
3. **D3–D8 and D10–D11 — bounded foundation authority:** decide that the candidate design may be worked into a provider-neutral implementation plan, nominate accountable roles, and set approval requirements for hosting/network, hostname/ingress, database, recovery, secrets, operations and release/rollback. Detailed values and provider selection remain for a later written implementation authorization.

If “authorize an implementation milestone” means actual infrastructure or code changes, D3–D8 and D10–D11 must be closed with concrete owner-approved values and authority before that work starts. The immediate next milestone can remain documentation/design only. The current technical gap is G1: no same-origin catalog routing path is configured. A narrowly allowlisted Next.js BFF and gateway/ingress path routing are both candidates; new application code is required only if the BFF option (or another app-side control) is selected. Either option needs acceptance coverage (see the [API path audit](M6_A18_BROWSER_API_PATH_AUDIT.md)).

## D1–D12 carry-forward

| Decision | M6-A15 question and status carried forward | Scope preference versus approval |
| --- | --- | --- |
| **D1 — scope** | Private exploration scope, audience, exact UI/API routes, synthetic data, exclusions and separation from later phases. **Open.** | Current planning scenario is a preference/input, not an owner closure. Explicit approval required. |
| **D2 — access boundary** | Acceptable reachability/access method; public gateway versus private/VPN; audience eligibility, identity verification, revocation and permitted data. **Open.** | Owner permits evaluation of a public identity gateway under individual MFA, scoped access, private origins and no bypass. This is not gateway, provider or deployment approval. |
| **D3 — hosting/network** | Architecture, environment, region/provider, network boundaries, cost ceiling and spending authority, or defer. **Open.** | Candidate topology is a recommendation for review, not provider/region/cost selection. |
| **D4 — domain/TLS** | Hostname, DNS and certificate ownership, issuance and renewal. **Open.** | No domain or certificate authority chosen. |
| **D5 — ingress/origins** | Ingress/proxy, exact origins, trusted peers, forwarding headers and browser cookie relationship. **Open.** | Same-origin routing is a candidate requirement; BFF versus gateway/ingress path routing, exact origin and ingress remain unapproved. |
| **D6 — database** | Service/environment, runtime and migrator identities, migration owner, grants and recovery relationship. **Open.** | PostgreSQL runtime SELECT-only and separate migrator are security requirements/recommendations; no service selected. |
| **D7 — recovery** | Backup disposition, retention, encryption/key custody, numeric RPO/RTO, restore authority and cadence or justified ephemeral-data policy. **Open.** | No value or retention selected. |
| **D8 — secrets** | Service identities, delivery, access, rotation/revocation, break-glass and incident ownership. **Open.** | Protected injection and separation are requirements; no mechanism selected. |
| **D9 — real SMS/OTP** | Explicitly decide no SMS/OTP in evaluation or separately approve future scope and controls. **Open; excluded from current proposal.** | Exclusion is proposed scope, not authorization to activate; keep no SMS/OTP. |
| **D10 — operations** | Logs/monitoring, retention, thresholds, alert/on-call/incident roles and support expectations. **Open.** | No service, retention, thresholds or operator selected. |
| **D11 — release/recovery** | Release owner, maintenance window, rollback authority, downtime and data-loss limits. **Open.** | No deployment or start window authorized. |
| **D12 — commerce** | Future product lines and qualified commercial/manufacturing approvals. **Open, independent and out of scope.** | No commerce scope or product approval implied. |

## Conditional recommendation

If D2 accepts an internet-reachable identity edge, carry the candidate in [reference architecture](M6_A18_REFERENCE_ARCHITECTURE.md) forward: gateway edge with same-origin `/api/v1` routing to the private restricted API and other paths to the private Frontend, with the Next.js BFF as an alternative enforcement/routing design. Compare request-by-request authorization, exact route/method allowlisting, cookie and header stripping, normalization, errors, fail-closed behavior, private peer restrictions, operations and test evidence before selection. The gateway must consume its authentication cookie but must not pass unnecessary gateway credentials, Authorization tokens or identity assertions to the catalog API. A public gateway does not establish that the API path is protected; verify auth on every API request and independently probe the API origin. Require individual MFA, per-person authorization, active-session revocation, private origins and direct-origin denial.

If D2 rejects any public app-facing edge, evaluate VPN/private access with tightly scoped per-user routes, client/device lifecycle and equivalent browser-to-private-Frontend routing. If the owner requires independent network and identity barriers and can staff the added policy/incident burden, evaluate a hybrid. M6-A17 contains the full option comparison; no numeric scoring is appropriate until the audience, controls and candidate-specific evidence are known.

The recommendation is conditional because the public edge remains internet-reachable and gateway processing includes identity data. An alternative private-only boundary may better match a strict “nothing public” interpretation but adds tester setup and network operations. The hybrid can reduce reliance on one layer only when controls are independently administered and tested; complexity and correlated control-plane failures can offset this benefit.

## Before authorizing implementation

The owner should record, with approver and date:

- D1–D2 scope/audience and accepted privacy/reachability boundary.
- D3 candidate environment/network constraints, approved spend ceiling and procurement authority (without choosing a provider in this brief).
- D4–D5 domain/TLS, ingress, exact origins, peers, ports and trusted header/cookie contract.
- D6 database service decision, runtime SELECT-only grant owner and separate migration authority.
- D7 numeric recovery objectives or reasoned ephemeral-data disposition; retention and restore responsibility.
- D8 secret delivery/rotation/revocation and incident owner.
- D10 named operational and privacy responsibilities, monitoring/log policy, alerting and support coverage.
- D11 named release/rollback authority, maintenance window, downtime/data-loss limits and phase stop conditions.
- A written phase-limited authorization identifying permitted work, environment boundary, cost ceiling, reviewers, required evidence, start/end conditions and explicit prohibition on broader exposure.

D9 stays outside the phase; D12 stays separate. A decision to develop a plan is not authority to provision, configure DNS, purchase services, expose ports, invite testers or deploy. Architecture acceptance is separate from implementation authorization and from target acceptance/public operation. Do not publish these documents to Git until architectural review is complete.

## Residual blockers

- **Application path:** no same-origin catalog routing path is configured. A relative browser base such as `/api/v1` may work with gateway/ingress path routing without new application code, but this is unimplemented and untested. The client falls back to `http://localhost:8000/api/v1`; a future compiled exploration build must use an explicitly reviewed browser base and fail its build/release gate if unset, localhost, or unapproved. The BFF remains a candidate if gateway path routing is not selected or cannot enforce the required boundary.
- **API path authorization:** a gateway's public edge, login page, or same-origin URL does not prove each `/api/v1` request is authorized. Require identity/session enforcement per API request and separate direct-origin network probes. Strip the gateway auth cookie and do not forward unnecessary gateway credentials, Authorization tokens or identity assertions to the restricted catalog API.
- **Deployment boundary:** no evidence of deployed gateway-only ingress, private Frontend/API/database origins, absence of alternate origins, or denial from unauthorized peers.
- **Identity/security:** no chosen/verified MFA, invitation, role, session expiry, active revocation or outage behavior. Owner-set expiry and revocation values are missing.
- **Data and operations:** no privacy decision for gateway identity processing, PostgreSQL target grants, migration isolation, secret delivery, backup/recovery objectives, monitoring/incident roles or rollback authority.
- **Evidence:** repository tests cover code and loopback fixtures only; target browser, network, identity, database and operations acceptance remain unrun and require a separately authorized environment.

## Review state

Requested outcome: owner and architecture review of the three-document package, then record decisions and close gaps before any implementation proposal. This package itself makes no approvals and authorizes no Git publishing, provisioning, user-data collection, SMS or commerce.
