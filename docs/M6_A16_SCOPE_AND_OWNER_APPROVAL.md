# M6-A16 — Scope and Owner Approval

**Status: proposal for architectural and owner review. No environment, infrastructure, access method, spend, or operation is authorized by this document.**

## Evidence baseline

- Frontend worktree: `docs/m6-a16-private-exploration-decision-package`, HEAD `dfc9041807749d46be55466fc4afb0dd1df98e8d`.
- Backend integration pin: `0be24c4597bd693e70348243c26e550a20a8ad0e` (`scripts/backend-pin.mjs`).
- M6-A14 repository integration evidence and M6-A15 gate definitions are described in [M6-A14 integration](M6_A14_PRIVATE_EXPLORATION_INTEGRATION.md) and [M6-A15 readiness](M6_A15_PREPRODUCTION_READINESS.md). They do not establish a deployed environment.

## Proposed first release scope

The working scenario for planning is a **private, non-production exploration release** using synthetic/demo fragrance catalog data and the existing exploration experience:

- Catalog browsing, product detail, Guided Studio, Creative Studio, and Smart Perfumer as conceptual exploration features.
- Backend process target restricted to `aroman.exploration_api:app`, with only the five catalog GET route templates documented by M6-A14: brands, products, product variants, fragrance families, and fragrance notes.
- Synthetic/demo catalog rows only. Studio inputs and outputs remain transient to the browsing session; Guided-to-Creative transfer may remain in-memory and is not a saved concept.
- A planning audience consisting of the project owner, authorized development team members, and selected external testers admitted by individual invitation. Final identities, access method, and boundary remain subject to approval before any environment work.
- No public deployment or public access. “Private” is not yet defined as a particular network or identity mechanism.

This defines a candidate scope for evaluation, not a final owner decision. Operation remains no-go until the applicable owner decisions and target acceptance gates are approved and evidenced.

## Explicit exclusions

The first scope excludes:

- Real user authentication, accounts, sessions, OTP routes or delivery, SMS provider activation, and real user submissions.
- Persistent concepts, profiles, user records, or any database writes from the exploration application.
- Cart, checkout, orders, payments, inventory, fulfillment, or commerce claims.
- Production formula, ingredient compatibility, safety, manufacturing, or product availability claims based on Studio or Smart Perfumer output.
- Public deployment, public catalog/API access, real customer data, provider procurement, or infrastructure activation under this proposal.
- The unrestricted `aroman.main:app` entry point on any route reachable by exploration clients; network and ingress controls must also prevent bypass of the restricted target.

The later implementation must make excluded UI and endpoints unavailable and demonstrate zero user, OTP, session, and saved-concept records, as required by the [A15 acceptance gates](M6_A15_ACCEPTANCE_GATES.md).

## Proposed data policy for review

| Data class | Proposed handling | Approval still required |
| --- | --- | --- |
| Catalog | Synthetic/demo fragrance, brand, family, note, product, and variant data only; no representation as live stock or commercial offer. | Owner approves the exact fixture/catalog source and copy. |
| Studio/Smart Perfumer activity | Transient browser/session state only; do not persist prompts, selections, or generated concepts. | Architect confirms route and storage behavior; owner accepts the boundary. |
| Identity and contact data | No application accounts, OTP, real phone numbers, or user-submitted personal information. A separately selected access mechanism may process minimum identity/invitation records needed to grant and revoke private access; do not use these as application accounts. | Owner and privacy reviewer approve the access identity fields, purpose, retention, and any exception process. |
| Logs and diagnostics | Redacted operational metadata only. No credentials, tokens, OTP, full mobile numbers, or unapproved personal data. | Named operations/privacy authority approves retention and access. |
| Database | Catalog reads only for the runtime identity. Separate migration identity; no auth/concept data access. If disposable data is chosen, its value and deletion/backup disposition must be explicit. | Database owner and project owner decide service, grants, retention, backup, and recovery. |
| Secrets | Non-production values only, injected through an approved mechanism; no secret values in this package, source, browser bundle, or build output. | Security/operations authority approves custody, audit, rotation, and revocation. |

No personal data, retention period, backup exemption, or secret system is authorized by this proposal. D7 still requires an explicit backup/recovery decision, including a reasoned zero-value ephemeral-data disposition if that option is selected.

## Audience and access boundary

The agreed planning assumption for M6-A16 is that the private audience consists of (1) the project owner, (2) authorized development team members, and (3) selected external testers admitted by individual invitation. This is an audience assumption for planning, not approval of final identities, an access mechanism, or deployment. The final authorized identity list and access eligibility rules remain open under D2.

Access design must evaluate identity-based authorization and MFA, individual (non-shared) invitations, onboarding verification, time-bounded access and expiration, immediate revocation, periodic access review, and auditable grant/use/removal events. External testers must receive exploration access only. They must not receive infrastructure administration, database, deployment, or secret-management privileges. Development and owner operational privileges must also be separated by role and least privilege; audience membership must not imply operator access.

Private access must be enforced at the network or service boundary, not by CORS alone. The approved design must deny direct access to service origins, the full Backend app, PostgreSQL, management interfaces, and unrelated private peers. It must also explain how each approved audience group reaches the Frontend without making it publicly reachable, how external invitations expire and are revoked, and how their limited permission set is enforced. See [M6-A16 infrastructure options](M6_A16_INFRASTRUCTURE_OPTIONS.md) for alternatives; none is selected.

## Decision owners and approval record

The roles below must be assigned by the project owner before implementation authorization. Role names are responsibilities, not current personnel assignments.

| Role | Required accountability |
| --- | --- |
| Project owner | Approves scope, audience, data policy, exposed origins, cost authority, operating limits, and go/no-go. |
| Architect | Compares topology, documents data flows and trust boundaries, maps tests to gates, and reviews technical evidence. |
| Security/operations authority | Reviews access control, secret lifecycle, logs, monitoring, incident response, and access removal. |
| Database/recovery owner | Accepts database placement, grants, migrations, backups, restore, and recovery evidence. |
| Release/operator owner | Controls artifacts, deployment, maintenance, rollback, service monitoring, and operational handoff. |
| Privacy reviewer | Reviews data minimization, log content/retention, and any proposed exception to the no-personal-data scope. |
| Commercial/product approvers | Required only for a later commerce scope under D12; not part of this exploration authorization. |

For each decision, record the decision text, alternatives considered, scope, date, approving role, evidence link, and any conditions. Do not record secrets or personal data. M6-A15 [D1–D12](M6_A15_OWNER_DECISION_REGISTER.md) remain the governing unresolved register; this document carries them forward as follows:

| ID | Required decision carried forward | Status in M6-A16 |
| --- | --- | --- |
| D1 | First scope and included/excluded routes, data, audience, and exposure. | **Open; proposal above is not approval.** |
| D2 | Private audience, access method, reachability, data classification, final authorized identities, and removal process. | **Open. Planning audience recorded; mechanism and final identities await approval.** |
| D3 | Hosting location, architecture, provider, and network boundaries. | **Open; options only in companion document.** |
| D4 | Hostname/domain, DNS control, and certificate ownership/lifecycle. | **Open; no hostname or domain proposed.** |
| D5 | Ingress/proxy, exact CORS origins, trusted peers, and (only if auth later) cookie relationship. | **Open; no values selected.** |
| D6 | Database service/separation, identities, migration owner, and failure recovery. | **Open.** |
| D7 | Backup disposition, retention, RPO/RTO, encryption/key custody, restore authority, and cadence. | **Open.** |
| D8 | Secret delivery, service identities, access, rotation/revocation, and incident handling. | **Open.** |
| D9 | Whether SMS is needed; if later auth is considered, provider, template, cost, compliance, credential, and operational approval. | **Open; SMS is excluded from this proposed scope and no activation is authorized.** |
| D10 | Logging/monitoring service, retention, thresholds, alerting, incident owner, and support expectations. | **Open.** |
| D11 | Release owner, maintenance window, rollback authority, and downtime/data-loss limits. | **Open.** |
| D12 | Future commerce lines and qualified commercial/manufacturing approvers. | **Open and separate; commerce is excluded.** |

No M6-A15 decision is converted into an approval here. In particular, the working scenario does not select a provider, location, domain, access product, budget, database service, or operator.

## Approval checkpoints

Before any implementation or activation is authorized, obtain and record:

1. D1 and D2: approved scope, audience, privacy boundary, and data policy.
2. D3–D8 and D10–D11: selected design, named accountable operators, and measurable controls.
3. Explicit cost authority, maintenance/incident coverage, and approval of the option comparison and implementation phase plan.
4. A written authorization limited to the approved phase and environment, with acceptance evidence requirements and stop/rollback authority.

D9 requires a separate future decision only if authentication/OTP enters scope. D12 and commerce require their own later approval. Review the [implementation plan](M6_A16_IMPLEMENTATION_PLAN.md) before authorizing any phase. Architectural review must precede Git publishing; publishing this documentation package is not infrastructure authorization.
