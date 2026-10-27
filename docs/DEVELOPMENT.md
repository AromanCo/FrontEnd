# Local development

1. In Backend, copy `.env.example` to `.env`. Set strong, different OTP and session peppers, `CORS_ORIGINS=http://localhost:3000`, and `COOKIE_SECURE=false` for local HTTP. Keep `SMS_PROVIDER=unconfigured` for ordinary development. Run `docker compose up --build` and confirm `http://localhost:8000/health/ready` returns 200. Seed data is managed by the backend.
2. In FrontEnd, copy `.env.example` to `.env.local`, run `npm ci`, then `npm run dev`. Open `http://localhost:3000`. Both hosts must be `localhost`.
3. Run `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` before review. GitHub Actions runs those same install and verification steps on pull requests to `develop` and `main` with Node.js 22. With the frontend and seeded backend running and system Chrome installed, run `npm run test:browser` and `npm run screenshots` locally. These browser checks need the seeded FastAPI service and are not part of GitHub CI. They exercise the real public API, mobile Studio composition, unauthenticated save, protected-route 401, and SMS-unavailable 503. Screenshot capture waits for 24 rendered notes and saves home, shop, and Studio states at 320, 390, 768, and 1440 pixels: loaded library, one selection, three layers, six notes, and result. It fails on missing API data or unexpected browser errors. Set `CHROME_BIN` if Chrome is installed elsewhere. Set `FRONTEND_ORIGIN` and `AROMAN_BROWSER_API_BASE_URL` only when using nondefault local ports; keep both application URLs on the same `localhost` hostname.

A real SMS service is not configured. With the default provider, login shows the backend's unavailable response. To exercise OTP in isolated backend tests, use the backend's existing `tests/conftest.py` fixture: `SMS_PROVIDER=fake` is limited to test/development with `FAKE_SMS_ENABLED=true`; the fixture reads the code from backend process memory, not HTTP. Run `cd ../Backend && .venv/bin/pytest tests/test_foundation.py ../FrontEnd/tests/integration/test_contract.py`. The FrontEnd contract test creates its own temporary SQLite database and checks save, reopen, edit, duplicate, and delete through FastAPI TestClient. Do not run the fake provider as a publicly reachable application or expose its messages. The UI can be visually checked through challenge and error states without a delivered code.

GitHub Actions runs `npm run test:browser:auth` on Frontend pull requests after the production build. CI starts that compiled Next.js app and uses the runner's system Chrome; no Backend process or SMS provider is involved. The Playwright journey intercepts all `/api/v1/` requests in one isolated browser context and simulates the auth contract, including the verification response's HttpOnly session cookie. Its OTP and session are test-local fixtures; this proves browser behavior against the mock contract, not real Backend authentication or SMS delivery.

To run the same mocked browser journey locally, start the FrontEnd with `npm run dev`, ensure system Chrome/Chromium is available (or set `CHROME_BIN`), then run `npm run test:browser:auth`. The full `npm run test:browser`, `npm run test:browser:guided`, `npm run test:browser:responsive`, and `npm run test:browser:integration` journeys still require their separate seeded local FastAPI setup. M2-A3's real authentication contract verification remains separate: run `cd ../Backend && .venv/bin/pytest tests/test_foundation.py ../FrontEnd/tests/integration/test_contract.py`; it uses the in-process FastAPI routes, `FakeSMS`, and temporary SQLite database. No real SMS delivery is part of the CI browser auth test.

For the isolated Guided Save-to-account browser flow, start the FrontEnd with `npm run dev`, ensure system Chrome/Chromium is available (or set `CHROME_BIN`), then run `npm run test:browser:guided-save`. This test intercepts every `/api/v1/` request in one browser context and uses explicitly synthetic, DTO-shaped family/note fixtures plus in-memory auth and concept state. It exercises the real Guided, login-dialog, Save, account, and Creative Studio UI, but does not connect to FastAPI or prove Backend persistence. The OTP and session credentials exist only in the test process; the test does not call SMS or write screenshots.

For the Guided-to-Creative edit/save/reopen browser regression, start the FrontEnd with `npm run dev`, ensure system Chrome/Chromium is available (or set `CHROME_BIN`), then run `npm run test:browser:guided-creative-save`. It uses the same isolated synthetic catalog and in-memory authentication/concept fixture as the Guided Save journey. It exercises the real six-step Guided questionnaire, one-time draft transfer, Creative Studio editing, anonymous login prompt, explicit Save retry, account listing, and reopen-by-ID UI. This mocked journey verifies Frontend behavior against the fixture contract; it does not prove real FastAPI persistence, real SMS delivery, or production authentication. It does not write screenshots.

Run `npm run test:fixture:guided-save` to check the isolated create contract without a browser or Backend. Each valid authenticated concept POST receives HTTP 201 and a new ID; list and by-ID reads retain both records. Repeated accepted POSTs can therefore create duplicate concepts. The fixture does not guarantee idempotency. Browser Save controls prevent repeated clicks while a request is pending (`npm run test:browser:save-pending` checks five clicks result in one POST and one record). After an ambiguous network failure, the client must not retry Save automatically because the first POST may have been accepted.

To verify Creative Save failure recovery, run `npm run test:browser:save-retry` with the local FrontEnd and system Chrome/Chromium available. It runs the same Guided-to-Creative UI journey but injects one synthetic HTTP 503 on the first valid Save request; the explicit retry then succeeds in the in-memory fixture. This proves the browser UI preserves edits and exposes a retry after the mocked error. It does not prove FastAPI persistence, real SMS delivery, or real service-failure behavior.

## Pinned OpenAPI contract

With `npm ci`, Python 3.12, and the Backend runtime dependencies installed, run
`npm run types:api:check`. It verifies that the adjacent `../Backend` checkout is at
the pinned revision, exports its actual FastAPI OpenAPI document without connecting
to a database, compares that JSON semantically with `docs/openapi.m1a.json`, and
compares types regenerated by the installed `openapi-typescript` with
`src/lib/api/generated.ts`. The check creates temporary files and never rewrites
either committed artifact. Use `AROMAN_TEST_BACKEND_DIR` for another pinned Backend
checkout and `AROMAN_TEST_PYTHON` for its Python interpreter (for example,
`../Backend/.venv/bin/python`). Run `npm run test:api-contract` for drift-detection
regressions; these use temporary copies of the artifacts.

To intentionally refresh both artifacts after reviewing a Backend schema change,
first update the single pinned SHA consistently as described below. Then run
`npm run types:api:refresh` against that exact Backend revision and review the JSON
and TypeScript diffs before committing them. A standalone `npm run types:api` only
regenerates types from the existing snapshot; it does not validate Backend alignment.
The CI `real-stack-browser` job requires both the contract check and its negative
tests before starting the browser journey.

Schema and generated-type alignment only detect declared OpenAPI drift. They do not
prove every runtime behavior, HTTP error code, database rule, or authorization
policy. The separate real-stack browser gate tests authenticated workflows.

# Real FrontEnd–Backend browser gate

The real-stack Chromium gates run Next.js against the pinned public Backend commit
`4c5d474c3422f3f4e32fcb159d2acf1f9dd06d74`. Both migrate and seed a fresh
test database, then start FastAPI and Next.js on loopback. The fake OTP is read
from the FastAPI process through a private Unix socket. The SQLite gate uses a
temporary database file. The PostgreSQL gate creates its own PostgreSQL 17 Docker
container with random test credentials, a Docker-selected port bound only to
`127.0.0.1`, and a memory-backed data directory. It neither accepts an external
database URL nor attaches a persistent volume. The runner stops only its own
container and removes temporary files and child processes on success, failure,
and SIGINT/SIGTERM; it reports cleanup failures.

With Node.js 22, Python 3.12, Chromium (`CHROME_BIN` if needed), `npm ci`, and the
Backend runtime dependencies from its `pyproject.toml` installed, run the SQLite
gate:

```sh
AROMAN_TEST_BACKEND_DIR=../Backend npm run test:browser:real-stack
```

For PostgreSQL, also install Docker with a running daemon and the Backend's
`psycopg[binary]>=3.2,<4` and `httpx>=0.27,<1` dependencies. Run:

```sh
AROMAN_TEST_BACKEND_DIR=../Backend npm run test:browser:real-stack:postgres
AROMAN_TEST_BACKEND_DIR=../Backend npm run test:postgres:transactions
```

Set `AROMAN_TEST_PYTHON` to a Python interpreter with those dependencies if needed.
An unavailable container fails the PostgreSQL gate explicitly; it never falls back
to SQLite. Both gates check the actual database dialect, migration revision, and
seed counts before the browser journey.

The Backend checkout must be at the exact pinned commit. To update it deliberately,
review the new Backend contract and migrations, then update the SHA in
`scripts/backend-pin.mjs`, `.github/workflows/ci.yml`, and this document
together. CI runs independent SQLite and PostgreSQL real-stack jobs alongside the
synthetic Chromium, Firefox, and WebKit verification. These journeys cover the
specified single-user browser workflow. The separate transaction command starts
another disposable PostgreSQL 17 database, verifies its identity before migration
and before using test-only accounts, then exercises the pinned FastAPI routes with
independent request contexts and database sessions. It checks that overlapping
full-replacement updates block on the concept row and end in one complete state;
that invalid input and a database insert failure roll back note changes; that a
duplicate/update race copies a complete state; and that simultaneous foreign-user
reads and writes return 404. It also checks distinct IDs for repeated accepted
creates and verifies concept-note relationships and uniqueness in PostgreSQL.
The test-only insert-failure trigger exists only in the generated database and is
removed after the assertion. Transaction data cannot affect the browser journey,
which uses its own container. CI runs this command as a required step in the
PostgreSQL job and does not use SQLite as a fallback.

These tests cover the specified transaction invariants. They do not replace load
testing or prove throughput or latency under production traffic. They also do not
establish production role permissions, backups, or deployment configuration.
