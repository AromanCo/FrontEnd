# M6-A14 — Private Exploration Integration and Release Architecture

## Status and evidence boundary

This milestone defines a **proposed preproduction architecture** and adds a reproducible, private repository integration test. It does not create or validate a deployed environment. The test is intended to run locally or in an isolated GitHub Actions runner with synthetic data and loopback services only.

Verified source baselines for this work:

- Frontend: `AromanCo/FrontEnd`, branch `feat/m6-a14-private-exploration-integration`, HEAD `43219f2f91a2abcb58d15931c6c0950b0413920b`.
- Backend: `AromanCo/Backend`, HEAD `0be24c4597bd693e70348243c26e550a20a8ad0e`.
- Active Frontend integration pin: `scripts/backend-pin.mjs`, checked against the Backend checkout before contract export or integration startup.

These are repository identities, not deployed service revisions. Passing repository tests proves only the behavior exercised by those tests and their test environment. It does not prove DNS, certificates, hosting, network isolation outside the runner, production PostgreSQL roles, operational readiness, or public release suitability.

## Verified application topology

The Backend revision exposes two distinct ASGI applications. The normal internal application remains `aroman.main:app`. The restricted catalog application is `aroman.exploration_api:app`. The new test starts **only** `aroman.exploration_api:app` as the HTTP API, with Uvicorn bound to `127.0.0.1` on an operating-system-selected port. Starting `aroman.main:app` would invalidate this test.

The proposed preproduction topology is:

```text
Approved private browser
        │ HTTPS, exact configured Frontend origin
        ▼
Frontend web process (exploration release scope)
        │ catalog GET only over a private service path
        ▼
Restricted catalog ASGI application: aroman.exploration_api:app
        │ read-only catalog database identity
        ▼
Preproduction catalog database
```

This diagram is a design proposal. No ingress, service path, firewall, hostname, certificate, database service, or role was provisioned or exercised by M6-A14.

The restricted Backend currently registers five public routes and methods only:

- `GET /api/v1/brands`
- `GET /api/v1/products`
- `GET /api/v1/products/{product_id}/variants`
- `GET /api/v1/fragrance-families`
- `GET /api/v1/fragrance-notes`

It rejects other paths and methods at its application boundary. It disables docs, redoc, and OpenAPI routes. This is application behavior, not a network firewall or database permission. A deployed catalog process must receive a database identity that has only the reads needed by these catalog routes. Migration credentials must be separate and unavailable to the running application.

## Private integration command

Run with Node.js 22, Python 3.12, installed Frontend dependencies, the pinned Backend Python dependencies, and Chromium available to Playwright:

```sh
AROMAN_TEST_BACKEND_DIR=../Backend \
AROMAN_TEST_PYTHON=python3.12 \
npm run test:browser:exploration-real-stack
```

The runner checks the exact Backend SHA, selects two available loopback ports, creates its SQLite file in a unique operating-system temporary directory, checks that it is initially empty, applies the Backend Alembic migrations, seeds the existing demonstrative catalog, and verifies migration `a4b01`, record counts, demo flags, and zero saved concepts. No real user records or credentials are used.

It then builds Next.js with `AROMAN_RELEASE_SCOPE=full` and sets `NEXT_PUBLIC_AROMAN_API_BASE_URL` before compilation. The browser app runs from that compiled build with `AROMAN_RELEASE_SCOPE=exploration`. The API target is explicitly `aroman.exploration_api:app`. The browser journey uses Chromium through the repository Playwright helper. It observes browser API requests and allows them to continue to the actual Uvicorn process; it does not fulfill catalog routes with Playwright fixtures.

The journey checks seeded products and variants, family and note catalogs, Home, shop, product detail, the Guided questionnaire, Creative note selection and Smart Perfumer behavior, and in-memory Guided-to-Creative transfer. It checks that account, login, cart, and checkout Frontend routes are unavailable and save controls are absent. Browser routes reject any non-loopback origin, any unapproved API request, and any authentication, user, or saved-concept request.

Independent direct HTTP checks exercise approved catalog GETs and reject login/authentication, OTP, user, saved-concept, health, docs, redoc, OpenAPI, unknown, write, and OPTIONS requests. CORS checks require the configured Frontend origin exactly, credential allowance on an approved GET, and no allow-origin response for an unrelated origin. The exploration API has no health endpoint; runner readiness is established with an approved catalog GET, never `/health/ready`.

The runner stops only its own process groups and deletes only its uniquely claimed build directory and its temporary directory. It handles SIGINT/SIGTERM, startup failures, and child exits, and verifies that runner process groups are gone. It does not start Docker, publish ports, call SMS or payment providers, or stop user-owned processes/containers. Next telemetry is disabled, proxy environment variables are removed from test child processes, and Chromium blocks unexpected external requests. Test logs should be reviewed for failures; diagnostics are bounded and redact secret-like environment values.

## CI and test evidence

The `exploration-real-stack-browser` workflow job runs for pull requests targeting `develop` and `main`. It installs Node.js 22, Python 3.12, Backend dependencies from the exact pinned checkout, and Chromium, then runs the private command. Existing `verify`, `real-stack-browser`, `postgres-real-stack-browser`, and `exploration-release` jobs remain in place.

Test categories remain distinct:

- `exploration-real-stack-browser`: actual restricted FastAPI process, disposable migrated/seeded SQLite, compiled Next.js process, real Chromium catalog HTTP requests.
- `real-stack-browser` and `postgres-real-stack-browser`: existing full internal Backend real-stack journeys and their existing authentication-oriented fixtures/OTP test access.
- `exploration-release`: compiled Frontend exploration acceptance with synthetic catalog API fixture responses. It remains an independent fast release-scope check; it is not evidence of Backend integration.
- Vitest and other fixture journeys: Frontend logic/UI behavior using mock data or isolated fixtures, as named by their tests.

Repository CI results are not deployed evidence. No successful GitHub run is claimed by this document. Locally, the applicable checks include:

```sh
npm run types:api:check
npm run test:api-contract
npm run typecheck
npm run lint
npm test
node --test tests/local-release-smoke.check.mjs
npm run test:browser:real-stack
npm run test:browser:exploration-real-stack
node scripts/exploration-release-journey.mjs
git diff --check
```

The existing API contract compares the pinned internal Backend OpenAPI export and generated types with committed artifacts. If those artifacts differ at the new pin, the difference must be investigated and described before intentionally refreshing either committed artifact. The exploration API has a separate narrower runtime allowlist; the internal API contract and full-mode regressions must remain intact.

## Proposed preproduction controls and outstanding decisions

### Public/private traffic separation

The browser-facing access boundary and Backend catalog service boundary must be explicit. Public web ingress, if later authorized, should expose only the approved exploration Frontend behavior. The restricted catalog API should be reachable only from its intended Frontend/service network path, with a firewall denying direct public access and unrelated private peers. Keep authentication and saved-concept APIs unavailable in exploration scope. Do not treat CORS as access control: it constrains browsers but does not block direct clients.

### Origin, HTTPS, and firewall

Configure exact allowed browser origins for the Frontend and return credentialed CORS headers only for those exact origins. Do not use wildcard origins with credentials. Configure HTTPS termination, trusted proxy addresses, secure browser policy, and certificate renewal only after an owner approves the hostname and topology. Apply ingress and egress firewall rules so the API, database, and management interfaces have only required peers. These controls were not deployed or validated here.

### Database identity and schema changes

The production-like catalog process must use a dedicated read-only database identity with SELECT privileges limited to required catalog tables/views. Validate denied INSERT/UPDATE/DELETE and schema privileges with the actual preproduction grant set. Use a separate migrator identity through a controlled migration procedure. The local runner uses disposable SQLite and therefore does not establish PostgreSQL grants or runtime behavior under production roles.

### Secrets and access control

Use an approved secret delivery system with named owners, least-privilege access, audit records, rotation and revocation procedures, and incident handling. Separate test, preproduction, and production secrets. Do not place values in repository files, build-time public variables, browser assets, or CI logs. Restrict preproduction access to approved people and service identities, and define how access is removed. This milestone uses random synthetic pepper values only to satisfy Backend configuration; it does not validate a secret manager.

### Health checks, logging, and operations

The restricted application intentionally has no public health routes. Deployment liveness and readiness signals should be private orchestration mechanisms or protected internal checks; a public unauthenticated health endpoint must not be added to the exploration API. For this test, only approved catalog GET readiness is used. Define structured, redacted logs, request/error metrics, alert thresholds, retention, on-call ownership, and incident response before a preproduction service is operated. Never log credentials, tokens, personal data, or secret values.

### Backups, restore, release, and rollback

For any preproduction database that matters, define backup encryption, retention, access custody, recovery point/time objectives, and a scheduled restore rehearsal that validates both data and application operation. Define migration review, deployment sequencing, rollback authority, and recovery from an incompatible schema migration. M6-A14's ephemeral SQLite file is deleted after the test and is not a backup or restore validation.

### Outstanding M6-A10 decisions

The M6-A10 decision register remains open: release scope and permitted data; private/public reachability and authorized users; hosting location/provider and operational owner; domain, DNS and certificate responsibility; ingress, exact production origins, trusted proxy ranges and cookie policy; database service, app/migrator identities and recovery procedure; backup retention and RPO/RTO; secret delivery and rotation; whether real SMS is needed; monitoring, logs, retention, on-call and support; deployment and rollback authority; and any future commerce approval. M6-A14 selects none of these and does not authorize deployment, public exposure, SMS, commerce, or a hosting provider.

See [M6-A10 Preproduction Decision Brief](M6_A10_PREPRODUCTION_DECISION_BRIEF.md), [M6-A10 Readiness Matrix](M6_A10_READINESS_MATRIX.md), and [Launch Readiness Audit](LAUNCH_READINESS.md) for the decision and operational gates.
