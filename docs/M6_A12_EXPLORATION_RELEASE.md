# M6-A12 — Exploration-Only Release Foundation

## Approved scope

The project owner approved Option A: an exploration-only first release. This milestone configures the existing Frontend to offer the Persian-first home page, public catalog browsing and search, conceptual product detail pages, Guided Studio, Creative Studio, Smart Perfumer recommendations, and Guided-to-Creative transfers held only in the current page session's memory.

It excludes registration, login, OTP, accounts, saved or previously saved concepts, persistent submissions, carts, checkout, orders, payments, live prices or stock, real SMS, and claims that a composition can be manufactured or purchased. Existing full-mode code remains available for development and testing. Catalog records and imagery are demonstrative; Studio recommendations are conceptual, not formulas, safety findings, or manufacturing claims.

## Release scope configuration

Set the one server-side setting `AROMAN_RELEASE_SCOPE` to `exploration` or `full`. For an exploration deployment, explicitly set `AROMAN_RELEASE_SCOPE=exploration`; production also defaults to exploration if it is omitted. The checked-in `.env.example` uses this safe value. Do not copy a `full` setting into a production environment: it enables the existing login, account, cart, checkout, and saved-concept frontend flows. The separate M6-A20 `public-showcase` scope must also be selected during its build; its validated public catalog API base is recorded in the build output and required again by the start check.

```sh
AROMAN_RELEASE_SCOPE=exploration npm run dev
```

Developers can intentionally activate full mode with `AROMAN_RELEASE_SCOPE=full npm run dev` (and CI sets `full` explicitly for existing full-mode regression jobs). Outside production, an omitted setting continues to default to `full` for development and test compatibility. No value of this setting authorizes public deployment by itself; public exposure remains blocked pending the separate Backend/API boundary and operational approvals below.

Production defaults to `exploration` if the setting is omitted. Development and test environments default to `full` to preserve existing local journeys; CI sets `full` explicitly for the legacy regression suite and `exploration` explicitly for its release job. An explicitly supplied value other than `exploration` or `full` is invalid and throws during server rendering. Proxy fails closed for excluded routes if scope parsing fails. Never set this variable in a browser bundle, URL, cookie, storage, or user-controlled request header.

Scope is read from the server process at request time. The layout is dynamically rendered and Proxy evaluates the same server-side selector. With `next start`, changing scope requires changing the runtime environment and restarting the server; the production build does not bake this non-public variable into client assets. Restart `next dev` after changing `.env.local` so its environment is reloaded. Rebuilding is not needed solely to change scope, but rebuild after code changes as usual. Keep the deployment environment consistent between the Next.js server and Proxy runtime.

## Route and client behavior

In `exploration`, Next.js Proxy returns 404 for `/login`, `/account`, `/cart`, and `/checkout`, including descendants and trailing slashes. Each corresponding server page also calls `notFound()` as defense in depth. Header links to accounts and cart are omitted on desktop and mobile. A `concept` query on `/studio/creative` is ignored by the server page in exploration mode, so it cannot trigger saved-concept retrieval.

The shared auth context is initialized as a ready guest and does not call `/auth/session`, `/auth/csrf`, or `/users/me`; it displays no retry banner. Guided and Creative Studio save handlers are guarded and their save/login controls are omitted. Account-dependent Smart Perfumer fork is omitted. Catalog loads and conceptual recommendations remain available. Guided-to-Creative drafts continue through the existing in-memory React context and are not written to browser storage or the Backend.

Saved concepts are not available in exploration mode. There is no replacement persistence mechanism. Existing persisted concepts in a Backend remain outside this Frontend scope and are not retrieved or modified by the exploration journey.

## Local checks

With Node.js 22 and the repository dependencies installed:

```sh
AROMAN_RELEASE_SCOPE=exploration npm run dev
npx vitest run tests/release-scope.test.ts src/tests/auth-provider.test.tsx
AROMAN_RELEASE_SCOPE=full NEXT_PUBLIC_AROMAN_API_BASE_URL=http://127.0.0.1:18761/api/v1 npm run build
AROMAN_RELEASE_SCOPE=exploration node scripts/exploration-release-journey.mjs
```

The local build deliberately selects `full` while the journey starts the compiled server in `exploration` mode. The `NEXT_PUBLIC_AROMAN_API_BASE_URL` value is embedded in browser assets at build time; its loopback fixture port must be `18761` for this journey. The journey starts its API fixture on `127.0.0.1:18761` and Next.js on `127.0.0.1:3317`; those ports must be free.

The browser journey starts the compiled Next.js server on loopback, intercepts catalog API requests with synthetic DTO fixtures, directly requests restricted routes, checks public routes and desktop/mobile navigation, and records that no auth, user, saved-concept, or write API request occurs. It does not contact the Backend or any public network service. Existing full-mode browser tests (including auth and Guided save journeys) remain in CI with `AROMAN_RELEASE_SCOPE=full`.

## Backend/API boundary and public exposure

The pinned Backend remains unchanged and registers `/api/v1/auth/*`, `/api/v1/users/*`, `/api/v1/fragrance-concepts/*`, `/api/v1/brands`, `/api/v1/products`, `/api/v1/products/{product_id}/variants`, `/api/v1/fragrance-families`, and `/api/v1/fragrance-notes`. The first three groups contain authentication, user, and saved-concept operations. Public exposure is **BLOCKED pending verified Backend/API boundary controls**.

Before any public exposure, an approved ingress/API gateway must allow only the agreed read-only public catalog endpoints and HTTP methods. It must block authentication, user, saved-concept, administrative, and all write endpoints, including write methods on otherwise public paths. Health endpoints should remain internal unless separately approved. The pinned Backend currently registers no administrative router, but the boundary must also deny any such paths if introduced later. CORS and the Frontend's hidden controls are not access controls; this Frontend mode does not protect Backend endpoints. No Backend routes, ingress, reverse proxy, or firewall are changed by M6-A12.

## Outstanding operational decisions and launch status

The M6-A10 decision brief and readiness matrix still leave target topology/hosting, public-versus-private access boundary, DNS and certificates, ingress/CORS/trusted proxy behavior, database service and identities, backup retention and recovery objectives, secret delivery and rotation, monitoring and incident ownership, deployment/migration/rollback procedure, and support responsibilities unresolved. Review [M6-A10 decision brief](M6_A10_PREPRODUCTION_DECISION_BRIEF.md) and [readiness matrix](M6_A10_READINESS_MATRIX.md) for the full decision register. No target environment or operational evidence is created by this milestone.

This milestone does **not** authorize public launch. Successful local checks or CI do not authorize deployment, provider activation, collection of user data, or commerce.
