# M6-A17 — Identity and Security Model

**Status: candidate controls for review; no identity provider, gateway, access policy, data retention period, or deployment is selected or approved.** This model applies to the planning scenario in [the architecture comparison](M6_A17_ACCESS_ARCHITECTURE_COMPARISON.md) and is checked by [the decision and acceptance plan](M6_A17_DECISION_AND_ACCEPTANCE_PLAN.md).

## Security boundary and identity data

The access gateway or VPN control plane may process personal identity data even though AROMAN itself is limited to synthetic/demo catalog data and has no application accounts. Depending on the selected mechanism, identity services may process names, email addresses or other identifiers, invitation records, MFA enrollment and recovery metadata, device/client attributes, authentication events, IP addresses, risk signals, and support records. Actual fields vary by implementation and must be verified before selection.

Before any identity is invited, the owner and an appropriate privacy reviewer must approve the purpose, minimum fields, identity verification method, access eligibility, recipients/processors, storage locations, retention/deletion schedule, access controls, audit access, breach handling, and any cross-border or subcontractor implications that apply. Collect no more identity data than needed to establish a unique authorized person and administer the evaluation. Do not place contact details, identity documents, MFA secrets, or raw session tokens in AROMAN data, these decision documents, or general application logs. Identity-provider retention and deletion must be addressed separately from AROMAN catalog/database retention. No retention period is set here.

## Individual identity, invitations, onboarding, and MFA

- Give each owner, developer, operator, administrator, and external tester a distinct identity. Shared accounts and shared MFA factors are not acceptable for attributable access.
- Require MFA for every human identity before exploration access is granted. The chosen method, enrollment, fallback, recovery, and lost-factor process must be evaluated for security and accessibility; no method/provider is selected here.
- An authorized inviter nominates a person; a separate designated approver confirms eligibility and role. Bind an invitation to the intended identity, make it single-use and time-limited, and prevent forwarding or reuse from granting access to a different person.
- Verify identity to a level proportionate to the risk and approved audience. Record the verification outcome and responsible role, not unnecessary identity evidence. External testers receive no access until invitation acceptance, verification, MFA enrollment, and role assignment are complete.
- Review the active roster at an owner-approved cadence and at evaluation-window end. Access must have an explicit expiration. Extensions require renewed approval and a new expiry.
- Immediately revoke an identity by disabling authorization, removing group/route grants, invalidating active sessions and refresh tokens, and confirming denial from a fresh and previously authenticated client. Define an owner-set response target; no numeric target is approved in this study. Revoke associated credentials/device enrollment where applicable.

## Roles and least privilege

| Role | Permitted scope | Explicitly excluded |
| --- | --- | --- |
| **Tester** | Browse approved exploration UI and synthetic catalog through the sanctioned access path. | Other testers' identity details, application administration, API/database access, deployment, management, secrets, full Backend, accounts, OTP, persistent concepts, commerce. |
| **Developer** | Tester scope plus approved development/review activity through separately controlled development tools. | Production-like operations by default, database administration, secret custody, deployment approval, infrastructure administration. Any exception must be explicit, time-bound, and audited. |
| **Operator** | Assigned runtime operations, monitoring, release/recovery steps, and access administration only when separately assigned. | Routine secret value access, unrestricted database access, or owner approval authority unless explicitly assigned and recorded. |
| **Administrator** | Access-system/network/identity policy administration for the assigned boundary. | Automatic application, database, deployment, or secret privileges. Administrative reach must be separately granted, attributable, MFA protected, and audited. |

Use separate service identities for gateway-to-Frontend, Frontend-to-restricted-API as applicable, API-to-catalog-database, migration, monitoring, and secret retrieval. Runtime API identity is limited to required catalog reads. The migration identity is not present in the runtime. Human access to PostgreSQL, unrestricted `aroman.main:app`, deployment systems, and secrets is not inherited from exploration access. Define and review a role-to-resource matrix for every network path, port, and control plane.

## No bypass: origin, API, and network controls

- Frontend, restricted API, and database origins are private and accept only their documented peers. If a public identity gateway is chosen, its private upstream accepts traffic only over the approved gateway-to-origin path; there is no public fallback listener.
- The restricted API process target is exactly `aroman.exploration_api:app`. Only the five M6-A14 catalog GET route templates are served. Unknown routes and other methods fail closed. The unrestricted `aroman.main:app` has no path from the gateway, browser, tester network, or exploration service peer.
- Browser-to-catalog traffic should be server-side from the Frontend over a private service path. Do not publish a separate public API hostname. If the design requires a browser-addressable API origin, that origin remains privately reachable only through the approved boundary and must pass independent bypass probes.
- Deny direct origins, alternate DNS/load-balancer addresses, preview deployments, nonstandard ports, debug/management paths, and direct API requests from unauthorized networks. Restrict API-to-database access to the exact database endpoint/port; database has no user/browser ingress.
- CORS permits only explicitly approved exact origins and never substitutes for network or identity authorization. It does not stop direct HTTP clients.
- Strip client-supplied identity and forwarding headers at the trusted edge. Set canonical values only at the approved proxy; accept them only from known immediate peers. Prevent an untrusted client from asserting a user, role, source address, scheme, or host.
- Keep deployment, secret-management, database administration, and network administration on distinct control paths and identities. A tester or developer application role must not imply control-plane access.

## Session, TLS, forwarding headers, and CORS

Use HTTPS end-to-end where supported, with certificate hostname and chain validation, TLS termination responsibilities documented, and HTTP denied or redirected only at an approved edge. Protect cookies with Secure, HttpOnly, and an appropriate SameSite policy for the selected identity flow; bind cookie domain/path narrowly. Do not put bearer tokens in URLs. Prevent mixed content and disable caching of authenticated sensitive gateway responses where appropriate.

Select a short session lifetime consistent with the evaluation journey, with bounded idle timeout and reauthentication for sensitive administrative actions. Exact maximum and idle durations remain owner decisions and must be recorded before implementation. Refresh tokens, if any, must be protected, rotated/revocable, and not accessible to browser scripts. A gateway outage or identity-service outage must not silently extend sessions or bypass reauthentication. Define whether already established sessions continue during an outage; default candidate behavior is fail closed for new access and for authorization checks that cannot be validated, with a bounded, explicitly approved session policy.

Configure the edge to discard client `Forwarded`, `X-Forwarded-*`, identity, and role headers, then write canonical headers. The application trusts forwarding metadata only from explicitly listed immediate peers; direct connections are rejected or treated as untrusted. Test spoofed, duplicated, malformed, and multi-hop chains. CORS uses an exact allowlist of approved scheme/host/port origins; no wildcard, reflected arbitrary origin, or broad subdomain match. Credentialed responses include only the exact requesting approved origin and required `Vary: Origin` behavior. Validate preflight behavior without widening methods beyond required catalog GETs.

## Fail-closed behavior and revocation

If the gateway, identity provider, policy engine, or authorization lookup is unavailable, new access is denied; there is no direct-origin fallback, cached permissive policy, alternate login, or switch to the full Backend. For active sessions, enforce the documented bounded session policy; any revocation event must take effect immediately at the authorization boundary or the approved architecture cannot claim immediate revocation. If a component cannot invalidate active sessions promptly, shorten session duration, add a revocation mechanism, or reject that candidate design. Recovery must restore policy and audit event continuity before opening access. Network and API health checks must remain private; do not add a public health route to the restricted API.

## Audit, minimization, and retention

Record invitation creation/approval, identity verification outcome, MFA enrollment/authentication result, role grants/changes, session issuance/revocation, expiry, denial, administrative changes, and recovery actions with actor, timestamp, result, and target. Protect logs from tester modification; limit audit access to named roles; synchronize clocks; monitor anomalous grants, repeated denials, and policy changes. Avoid logging tokens, passwords, MFA secrets/codes, identity documents, full contact values, request bodies, prompts/selections, or unnecessary IP/device details. Where identifiers are needed for accountability, use the minimum stable pseudonymous or access-controlled identifier that the selected system supports.

The owner must set retention and deletion rules for gateway/identity logs and invitation records separately from synthetic catalog data. Define export, legal hold, access request, deletion, and incident preservation handling before collection. Audit evidence used for acceptance must be redacted and stored in an owner-approved location. No logging product, data location, or retention duration is selected here.

## Protected resources and prohibited reachability

The allowed exploration path is limited to the Frontend and restricted catalog API. PostgreSQL accepts connections only from the restricted API and separately approved database operations/migration paths. The API runtime identity can read only required catalog objects and cannot write, perform DDL, read identity/concept tables, grant privileges, or escalate roles. The full Backend, application authentication, OTP/SMS, user/concept persistence, deployment systems, secret stores, orchestration controls, and management interfaces are inaccessible to tester identities and public clients. Administrative exceptions require separate identity, MFA, least privilege, explicit approval, time bounds, and audit; they do not become part of exploration access.

These are proposed requirements, not evidence that the current application or any candidate gateway enforces them. D1–D12 remain open; no deployment or provider is approved.
