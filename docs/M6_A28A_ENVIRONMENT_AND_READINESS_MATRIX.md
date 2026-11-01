# M6-A28A — Environment and Deployment Readiness Matrix

**Inventory date:** 2026-11-01
**Frontend:** `develop` at `9859529b7d01c6359dc09ec988d35c5979508e96`
**Backend:** read-only `develop` at `0be24c4597bd693e70348243c26e550a20a8ad0e`
**Purpose:** document repository configuration and future acceptance evidence. This is not a deployment authorization or a claim that target infrastructure was tested.

Companion: [M6-A28A Architecture Inventory](M6_A28A_ARCHITECTURE_INVENTORY.md).

## Status vocabulary

- **IMPLEMENTED** — source or configuration exists in the inspected repository.
- **VERIFIED IN TESTS** — automated tests exercise the stated behavior. This label does not mean M6-A28A ran the tests or verified infrastructure.
- **MISSING** — required capability/configuration/evidence is not present in inspected source.
- **UNKNOWN** — not established by repository evidence or a safe local inspection.
- **OWNER DECISION REQUIRED** — a named product/security/operations/spending approval is needed before implementation or release.

## Environment-variable inventory

Only variable names and non-secret behavior are recorded. No `.env` value or private secret file was read. “Required” describes checked source/template behavior; a value being accepted by code does not constitute owner approval.

### Frontend application and M6-A27 template

| Variable | Consumer | Required / class | Source; default or validation | Outstanding requirement | Status |
| --- | --- | --- | --- | --- | --- |
| `AROMAN_RELEASE_SCOPE` | Next.js build/runtime | Required to select release mode; non-secret | `scripts/public-showcase-build.mjs`, `scripts/public-showcase-start.mjs`, `src/lib/release-scope.ts`; accepts `full`, `exploration`, `public-showcase`; production implicit default is exploration. | Scope approval and build/runtime match; A27 sets public-showcase in its template. | IMPLEMENTED |
| `NEXT_PUBLIC_AROMAN_API_BASE_URL` | Browser build and runtime | Public/non-secret configuration; required for public-showcase build | `src/lib/public-showcase-config.mjs`, `src/lib/api/client.ts`; public mode accepts exactly `/api/v1` or canonical HTTPS `/api/v1`; development fallback is localhost API; production no usable fallback. Embedded in compiled browser config. | Public mode must use reviewed same-origin route or approved HTTPS API; never put credentials here. | IMPLEMENTED |
| `AROMAN_API_BASE_URL` | Next.js server-side API client | Optional; non-secret URL configuration | `src/lib/api/client.ts`; server client prefers this, then absolute browser base, then development localhost; no production default. | Only needed for server-side flows using the full API; no production target URL approved. | IMPLEMENTED |
| `AROMAN_CATALOG_UPSTREAM_URL` | Next.js server API route | Required for same-origin public catalog operation; non-secret internal URL | `src/lib/public-showcase-config.mjs`, `src/app/api/v1/[...path]/route.ts`; canonical HTTP(S) origin and exact `/api/v1` path, no userinfo/query/fragment; A27 template uses service DNS. | Must remain server-only and point only to restricted API. Target network path is unverified. | IMPLEMENTED |
| `AROMAN_TEST_NEXT_DIST_DIR` | Next.js config/build tests | Optional; non-secret test path | `next.config.mjs`, build/test helpers; defaults to `.next`, restricted by build wrapper to a local `.next*` directory. | Test-only; do not set to a production/source directory. | IMPLEMENTED |
| `NODE_ENV` | Next.js and libraries | Runtime mode; non-secret | Next.js/npm standard; build/start scripts use production behavior. | Must be production for deployed artifact; actual runtime not verified. | IMPLEMENTED |
| `PORT` | Frontend container | Optional; non-secret | A27 Compose sets container port `3000`; Next supports standard `PORT`. | Host port selection remains an operator/owner check; only IPv4 loopback mapping is templated. | IMPLEMENTED |
| `HOSTNAME` | Frontend container | Optional; non-secret bind setting | A27 Compose/Dockerfile set `0.0.0.0` inside container; host publication is separately bound to `127.0.0.1`. | Must not be confused with public host exposure; effective host firewall/Nginx behavior remains unknown. | IMPLEMENTED |
| `NEXT_TELEMETRY_DISABLED` | Next.js runtime/build | Optional; non-secret | A27 Frontend Dockerfile sets `1`. | No product telemetry destination is configured by this variable. | IMPLEMENTED |
| `AROMAN_TEST_BACKEND_DIR` | Contract/integration test scripts | Optional; non-secret local path | Defaults to adjacent `../Backend`; scripts verify the configured checkout against the pin. | CI supplies its pinned checkout path; not a production variable. | IMPLEMENTED |
| `AROMAN_TEST_PYTHON` | Python-backed Frontend test scripts | Optional; non-secret executable/path | Defaults to `python3.12`; CI points to its configured Python. | Test-only. | IMPLEMENTED |
| `AROMAN_TEST_OTP_SOCKET` | Real-stack test harness | Optional; sensitive test IPC path, not a credential | `scripts/real-stack-journey.mjs`; used to read synthetic FakeSMS OTP from a private test socket. | Never expose or use in a deployed service. | IMPLEMENTED |
| `FRONTEND_ORIGIN` | Browser journeys | Optional; non-secret test URL | Journeys default to local loopback/localhost ports. | Test-only; may only target the local test server in these runs. | IMPLEMENTED |
| `AROMAN_BROWSER_API_BASE_URL` | Browser/test fixture journeys | Optional; non-secret test URL | `scripts/browser-utils.mjs`, Guided fixture; local API default. | Do not use as a production secret or target selector. | IMPLEMENTED |
| `API_ORIGIN` | Guided/browser test scripts | Optional; non-secret test URL | Defaults to local API in browser journeys. | Test-only. | IMPLEMENTED |
| `BROWSER_ENGINE`, `CHROME_BIN` | Playwright journeys | Optional; non-secret tooling configuration | Defaults to Chromium/system Chrome locations. | Test tooling only. | IMPLEMENTED |
| `QA_SCREENSHOT_DIR`, `QA_RESPONSIVE_SCREENSHOT_DIR`, `QA_INTEGRATION_SCREENSHOT_DIR`, `SMART_PERFUMER_SCREENSHOT_DIR`, `GUIDED_SCREENSHOTS_MOBILE_NOTES_ONLY` | Browser/screenshot scripts | Optional; non-secret local output/configuration | Scripts default to `artifacts/` paths; boolean switch is explicit `1`. Existing untracked Smart Perfumer artifacts are preserved. | Keep generated files out of unrelated milestone diffs. | IMPLEMENTED |

### Backend Settings and local Compose

Backend Pydantic Settings reads case-insensitive environment names from `../../Backend/aroman/core/config.py`; local Compose mapping is `../../Backend/docker-compose.yml`. Secret variables are listed by name only.

| Variable | Consumer | Required / class | Default or validation behavior | Outstanding requirement | Status |
| --- | --- | --- | --- | --- | --- |
| `ENVIRONMENT` | Backend | Optional non-secret mode | `development`; allowed `development`, `test`, `production`, `staging`. Production/staging enforce secure configuration. | Target mode and exact policy need approval. | IMPLEMENTED |
| `DATABASE_URL` | Backend and migration process | Required secret-bearing connection URL | Defaults empty and startup rejects it; production/staging reject SQLite. Local Compose uses separate application/migrator URLs assembled from password interpolation. | External secret manager, separated roles, rotation and approved target endpoint are not configured. | IMPLEMENTED |
| `OTP_PEPPER` | Backend authentication | Required secret | Defaults empty; at least 32 characters. | Secret injection/rotation and incident procedure required if authentication is in scope. | IMPLEMENTED |
| `SESSION_PEPPER` | Backend sessions | Required secret | Defaults empty; at least 32 characters and must differ from OTP pepper. | Same as above; public showcase excludes authentication. | IMPLEMENTED |
| `SMS_PROVIDER` | Backend authentication | Optional non-secret selector | `unconfigured`; only `unconfigured` or `fake`; no real provider adapter selected. | A provider decision and real delivery integration are required only if login is approved. | OWNER DECISION REQUIRED |
| `FAKE_SMS_ENABLED` | Backend test/dev | Optional non-secret safety switch | `false`; FakeSMS requires explicit opt-in and only development/test. | Must remain disabled and unreachable in any staging/production environment. | IMPLEMENTED |
| `CORS_ORIGINS` | Backend CORS/origin policy | Required for real environments; non-secret origin list | Local default `http://localhost:3000`; production/staging require explicit HTTPS origins with no wildcard/path. | Exact approved origin and proxy path are not established. | OWNER DECISION REQUIRED |
| `TRUSTED_PROXY_CIDRS` | Backend client-IP/rate-limit logic | Optional non-secret network configuration | Empty default ignores forwarded addresses; malformed CIDR prevents startup. | Actual immediate proxy peers and forwarded-header sanitation require target evidence. | UNKNOWN |
| `COOKIE_SECURE` | Backend auth cookies | Optional non-secret policy | `true`; staging/production reject false. | HTTPS browser validation not performed. | IMPLEMENTED |
| `COOKIE_SAMESITE` | Backend auth cookies | Optional non-secret policy | `lax`; accepts `lax`, `strict`, `none`; `none` requires Secure. | Cross-site topology decision needed only if that flow is selected. | OWNER DECISION REQUIRED |
| `SESSION_HOURS` | Backend session expiry | Optional non-secret duration | `168`; must be positive. | Owner/security policy and operational session-invalidation behavior. | OWNER DECISION REQUIRED |
| `OTP_MINUTES` | Backend OTP expiry | Optional non-secret duration | `5`; must be positive. | Provider/abuse policy if authentication is in scope. | OWNER DECISION REQUIRED |
| `MAX_CONCEPT_NOTES` | Backend concept validation | Optional non-secret limit | `6`; must be positive; code describes this as a UX rule, not formula safety validation. | No physical-formula validation is implied. | IMPLEMENTED |
| `OPERATOR_DB_PASSWORD` | Backend local PostgreSQL bootstrap | Required secret in local Compose | Compose requires interpolation; bootstrap/admin role only. | Local Compose is not production secret management. Separate accountable human operator controls remain unconfigured. | MISSING |
| `MIGRATOR_DB_PASSWORD` | Backend local Compose migration | Required secret in local Compose | Compose requires interpolation; used by `aroman_migrator`. | Target credential provisioning and rotation not verified. | MISSING |
| `APP_DB_PASSWORD` | Backend local Compose API | Required secret in local Compose | Compose requires interpolation; used by `aroman_app`. | Target credential provisioning and rotation not verified. | MISSING |

### M6-A27 review-only deployment template variables

These names are required by `../deploy/private-preproduction/compose.yaml` and `../scripts/validate-private-compose.mjs`. Secret **values** and URLs are intentionally not reproduced.

| Variable(s) | Consumer | Required / class | Default or validation behavior | Outstanding requirement | Status |
| --- | --- | --- | --- | --- | --- |
| `AROMAN_FRONTEND_IMAGE`, `AROMAN_CATALOG_API_IMAGE`, `AROMAN_POSTGRES_IMAGE` | Compose image selection | Required non-secret artifact identities | Compose requires values; validator requires full `@sha256:<64 hex>` immutable references. | No reviewed images/digests exist. | MISSING |
| `AROMAN_FRONTEND_HOST_PORT` | Compose Frontend publication | Required non-secret port | Compose requires value; validator checks loopback binding and known conflicts. | Target port/Nginx collision inventory and host IPv4/IPv6 behavior need authorized verification. | OWNER DECISION REQUIRED |
| `AROMAN_DB_NAME` | PostgreSQL | Required non-secret database name | Validator requires `aroman`. | Target DB must be fresh, isolated, and approved. | IMPLEMENTED |
| `AROMAN_BACKEND_CORS_ORIGINS` | Restricted Backend | Required non-secret origin | Compose interpolation fails without it; validator requires approved HTTPS origin form. | Exact origin is a product/owner decision and target validation is absent. | OWNER DECISION REQUIRED |
| `AROMAN_RUNTIME_DATABASE_URL_FILE`, `AROMAN_MIGRATION_DATABASE_URL_FILE`, `AROMAN_DATABASE_BOOTSTRAP_PASSWORD_FILE`, `AROMAN_MIGRATION_PASSWORD_FILE`, `AROMAN_RUNTIME_PASSWORD_FILE`, `AROMAN_OTP_PEPPER_FILE`, `AROMAN_SESSION_PEPPER_FILE` | Compose file-backed secrets | Required sensitive file-path metadata; referenced file contents are secrets | Required interpolation; validator requires one external root-owned 0700 directory with exactly seven root:10001 0440 regular files, no symlinks/extras. | No real files are present or inspected; a managed secret owner/rotation process is outstanding. | MISSING |
| `DATABASE_URL` (resolved), `OTP_PEPPER` (resolved), `SESSION_PEPPER` (resolved) | Restricted API and controlled migration process | Secret process environment values read from each service's assigned mounted file | Entrypoint script reads the assigned file then exports only inside API or migration process. Frontend receives none. | Verify actual effective mounts and image/process behavior for any future candidate. | IMPLEMENTED |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD_FILE` | PostgreSQL container | DB name/user are non-secret; password-file path is sensitive metadata | Compose fixes bootstrap user, DB name variable, and secret-file path. | Bootstrap credential is not a human operator governance mechanism. | IMPLEMENTED |
| `PORT`, `HOSTNAME`, `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`, `ENVIRONMENT`, `COOKIE_SECURE`, `CORS_ORIGINS` | Runtime services | Non-secret service config | Values/defaults are defined in A27 Compose/Dockerfiles; public app build/runtime must keep release scope/API config aligned. | No real image builds, origin approval, or deployment occurred. | IMPLEMENTED |

## Runtime and direct dependency inventory

### Frontend

| Area | Checked-in identity | Role / boundary |
| --- | --- | --- |
| Node.js | Node 22 in Frontend CI; A27 runtime Dockerfile requires Node 22+. | Build/test/runtime. CI configuration is not production host evidence. |
| Next.js / React | Lockfile: Next.js `16.4.2`, React `19.3.1`, React DOM `19.3.1`. | Production app/runtime. |
| Build/type tools | TypeScript `5.9.3`; Tailwind/PostCSS 4.x. | Build-time. |
| Test/lint/API tooling | ESLint `9.39.5`, `eslint-config-next` `16.4.2`, Vitest `4.1.12`, Testing Library, Playwright `1.64.1`, `openapi-typescript` `7.13.0`. | Development/CI only; not copied as production dependencies by A27 Frontend Dockerfile (`npm ci --omit=dev`). |
| Complete direct development dependency set | `@tailwindcss/postcss`, `@testing-library/jest-dom`, `@testing-library/react`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `jsdom`, `openapi-typescript`, `playwright`, `postcss`, `tailwindcss`, `typescript`, `vitest` (resolved versions are recorded in `package-lock.json`). | Direct devDependencies; do not confuse them with deployed runtime dependencies. |
| Locking | `package-lock.json`; CI and Dockerfile use `npm ci`. | Frontend dependency resolution is locked for this source checkout. |
| Build artifact | Next `.next` output; public showcase build writes `public-showcase-build.json` and `release-candidate.json` with source/config/artifact identity (`scripts/public-showcase-build.mjs`, `scripts/candidate-integrity.mjs`). | Immutable candidate verification is defined; no A28A artifact was built. |

### Backend and storage

| Area | Checked-in identity | Role / boundary |
| --- | --- | --- |
| Python | Python `>=3.12`; Backend CI sets up Python 3.12; Backend Dockerfile currently starts from `python:3.12-slim`. | Runtime/build. Backend base image is not digest-pinned in its local Dockerfile. |
| Runtime Python dependencies | `fastapi>=0.115,<1`, `uvicorn[standard]>=0.34,<1`, `pydantic-settings>=2.7,<3`, `sqlalchemy>=2.0,<3`, `alembic>=1.14,<2`, `psycopg[binary]>=3.2,<4` (`../../Backend/pyproject.toml`). | API, configuration, ORM/migration, PostgreSQL driver. |
| Backend dev dependencies | pytest, httpx, ruff, mypy ranges in the `dev` extra (`../../Backend/pyproject.toml`). | Tests/type/lint only. |
| Python dependency lock | No Python lockfile is present in the inspected Backend root file inventory; Docker installs ranges at build. | Repeatable Backend image dependency resolution is not established by this checkout. |
| Database | Backend local Compose uses `postgres:17-alpine`; SQLAlchemy/psycopg connect to PostgreSQL. | A27 uses a required digest-pinned PostgreSQL image placeholder; no image identity supplied. |
| External services | No active SMS delivery provider. `unconfigured` returns unavailable; FakeSMS is in-memory test-only; Kavenegar adapter tests are offline. No target backup, monitoring, or secret-manager service is configured. | Any real provider/operations dependency requires separate owner approval. |

## Database, migration, and access requirements

The checked schema includes users/auth/session, catalog, and fragrance concepts (11 tables) in `../../Backend/aroman/models.py`. Alembic starts at `d9670763b00d` and reaches `a4b01` (`../../Backend/alembic/versions/`). A target must use a separately controlled migration operation and verify the exact Alembic head before the API starts.

The full Backend app uses distinct operator/bootstrap, migrator, and app roles in local Compose; app grants include narrow auth/concept writes and catalog reads (`../../Backend/infrastructure/postgres/01-app-role.sh`, `../../Backend/aroman/administration/grant_app_role.py`, `../../Backend/docs/PREPRODUCTION_DATABASE.md`). For the public showcase, A27 proposes `aroman_app` as SELECT-only on five catalog tables; migration profile holds the separate migrator URL and grants that exact list only after migration (`../deploy/private-preproduction/compose.yaml`, `../deploy/private-preproduction/apply-catalog-read-only-grants.py`). The template is not applied. Verify in a future approved target: runtime SELECT on those five tables succeeds; all runtime DML/DDL and reads of auth/user/concept tables fail; migrator is non-superuser and schema owner only as intended; bootstrap/operator access is separately controlled and audited.

## Docker, networking, and secret-management requirements

| Acceptance item | Repository evidence / required check | Status |
| --- | --- | --- |
| Unique project and service boundary; no unrelated network membership | A27 Compose uses `aroman-private-preproduction`, four named services, two internal project networks; validator rejects extras. Render every approved override and review effective JSON before any separately authorized action. | VERIFIED IN TESTS |
| No privileged mode, host networking, Docker socket, or unapproved bind | Validator and malicious fixtures reject these in synthetic effective configuration (`../scripts/validate-private-compose.mjs`, `../tests/fixtures/m6-a27-malicious-compose-overrides.json`). | VERIFIED IN TESTS |
| Only Frontend host publication and loopback binding | A27 template maps Frontend to `127.0.0.1`; no API/DB host `ports`; no live firewall or IPv6 tests. | IMPLEMENTED |
| Private API/DB isolation and Nginx boundary | Template networks separate Frontend/API from database; future Nginx is not configured. Actual Docker forwarding, UFW, IPv4/IPv6, bypass and public reachability have not been tested. | UNKNOWN |
| Least privilege and read-only runtime | API/migration UID 10001; read-only FS; `cap_drop: ALL`; limited Postgres grants are defined by script. Verify actual grants against an approved target database before acceptance. | IMPLEMENTED |
| Immutable images and candidate source identity | Compose requires digest-pinned image references; existing M6-A25 candidate checks bind source, backend pin, build config and compiled artifact. No images/digests/candidate for this target exist. | MISSING |
| External secrets | No secret values in Git/image/browser by design; Compose file references and validator define strict host metadata, tests use synthetic files. Secret manager, real file metadata and rotation have not been configured. | MISSING |
| Separate operator, migration, runtime access | Template separates bootstrap, migration, and runtime credentials; human operator identity/accounting and approved external access process are not configured. | OWNER DECISION REQUIRED |

## Health, observability, recovery, and release readiness

| Readiness item | Acceptance evidence required | Status |
| --- | --- | --- |
| Frontend/API/database health behavior | Frontend `/`, catalog GET, and DB `pg_isready` healthchecks are declared in A27 Compose; full Backend has `/health/live` and DB/migration-aware `/health/ready`. Disposable tests cover code paths, not target service health. | VERIFIED IN TESTS |
| Restart and resource bounds | A27 template defines bounded `on-failure:3` restart for long-running services, resource/PID limits, read-only filesystems. Verify effective engine behavior and shared-host contention. | IMPLEMENTED |
| Logging redaction, log rotation and alerting | Backend disables access logs and logs database exception type; Compose has no log rotation/driver policy or monitoring/alert routing. Target retention/redaction/alerts absent. | MISSING |
| Database backup/restore | Backend has disposable PostgreSQL backup/restore test (`../../Backend/tests/test_postgres_backup_restore.py`) and procedure; no production schedule, encryption/key custody, retention, RPO/RTO, or target restore. | MISSING |
| Rollback/recovery | M6-A27 runbook describes an approval-gated decision path; no approved previous deployed artifact or target restore evidence. | UNKNOWN |
| Rights-approved content | Public-showcase scope requires content rights review; no completed publication register/evidence is in this inventory. | OWNER DECISION REQUIRED |
| Candidate/source/artifact integrity | M6-A25 candidate verifier and release checks require Frontend source, Backend pin, build config, artifact digest, target evidence and owner gates (`scripts/candidate-integrity.mjs`, `scripts/assess-public-release-gate.mjs`). This milestone did not create a candidate. | VERIFIED IN TESTS |
| Production target evidence package | No production target evidence was collected or recorded; no control can be claimed PASS. The example records 13 controls UNVERIFIED and release NO-GO (`docs/public-target-evidence.example.json`, `docs/private-preproduction-release-record.example.json`). | MISSING |
| Actual target infrastructure behavior | Host ingress, Nginx routing, Docker/UFW behavior, API/database reachability, IPv4/IPv6 exposure, secret delivery, and live resource state have not been inspected. | UNKNOWN |
| Public release gate | The existing gate and regression tests remain in source; all 13 controls remain UNVERIFIED and public release remains NO-GO. This inventory does not relax the gate. | VERIFIED IN TESTS |
| Disk/capacity | Supplied historical server data is not live evidence; the 80 GB expansion remains planned only. Actual free space, Docker use, workload limits and backup growth need authorized measurement. | UNKNOWN |
| Owner/security signoff | Release decisions and operator/reviewer assignments must be explicitly recorded under existing M6-A25/M6-A23 processes. No approval is inferred here. | OWNER DECISION REQUIRED |

### Acceptance criteria before any separately authorized private deployment

1. Resolve and record the applicable D1–D12 decisions and name accountable deployment, security, database, recovery, and content-rights owners; retain existing release-gate semantics.
2. Verify actual host capacity, protected workloads, ports, and Nginx conflicts. Do not count the planned 80 GB disk expansion until separately purchased and measured.
3. Build once from the exact Frontend source and Backend pin; verify source tree, public artifact, image digests, package/artifact identity, and final effective Compose digest.
4. Review rendered Compose after every approved override. Require only the AROMAN services/networks/volume, no public API/database ports, loopback Frontend publication, no socket/privilege/host network, and exact resource/identity/mount constraints.
5. Verify IPv4 and IPv6 forwarding/firewall behavior, private API and database access, and the only intended ingress path through separately approved Nginx routing. No repository test substitutes for this.
6. Provision external secret files/services with least privilege and rotation. Independently verify intended service access without exposing values.
7. Apply migrations separately using the migrator; verify Alembic head and actual PostgreSQL role/table grants before starting the app. Prove prohibited reads/writes fail.
8. Approve and rehearse backup/restore, rollback, log retention/redaction, alert delivery, incident escalation, and content-rights review. Collect target evidence and independent review.
9. Keep all 13 target controls UNVERIFIED until real evidence is reviewed; keep public release NO-GO until existing release authority records actual approval.

## Owner decisions and unresolved risks

- Formal `docs/launch-decisions.example.json` has D1–D12 OPEN with blank owner/approval fields. The M6-A26/A27 planning direction for public read-only showcase and Architecture A does not resolve those formal decisions.
- Confirm first-release scope, catalog rights, and whether full auth/concepts or only restricted public catalog is intended; M6-A27 owner direction excludes login, accounts, OTP/SMS, persistence, saved concepts, orders, checkout, and payments for first release.
- Resolve target access/topology, exact hostname/origin, reverse proxy, supported ingress, network/firewall review, database and secret-management owners. No domain, provider, budget, or infrastructure choice is invented here.
- D9 and D12 are excluded from initial scope in the M6-A27 direction but still require explicit public-release disposition.
- Confirm database bootstrap/operator governance and human audit controls, migration scheduling, backup protection, retention, RPO/RTO, restore and rollback authority.
- The Afra 80 GB expansion remains PLANNED ONLY; quote and separate spending approval are required before procurement.
- Rights-approved content, monitoring/incident response, real deployment evidence, and public release authority remain outstanding.

## Approved temporary development-tooling dependency risk

**Risk:** vulnerable development-tooling dependency tree.
**Advisory:** GHSA-g3hv-75wg-m249.
**Evidence:** full `npm audit` reported 18 moderate findings; lockfile copies are `minimatch` 3.1.5, 5.1.9, and 10.2.6. `npm audit --omit=dev` reported zero vulnerabilities. M6-A27B investigated remediation and found no safe compatible upstream/API solution. No overrides, downgrades, or suppressions were applied.
**Owner status:** **TEMPORARILY ACCEPTED — REMEDIATION OPEN**, owner approval recorded 2026-11-01 as supplied for this inventory. This acceptance is not permanent and does not authorize public release.
**Accountable role:** Frontend dependency-maintenance owner is accountable for tracking and reassessment; the security/release reviewer reviews evidence and confirms closure. No individual is assigned by this record.
**Reassessment triggers:** reassess when a compatible upstream fix becomes available, when `minimatch` or its consuming ESLint/Next/OpenAPI dependency tree changes, when npm advisory data changes, and at each release-readiness/dependency-maintenance review. No calendar deadline is invented.
**Closure condition:** update the dependency tree without suppressions or incompatible overrides; confirm the lockfile contains no affected `minimatch` version for this advisory; run a clean `npm ci`, verify `npm audit` has no GHSA-g3hv-75wg-m249 findings, and pass affected lint, typecheck, API type-contract and relevant test checks. The accountable dependency-maintenance owner records the evidence and the security/release reviewer confirms closure. Until all conditions are met, status remains REMEDIATION OPEN.
**Evidence sources:** `package-lock.json`; Frontend `package.json`; `npm audit`/`npm explain minimatch` investigation recorded in the M6-A27B review; consumer API usage includes ESLint plugins and Redocly (`node_modules` at investigation time). Do not infer the tree is fixed until a new lockfile and audit confirm it.

## Non-authorizations and evidence boundary

This inventory creates no deployment candidate or live preproduction environment. No Backend files, application files, Docker resources, migrations, servers, DNS, firewalls, Nginx, external SMS, or release decisions were changed. No live target evidence or production acceptance is claimed.
