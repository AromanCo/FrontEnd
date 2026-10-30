# M6-A21 Public Catalog Integration

## Status and scope

This milestone implements a local same-origin routing candidate in the Frontend checkout. It does not deploy services, expose a public endpoint, select hosting, or approve a public launch. The only Backend application in scope remains the restricted `aroman.exploration_api:app`; the Backend repository was not modified.

Public-showcase builds can select `NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1`. The existing validated absolute HTTP(S) `/api/v1` option remains available. A build records the selected value in `.next/public-showcase-build.json`, and runtime public mode still requires that marker. A full or exploration artifact cannot be switched to public-showcase at runtime. Production has no implicit localhost browser API fallback.

The local Next.js handler is `src/app/api/v1/[...path]/route.ts`. Despite its catch-all filesystem shape, it is not a general proxy. It forwards only GET requests matching the exact paths `/api/v1/brands`, `/api/v1/products`, `/api/v1/products/{UUID}/variants`, `/api/v1/fragrance-families`, and `/api/v1/fragrance-notes`. It rejects other paths, encoded/noncanonical path spellings, and unsupported methods. Query names are endpoint-specific; duplicates, unknown names, control characters, excessive query lengths, invalid UUIDs, and out-of-range pagination are rejected.

## Upstream and security boundaries

The handler reads only the server-side `AROMAN_CATALOG_UPSTREAM_URL`, which must be an absolute HTTP(S) URL with exact `/api/v1` path and without credentials, query, or fragment. There is no user-controlled destination. No browser cookie, authorization, identity, or forwarding header is copied; the upstream request contains only `Accept: application/json`. Redirects are not followed. Upstream errors are replaced with generic responses. The route uses a five-second timeout, accepts JSON only, and limits response bodies to 1 MB.

These checks establish behavior of this local Frontend candidate, not the security of a deployed service. A Next.js route alone does not control who can reach the Frontend, its direct origins, the restricted Backend, databases, or management interfaces. Target-environment ingress, peer isolation, authorization/reachability policy, runtime configuration, secret management, logging, monitoring, and operational controls remain unverified.

Server-rendered catalog reads continue to use the server-only `AROMAN_API_BASE_URL`; local development may default to `http://localhost:8000/api/v1`, while production does not. Configure both server-only settings explicitly where needed. Neither value belongs in a `NEXT_PUBLIC_*` variable.

## Routing alternatives

The Next.js allowlisted route is an implemented local candidate, not an architecture selection. The alternative gateway/ingress routing approach remains documented as unselected in `docs/M6_A19_OWNER_DECISION_MATRIX.md`. Both candidates remain subject to owner, security, and target-environment review. D1–D12 remain open; this milestone does not silently close any decision.

## Verification

Automated route tests cover all five templates, unsupported methods, forbidden routes, encoded and ambiguous paths, query boundaries, invalid upstream configuration, credential/header sanitization, redirects, and oversized bodies. Public-build configuration tests cover the same-origin candidate and runtime build-marker safeguard. The existing five-job CI layout is preserved, with route security coverage included in `verify`.

Browser regression checks must continue to cover home, catalog/product details, Guided Studio, Creative Studio, Smart Perfumer, Guided-to-Creative transfer, Smart Perfumer apply/undo, and account/cart/checkout previews. In public-showcase mode those journeys must not invoke authentication, SMS, saved-concept, order, or payment APIs. Completion status and any unavailable environment-dependent checks are recorded with the M6-A21 review evidence.

## Unresolved public-launch blockers

- Owner decisions D1–D12 and applicable M6-A15 acceptance gates remain unresolved.
- No target origin, hosting, ingress, provider, DNS, or public exposure is selected or approved.
- Direct Backend origin isolation, exact deployment routing, trust boundaries, and unauthorized-peer probes have not been established for a target environment.
- The restricted Backend and its data source need target-environment verification for catalog-only reachability, least privilege, synthetic-data provenance, and failure behavior.
- Secret/configuration handling, operational ownership, monitoring, incident response, release/rollback authority, and applicable recovery controls remain outstanding.
- Real accounts, SMS, persistence, saved concepts, payment, orders, and commerce remain disabled and out of scope.

This milestone is ready for code review only after the test and browser regression evidence is attached; it is not a public-launch approval.
