# M6-A18 — Candidate Reference Architecture

**Status: implementation-ready candidate for architectural review only.** This is a technology-neutral topology for future private exploration. It does not approve a gateway, VPN, provider, region, domain, budget, service, or deployment.

## Candidate and rationale

Use a browser-facing identity gateway pattern with private Frontend and API origins, paired with private networking and independently verified path authorization. This is a technology-neutral candidate, not a vendor selection. It aligns with the owner's permission to evaluate a publicly reachable identity gateway if it provides individual MFA, scoped access, private origins and no bypass. It avoids requiring tester VPN installation while keeping service origins private. If owner policy requires the gateway edge itself to be private, evaluate private access instead. A hybrid network-and-identity layer remains an alternative if the threat review requires independent network enrollment controls and the owner accepts the added operation/support burden.

The current app has no configured same-origin catalog routing path. It does not yet choose between a narrowly allowlisted Next.js Backend-for-Frontend handler and identity gateway/ingress path routing. A relative browser API base such as `/api/v1` may permit gateway path routing without new Frontend application code; this candidate has not been implemented or tested. The `NEXT_PUBLIC_AROMAN_API_BASE_URL` fallback is `http://localhost:8000/api/v1`, so a future exploration build must explicitly set and review its browser base and fail closed if that value is absent, localhost, or unapproved. See the [browser API audit](M6_A18_BROWSER_API_PATH_AUDIT.md) for detailed comparison.

## Logical topology and trust zones

```text
Tester browser (untrusted device/network)
   │ HTTPS; individual identity + MFA; short-lived gateway session
   ▼
Identity gateway / ingress (candidate routing implementation)
   ├── application paths ──> private Frontend service (Next.js; exploration mode)
   │                           └── optional BFF candidate ──> private API
   └── /api/v1 paths ──────> private restricted API service
                               (only aroman.exploration_api:app)
   │ runtime service identity; catalog SELECT grant only
   ▼
Private PostgreSQL catalog database

Separate operator access plane ──> monitoring, secret control, backups,
                                   migration job, deployment/control plane
                                   (never through tester path)
```

Public/private boundary: only gateway edge and identity-provider sign-in/MFA endpoints required for access may be internet reachable. Frontend, API, database, administration, management, secret store, backups and deployment/control plane have private origins and explicit authorized-peer access. DNS secrecy is not a control. Any public edge is documented as public even if the service behind it is private.

## Service roles and permitted connections

| Component / identity | Permitted connection | Explicitly denied |
| --- | --- | --- |
| Tester browser | HTTPS to gateway; download Frontend assets and use same-origin `/api/v1` requests. | Direct Frontend/API/database origins, full Backend, management, deployment, logs, secret/backup services. No API origin appears in browser assets. |
| Identity gateway / ingress | Identity provider for auth/MFA; authorize every application and catalog request; route non-API paths to Frontend and `/api/v1` to API for path-routing candidate; audit events to approved monitoring destination. | Direct database access, arbitrary upstreams, developer/admin control planes. Consume gateway auth cookie; do not forward unnecessary gateway credentials, Authorization tokens or identity assertions to API. Fail closed if policy/identity unavailable. |
| Frontend runtime | Serve application. SSR may call private restricted API over approved peer path. In BFF candidate, BFF calls fixed private API. | Public API destinations, arbitrary URL forwarding, full Backend, database, migration credentials, unrelated services. |
| Optional same-origin BFF handler | Candidate only: five fixed `GET` templates and approved query values; fixed private upstream, bounded timeout/response; API accepts only Frontend/BFF peer. | All writes, auth, user, concept, health, docs, OpenAPI, administrative, unknown routes, client destination, browser cookie/authorization forwarding. Do not implement if approved gateway routing makes it unnecessary. |
| Restricted API runtime | Private ingress from the selected enforcing gateway/ingress peer (path-routing option), or Frontend/BFF peer (BFF option); PostgreSQL using runtime identity; approved monitoring. Run only `aroman.exploration_api:app`. | Public ingress, untrusted browser networks, full Backend app, migration service, database DDL/DML, arbitrary egress. |
| Runtime DB identity | Necessary `SELECT` on explicitly approved catalog tables/views. | `INSERT`, `UPDATE`, `DELETE`, DDL, grants, non-catalog objects, role escalation, schema migration. |
| Migration job/identity | Private, time-bound release path to approved schema objects; reviewed migration artifact only. | Tester path, normal API runtime, persistent presence in app environment, unrelated DB/schema. No interactive routine use. |
| Developer | Separately authorized source/review and development environment; no inherited tester-to-operator access. | Production-like data, runtime secret values, DB admin, deployment approval, access administration absent explicit separate grant. |
| Operator / access administrator | Only named operational duties, control plane, monitoring and recovery resources assigned to role. | Automatic owner authority, routine secret value access, broad DB access, tester identity details beyond need. Separate identities and MFA; independent release approval where feasible. |
| PostgreSQL | Accept connections only from API runtime, migration job, and explicitly authorized backup/monitoring peers. | Browser, gateway, public network, developer workstation, Frontend runtime directly. |

Exact hostnames, peer identities, ports, TLS termination, network ranges and service trust mechanisms remain owner-approved D3–D5 design choices. A peer/port matrix must enumerate allowed and denied directions before implementation.

## No-bypass requirements

1. Gateway/ingress is the only browser-facing ingress. No public load balancer, preview deployment, development server, alternate hostname, direct IP, debug path, second port or stale origin may reach the Frontend or API.
2. Gateway/ingress must authorize every `/api/v1` request, not only app page access. Do not infer API path protection from gateway login, a public edge, or same-origin routing. Validate unauthenticated, expired, revoked, wrong-role and malformed requests through the actual candidate path.
3. For gateway path routing, `/api/v1` reaches only the restricted API and other app paths only the Frontend, with exact route/method restrictions and independently verified normalization. For BFF, API accepts only the BFF/Frontend peer and the BFF enforces the same exact allowlist. Keep Backend boundary in both cases.
4. Frontend origin accepts gateway peer only. API origin accepts only the approved gateway/ingress peer (path routing) or Frontend/BFF peer (BFF). Database accepts only API runtime, migration and approved operational peers.
5. The exploration API process runs `aroman.exploration_api:app`; `aroman.main:app` is not deployed on a reachable listener. Backend's five-GET registry validation remains. Gateway and, if present, BFF independently enforce exact path/method allowlists.
6. Gateway consumes its auth cookie. It must not pass unnecessary gateway cookies, Authorization credentials/tokens, or identity assertions to the restricted catalog API. Strip client-supplied identity and forwarding headers, then set trusted forwarding values. API trusts only immediate approved proxy peer; no authorization decision depends on spoofable headers.
7. No private API URL or credentials are emitted to client JavaScript. The build explicitly sets a reviewed same-origin browser base (candidate `/api/v1`) and release fails if unset, `localhost`, or unapproved. CORS remains defense in depth and cannot replace private reachability tests.
8. Fail closed on gateway, identity, policy, routing, or upstream failure; no direct API fallback, stale permissive auth cache, alternate login or public health route.
9. Independently probe from the public internet, tester networks and unauthorized private peers. Test known origins, alternate DNS/IPs and nonstandard ports; require denied responses before any tester access.

## Identity lifecycle and role separation

Every owner, tester, developer, operator and administrator uses an individual identity and MFA. Shared accounts/factors are prohibited. Invitation requires nomination plus separate role approval, is bound to one identity, single-use, time-limited and recorded. Verify only a risk-proportionate identity outcome; do not collect identity documents unless separately justified and approved. Tester receives exploration UI only. Developer access is separate from operator, release, database and secret authority. Gateway administration does not imply application or DB administration.

Set a finite session lifetime, idle timeout, grant expiry, reauthentication rule for sensitive administration, MFA enrollment/recovery process, and roster review cadence before implementation. Values are **owner approval required**. Revocation removes identity and role grants, invalidates active sessions/refresh tokens and any associated network/device grants; verify denial from both the previously authenticated client and a fresh client. Agree a numeric maximum revocation time with the owner; no value is selected here. Test expiry without relying on manual cleanup. Gateway and identity outage behavior must fail closed.

## Database, migration, secrets and deployment

PostgreSQL is private. API runtime identity is distinct, SELECT-only and scoped to catalog data required for the five routes. Verify actual grants in target, including denial of writes, DDL, grant options and non-catalog reads. Migration runs as a separate short-lived identity from a reviewed, pinned artifact; the runtime never receives migration credentials. Keep schema change approval, migration execution and rollback authority attributable. Do not assume destructive schema rollback is safe; recovery may require restore.

Deliver secrets through an owner-approved secret control plane or equivalent protected runtime injection; never build them into artifacts, browser assets, source, logs or general evidence. Use separate service identities, least privilege, audited retrieval, rotation and immediate revocation. Define ownership and break-glass handling. The exact mechanism, key custody and rotation intervals are **owner approval required**.

Pin Frontend and Backend revisions, restricted process target, build configuration, migration head and non-secret runtime configuration identifiers. Explicitly set `AROMAN_RELEASE_SCOPE=exploration`; reject full/invalid mode in deployment acceptance. Promote reviewed immutable artifacts with independent release approval. Rollback must identify the last known-good application artifact and a separate database recovery decision. Release owner, maintenance windows, downtime/data-loss limits and rollback authority are **owner approval required**.

## Monitoring, backup, recovery and rollback

Monitor gateway authentication denials, policy changes, session revocation, Frontend/API availability and errors, unexpected route/method counts, network denials, database grant drift, deployment/migration state, secret access, backup outcome and spend thresholds. Restrict logs, redact tokens/cookies/secret values and unnecessary identity data, define retention and alert delivery, and assign on-call/incident authority. Never record identity documents, MFA secrets, raw session tokens or tester payloads in application logs. Signal thresholds, log retention, alert channels and named responders are **owner approval required**.

Back up only the approved synthetic catalog/configuration and necessary operational state; encrypt backups and separate backup access from runtime identities. Specify retention, key custody, restore authority, cadence and numeric RPO/RTO, or explicitly justify an ephemeral-data disposition. Test restore in an isolated target and verify the recovered restricted API path. No retention period or recovery value is selected. Define rollback order: revoke tester access/disable ingress; preserve approved redacted evidence; return application to known-good artifact; inspect migration state; restore only under the approved recovery decision; verify private boundary and route allowlist before reopening. Decommission and delete according to approved retention.

## Identity data and privacy dependencies

The gateway and identity service may process names/email or other identifiers, invitations, MFA enrollment/recovery metadata, device attributes, authentication events, IP addresses, risk signals, support cases and audit logs. Actual fields, processors, storage locations and cross-border/subprocessor conditions depend on the selected candidate. Before invitation, inventory data elements and purpose; minimize fields; establish controller/processor responsibilities, access, retention/deletion, audit availability, incident handling, data subject handling, legal basis and geographic constraints as applicable. Obtain privacy review and owner approval. AROMAN's synthetic catalog does not make gateway identity processing anonymous. No provider or jurisdiction is selected.

## Same-origin routing candidates

| Review area | Next.js BFF handler | Gateway/ingress path routing |
| --- | --- | --- |
| Authorization | Gateway authorization on every request remains mandatory; BFF route must not be reachable around it. Optional app identity enforcement requires a separately trusted mechanism. | Gateway policy must authorize every API request, including direct same-origin `/api/v1` fetches, on every request. Verify session expiry/revocation and role checks on this path. |
| Allowlist | In application code: exact five GET templates, bounded queries, no arbitrary upstream; Backend also rejects all else. | Edge policy must enforce same methods/templates and safe normalization; Backend also rejects all else. If edge cannot guarantee it, add separately approved enforcement. |
| Cookies/credentials | Consume gateway cookie at edge; BFF never forwards gateway cookie, Authorization, tokens or assertions to API. | Consume gateway cookie at edge; strip it plus Authorization/tokens/assertions before API upstream. |
| Header sanitation | Gateway and BFF sanitize client forwarding/identity headers; trust only immediate gateway peer. | Gateway sanitizes client forwarding/identity headers and sets trusted values; API trusts only immediate ingress peer. |
| Errors and failure | BFF can define safe error mapping, size and timeout behavior; extra code path must fail closed. | Gateway handles upstream/policy errors; behavior varies by candidate and must be proven fail-closed without fallback. |
| Normalization | Test handler against encoded separators, traversal, duplicate separators and query ambiguity. | Test actual edge and upstream normalization agreement; path precedence/normalization is a principal risk. |
| Isolation / peers | API permits only Frontend/BFF peer; gateway reaches Frontend, not API directly. | API permits gateway/ingress peer; ensure no direct second route and Frontend accepts gateway only. |
| Complexity / upkeep | More Frontend implementation and runtime coupling; route contract can version alongside app. | Less Frontend code, more edge-policy ownership and candidate-specific path behavior; edge changes need regression review. |
| Testability | Unit/integration tests are straightforward; target gateway and network tests still required. | Modeled tests help but cannot replace tests against actual gateway behavior, identity enforcement and peer policy. |

Neither is approved. For either, test every API request through actual identity policy and separately probe API origin from public and unauthorized peers. A public gateway does not automatically secure the API path.

## Access architecture alternatives

M6-A17's VPN/private-network, identity gateway and hybrid comparison remains the comparison basis; this document does not reproduce its long scoring matrix. A VPN candidate could keep app ingress private, but requires per-user MFA, narrow routes, device/client enrollment, attributable access and browser/API route design. A gateway candidate offers a browser-oriented invitation path but has a public edge and identity-data processing. A hybrid adds independent network restrictions but increases failure modes and policy administration. Choose among them only after D2's reachability preference, audience/support assumptions, privacy review and measurable bypass tests are settled.

## Owner gates and traceability

This candidate needs D1–D8 and D10–D11 before implementation authorization. D9 (SMS/OTP) remains explicitly outside scope; D12 commerce remains a separate future decision. Candidate architecture preference is not approval of a provider, region, domain, budget, procurement or activation. See the [decision brief](M6_A18_IMPLEMENTATION_DECISION_BRIEF.md) for the remaining owner decisions and conditional recommendations.
