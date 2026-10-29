# M6-A17 — Private Access Architecture Comparison

**Status: neutral decision study for architectural and owner review. No access architecture, provider, location, domain, budget, or deployment is approved.** A publicly reachable identity gateway is acceptable for evaluation only as a candidate, subject to individual MFA, narrowly scoped authorization, private application origins, no bypass, and the gates in [the decision and acceptance plan](M6_A17_DECISION_AND_ACCEPTANCE_PLAN.md).

## Scope and evidence baseline

- Frontend repository: `AromanCo/FrontEnd`, branch `docs/m6-a17-private-access-architecture`, HEAD `a2cfae07bf8898e916bf036c73581041f613f8ff`.
- Backend repository: `AromanCo/Backend`, branch `develop`, HEAD `0be24c4597bd693e70348243c26e550a20a8ad0e`.
- These are source baselines, not deployed revisions. M6-A14's integration checks use loopback services and do not prove deployed network controls.
- Planning scenario: synthetic/demo fragrance data; catalog, Guided Studio, Creative Studio, and Smart Perfumer; audience of the owner, authorized developers, and individually invited external testers.
- Excluded: AROMAN application authentication, OTP/SMS, persistent user concepts, commerce, payments, and real customer data.
- Only `aroman.exploration_api:app` may serve catalog requests. The unrestricted `aroman.main:app`, PostgreSQL, secrets, deployment and management interfaces must remain unreachable to unauthorized users.

M6-A15 decisions D1–D12 remain open. M6-A16's planning audience and scope do not constitute final approval. These diagrams are candidates, not deployment diagrams.

## Candidate A — VPN or private client network

```text
Owner / developer / invited tester
        │ individual identity + MFA; client enrollment
        ▼
Private access network / VPN ── policy: exploration audience only
        │
        ├── HTTPS ──> private Frontend origin
        │                 │ server-side catalog requests
        │                 ▼
        │           private restricted API origin
        │                 │ SELECT-only identity
        │                 ▼
        │           private catalog database
        └── no route ──> full Backend, DB admin, deployment, secrets, management

Publicly reachable: VPN/access control plane and its enrollment/authentication
(if its chosen implementation is internet-facing). Application origins are not
publicly routed. Actual reachability depends on the selected network design.
```

**Flow and ingress.** The user enrolls an individually attributable device or client, authenticates with MFA, and obtains a narrowly routed exploration path. Browser HTTPS reaches the private Frontend. The Frontend server makes catalog requests over a private service path to `aroman.exploration_api:app`; the browser must not need a direct public API origin. Network policy restricts the API to the documented Frontend/service peer. API-to-database traffic is private and uses a catalog read identity. The ingress point is the private Frontend listener; there is no public application listener.

**Publicly reachable components.** No application origin should be publicly reachable. A VPN enrollment/control endpoint may be reachable publicly, depending on the candidate. Do not equate a private application origin with a private identity/control plane.

**Strengths.** Avoids public application ingress; network policy can deny direct origin access before HTTP reaches the app; may fit an existing managed identity/device lifecycle if that capability is verified.

**Failure modes and limits.** Compromised or over-broad VPN membership can expose adjacent networks; route or peer policy mistakes can permit lateral movement; stale device credentials or sessions can survive incomplete revocation; control-plane or tunnel failure blocks all users; DNS, MTU, client setup, and device support can complicate browser journeys. VPN membership alone does not prove individual app authorization or least privilege.

**Tester convenience.** Requires client setup and support. Some testers may be unable or unwilling to install a client or enroll a device. Invitation, identity verification, MFA recovery, and removal must work for external identities.

**Operational workload and cost drivers.** Identity/device enrollment and recovery, route and firewall management, endpoint support, client compatibility, access reviews, logging, availability, and on-call effort. Potential cost drivers include control-plane/user/device capacity, private networking, ingress, compute, logging, support tier, and operator time. No prices or provider assumptions are made.

## Candidate B — Publicly reachable identity-protected application gateway

```text
Owner / developer / invited tester
        │ HTTPS + individual identity + enforced MFA
        ▼
Public identity gateway / access policy
        │ authorize this app and role; short-lived session
        │ private upstream only; sanitize identity/forwarding headers
        ▼
Private Frontend origin (no public route; gateway is sole peer)
        │ server-side catalog requests over private service path
        ▼
Private restricted API origin: aroman.exploration_api:app
        │ SELECT-only identity
        ▼
Private catalog database

No route from browser or gateway to full aroman.main:app, DB, management,
deployment or secrets. Publicly reachable: gateway edge and identity flow only.
```

**Flow and ingress.** The browser connects over HTTPS to the gateway's public edge, completes individual MFA, and receives a bounded app session. The gateway authorizes the exploration application and role, then forwards to a private Frontend origin. Only the gateway's authenticated/private peer path may reach that origin. The Frontend makes server-side catalog requests to a private restricted API origin; the API is not browser-addressable and accepts only the documented catalog GET route templates. The database is reachable only from the API service identity/network. Gateway headers carrying identity are trusted only from the gateway peer; client-supplied copies are stripped or overwritten.

**Publicly reachable components.** The gateway's edge and whatever identity endpoints are required for sign-in, MFA, and recovery. The Frontend origin, catalog API, full Backend, database, management interfaces, deployment systems, and secrets remain private. A public gateway is still a publicly reachable service; identity protection does not make its edge private.

**Strengths.** Browser access may avoid client installation; per-user app authorization can limit access more narrowly than network membership; centralized invitation, MFA, session expiry, and revocation may simplify tester access if verified. Private origins can reduce direct-origin exposure.

**Failure modes and limits.** Gateway/policy misconfiguration, exposed origin or alternate hostname, leaked origin credentials, or a second ingress can bypass the control. Gateway or identity-service outage must deny new and existing protected access according to defined session/revocation policy. Stolen sessions, weak MFA recovery, identity-provider compromise, header spoofing, permissive audience rules, and overly long sessions remain risks. A gateway may process identity data for sign-in, MFA, device/risk checks, abuse prevention, logs, and support even when AROMAN receives only synthetic catalog data.

**Tester convenience.** Usually a familiar browser flow without a VPN client, but testers need supported identity proofing and MFA, and must be able to recover access without shared accounts. The gateway's identity requirements may add friction or exclude some testers.

**Operational workload and cost drivers.** Identity federation/configuration, invitation approval, MFA and recovery policy, app-role rules, gateway policies, origin isolation, session revocation, audit export, identity-data privacy review, gateway and identity-service monitoring, and incident response. Cost drivers may include gateway/identity seats or transactions, MFA methods, edge and egress traffic, logs and retention, availability/support tier, and operator time. No prices or provider assumptions are made.

## Candidate C — Hybrid network and identity controls

```text
Owner / developer / invited tester
        │ individual identity + MFA
        ▼
Identity gateway (public edge or private edge: owner choice remains open)
        │ app + role authorization
        ▼
Private access segment / service ingress
        │ only gateway peer to private Frontend
        ▼
Private Frontend ──private──> restricted catalog API ──> catalog DB

Network policy independently blocks direct Frontend/API/DB origins and limits
service peers. Full Backend, management, deployment and secrets use separate
operator-only paths and identities.
```

**Flow and ingress.** Identity authorization decides who may enter the exploration app; network segmentation independently constrains where authorized traffic can go. The gateway forwards only to the private Frontend; the Frontend calls the restricted API privately; the API reads the database. Depending on topology, the gateway may be publicly reachable or available only through a private network. Do not assume either form is selected.

**Publicly reachable components.** If the gateway is public, its edge and identity flow only. If the gateway is private, the separately selected private access control plane may still have public enrollment/control endpoints. Application and data origins remain private in either case.

**Strengths.** A second control can contain some identity-policy or network-rule mistakes; per-user roles can coexist with private routing; operator paths can be isolated from tester paths. This can reduce the consequence of one failed boundary when controls are independently enforced.

**Failure modes and limits.** More components and policy intersections increase configuration drift and troubleshooting. A shared identity or network administration plane can defeat the intended separation. Fail-closed behavior, session revocation, peer restrictions, and route ownership must be consistent across both layers. Added controls do not compensate for an exposed alternate origin.

**Tester convenience.** Depends on whether a VPN/client is required in addition to browser sign-in. Requiring both may increase setup and support burden; a browser-only gateway paired with private backend networking can retain a simple user path.

**Operational workload and cost drivers.** All relevant gateway and network operations plus cross-layer policy review, independent evidence, incident coordination, and more complex monitoring. Cost may include both access systems, private networking, identity/gateway usage, logging, and staff time. No prices or provider assumptions are made.

## Browser-to-catalog routing and origin requirements

Preferred candidate flow for comparison is browser → approved Frontend origin → private service request → restricted catalog API → private catalog database. Browser requests should target the Frontend origin (for example, a same-origin server route/proxy) rather than a separately exposed API origin, if the application can support that without changing the M6-A14 scope. Confirm actual Frontend behavior and build-time API base configuration before implementation; this study does not assert that a same-origin proxy currently exists.

Keep Frontend, API, and database origins private and non-routable from unauthorized clients. The API listener must run only `aroman.exploration_api:app`; it must not route to `aroman.main:app`. Enforce peer/port restrictions at network ingress and service boundaries. Exact-origin CORS is defense in depth for browser behavior, not access control: direct HTTP clients do not rely on CORS. Where a browser-to-API origin is unavoidable, it must be private, exact-origin restricted, and separately proven unreachable from unauthorized clients. No direct-origin bypass may exist through alternate DNS, load balancers, ports, preview deployments, debug interfaces, or credentials.

## Comparative summary

| Dimension | VPN/private network | Identity-protected gateway | Hybrid |
| --- | --- | --- | --- |
| Application ingress | Private Frontend ingress | Public gateway; private upstream | Gateway plus segmented private ingress |
| User control | Network/device membership plus app scope | Per-user app authorization | Per-user authorization and network policy |
| Browser setup | Client/network onboarding likely | Browser flow likely | Depends on whether client enrollment is also required |
| Direct-origin risk | Private routing limits exposure; peer rules still required | Private upstream must accept gateway only | Independent controls can reduce bypass risk |
| Main failure concern | Over-broad routes or stale device access | Public edge, policy/session/origin bypass | Policy complexity and cross-layer drift |
| Operator burden | Network/client lifecycle | Gateway/identity/privacy lifecycle | Highest cross-layer coordination burden |
| Cost basis | Network, user/device capacity, support, staff | Gateway/identity usage, logs, support, staff | Combination plus integration and audit effort |

This matrix is a comparison only. D1–D12 remain open; specifically, D1 scope, D2 access boundary, D3 hosting/access architecture, D4 domain/TLS, D5 ingress/origins, D6 database, D7 recovery, D8 secrets, D9 OTP scope, D10 operations, D11 release/recovery, and D12 commerce are not decided here. See the [identity and security model](M6_A17_IDENTITY_AND_SECURITY_MODEL.md) and [decision and acceptance plan](M6_A17_DECISION_AND_ACCEPTANCE_PLAN.md).
