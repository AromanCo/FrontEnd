# M6-A16 — Reversible Implementation Plan

**Status: proposed phases only. No phase is authorized to provision, activate, deploy, expose ports, purchase services, or use real user data.**

## Purpose and governing rule

This plan turns the proposed synthetic-catalog exploration scope into reviewable phases after explicit owner authorization. Each phase has an entry decision, bounded work, evidence, and a stop/rollback path. Authorization for one phase does not imply authorization for later phases or public release.

The exact scope and decision owners are in [M6-A16 scope](M6_A16_SCOPE_AND_OWNER_APPROVAL.md); architecture candidates are in [M6-A16 infrastructure options](M6_A16_INFRASTRUCTURE_OPTIONS.md). M6-A15 [acceptance gates](M6_A15_ACCEPTANCE_GATES.md) remain authoritative. No implementation should start while a required decision is open or an applicable gate lacks an accepted test and evidence owner.

## Phase plan

| Phase | Work boundary | Prerequisites and approvals | Acceptance evidence / exit | Reversibility, rollback, and stop conditions |
| --- | --- | --- | --- | --- |
| **0. Architecture and authority record** | Resolve scope, audience, data, architecture/access strategy, database placement, ownership, cost authority, operating objectives, test plan, and phase limits. Documentation and review only. | D1–D8, D10–D11 recorded with approver roles and conditions; D9 explicitly remains out of scope; D12 remains separate. Owner accepts a specific option and implementation authorization text. | Signed/recorded decision package, topology/data-flow and peer/port diagrams, access and responsibility matrix, cost estimate with assumptions, gate-to-evidence plan, and named stop/rollback authority. | No live resources created. Stop if owner decisions conflict, private access cannot be demonstrated, cost authority is absent, or any operational role is unassigned. Revise the proposal and return to review. |
| **1. Isolated foundation** | In the owner-selected environment, establish only the private network/access boundary, TLS/ingress where approved, separate non-production service identities/secrets, database and restricted service path, and private operational controls. No audience access yet. | Phase 0 exit; phase-specific written owner authorization, approved cost ceiling, named operators, access to chosen environment, reviewed threat/data-flow design. | Evidence for network isolation, restricted catalog routing, HTTPS/proxy, exact origins, database SELECT-only grants, migration controls, secret lifecycle, backup/restore disposition, monitoring, and alert delivery. Execute applicable A15 probes in the selected target topology. | Roll back by disabling ingress/access and stopping services; preserve only approved evidence and required backup artifacts. Stop immediately on public/bypass reachability, full app exposure, excess DB grants, secret leakage, unowned alert, failed restore objective, or unexpected spend. No user access. |
| **2. Restricted application deployment** | Deploy a pinned Frontend build in exploration mode and the pinned restricted API target `aroman.exploration_api:app`; apply reviewed schema migration using the separate migrator; use approved synthetic/demo catalog only. | Phase 1 gates passed and accepted; artifact/revision provenance recorded; deployment and migration runbooks approved; operator and reviewer available; owner authorizes this deployment phase. | Confirm five GET route templates work through intended path; prohibited methods/paths and account/save/cart/checkout surfaces fail; no bypass to full Backend; synthetic data verified and zero user/OTP/session/concept records; exact origins and logs checked. Record revisions and redacted test results. | Disable access, return traffic to prior known-good application artifact, and follow approved migration recovery path. Do not assume schema downgrade is safe. Stop on route drift, persistence, real data, direct-origin access, migration mismatch, missing evidence, or any unexplained failure. |
| **3. Private audience acceptance rehearsal** | Grant access to only the owner-approved named reviewers; exercise the intended browser path and operational response. This is still not a public release or general user invitation. | Phase 2 exit; owner approves audience list/process and access removal; privacy/security and operations authorities accept data, logging, monitoring, support, and incident procedures; all applicable private-blocking gates pass. | Clean-browser supported journeys for catalog, product, Guided and Creative Studio/Smart Perfumer over approved private path; unauthorized probes blocked; alert/incident tabletop and access revocation demonstrated; redacted trace/screenshots and gate ledger accepted. | Revoke audience access and disable ingress to return to operator-only state. Stop on any unauthorized path, personal data collection, persistence, unexpected external call, unhandled alert, or failed access removal. |
| **4. Operate for approved evaluation window** | Time-bounded private operation within approved audience, data, cost, maintenance, and support limits. Maintain access roster and review logs/alerts/backups per approved cadence. | Phase 3 signed acceptance; explicit owner start/end dates and recurring cost authority; named on-call/incident and release operators; current rollback/recovery readiness. | Periodic review record for access, security patches, service health, spend, alerts, backup/restore obligations, incidents, and expiry. Close with owner decision to stop, extend under new approval, or propose a separate next scope. | At end date, revoke access and decommission in approved order; retain/delete data and evidence according to the approved policy. Stop early on scope drift, owner withdrawal, security incident, control failure, threshold breach, loss of accountable operator, or unapproved cost. |

## Acceptance evidence and review format

For every gate test, capture timestamp, tested application/infrastructure revision, non-secret topology/configuration identifiers, operator role, expected and actual outcome, test method, redacted output, and reviewer/approval. Store evidence only in an owner-approved location with the approved retention. Never include credentials, tokens, personal contact data, or secret values. Record failures and retests; no unexplained failure is a pass.

CI and local integration checks can establish repository behavior only. They do not replace target tests for network rules, TLS, service identities, managed database grants, secret delivery, backups, monitoring, human alert response, or rollback. Any material architecture or scope change invalidates affected evidence and requires review.

## Mapping to M6-A15 acceptance gates

| M6-A15 gate | Planned phase(s) | Required evidence before private evaluation |
| --- | --- | --- |
| Scope and synthetic data | 0, 2, 3 | D1/D2 approval; approved demo data; five catalog GET journey; forbidden UI/routes absent; zero user, OTP, session, and concept rows. |
| Network isolation | 0, 1, 2, 3 | Approved/unauthorized probe results show only approved ingress responds; direct origins, full app, DB, management ports, and unrelated peers blocked. |
| Restricted catalog routing | 1, 2, 3 | Runtime target identity and exact allowlist verified through ingress; prohibited methods/paths denied; no bypass. |
| HTTPS and proxy | 0, 1, 2, 3 | Certificate/HTTPS checks and forwarded-header spoofing tests pass for approved origins and immediate peers. |
| Origin restrictions | 0, 1, 2, 3 | Exact approved origin behavior; unrelated origins denied; separate network probes prove CORS is not access control. |
| Database SELECT-only grants | 0, 1, 2 | Actual runtime identity limited to necessary catalog reads; writes, DDL, non-catalog reads, grant/escalation denied. |
| Migration controls | 0, 1, 2 | Separate migrator, reviewed revision, expected migration head, readiness behavior, and controlled failed-migration rehearsal documented. |
| Secrets | 0, 1, 2, 3 | Approved injection, access audit, canary redaction, rotation/revocation and service recovery evidence. |
| Backups and restoration | 0, 1, 2, 3 | Owner-approved disposition and numeric objectives or explicit justified ephemeral-data policy; encrypted backup/isolated restore evidence as applicable. |
| Monitoring and incident handling | 0, 1, 3, 4 | Defined signals/thresholds and redaction/retention; alert delivery for failures and tabletop response evidence. |
| Rollback and recovery | 0, 1, 2, 3, 4 | Versioned runbook, second-operator rehearsal, known-good recovery and D7 objective evidence. |
| Browser end-to-end through intended path | 0, 2, 3 | Supported clean-browser exploration journey through approved HTTPS/private path, allowlisted requests only, no persistence or unauthorized network access. |
| Later real OTP and saved concepts | Not in plan | Out of scope. Requires separate D1/D8/D9/D10, privacy review, explicit activation, and its own gates. |
| Future commerce | Not in plan | Out of scope. Requires D12 and qualified product/commercial/legal/safety/production/payment approvals and independent acceptance. |

## Operational responsibility during an approved phase

Before Phase 1, the owner must assign named accountable roles for release/change approval, infrastructure/network, application runtime, database and migration, backup/restore, secret custody, monitoring/on-call, incident handling, access administration, privacy/log review, and cost oversight. One person may hold multiple roles only if the owner records that assignment and separation-of-duty risks are addressed. Vendors or managed services do not remove the need for an accountable owner.

The operator runbook must cover patching, deployment provenance, migration review/application, private readiness checks, alert triage, incident containment, credential revocation, backup verification, restore, access removal, rollback, and end-of-window decommissioning. The restricted API has no public health route; readiness must use approved private orchestration or protected checks and not add a public health endpoint.

## Global stop conditions

Stop rollout or operation, disable the relevant access path, notify the assigned incident authority, and preserve only approved redacted evidence if any of the following occurs:

- Any public or unauthorized reachability, direct service bypass, unrestricted Backend exposure, or database/management access.
- Authentication, OTP/SMS, real user data, persistent concepts, writes, or commerce become reachable or are collected.
- Unexpected secret or personal-data exposure, failed access revocation, unowned critical alert, or unexplained external request.
- Database permissions exceed the approved matrix; migration state is uncertain; backup/restore or rollback misses owner-approved limits.
- Spend, maintenance, audience, scope, or operating window exceeds recorded approval, or an accountable operator becomes unavailable.
- Any required gate fails or cannot be evidenced. Resume only after a recorded cause/remediation review and authorization from the designated owner.

This plan does not authorize Git publishing or infrastructure work. Architectural review of the three-document package is the next decision point. If review changes scope or topology, update the decision/evidence mapping before implementation is proposed.
