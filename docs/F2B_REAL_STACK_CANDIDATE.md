# F2-B — Approval-gated saved-concept real-stack candidate

**Tracking:** [F2 Issue #73](https://github.com/AromanCo/FrontEnd/issues/73). This is an **unexecuted, source-only** test candidate; it must not be described as real-stack acceptance evidence.

## Exact source and safety boundary

- FrontEnd base: `develop` at `05104acaa043a5aff14a39684c6f26d42d87be6a`.
- Backend requirement: `e69c286f6758847c08077b12ab621341ebb2a557`, independently pinned by `scripts/f2-concept-backend-pin.mjs`.
- Test-only mode: `npm run test:browser:f2-concepts:postgres`. It requires the **distinct F2 acknowledgment** `AROMAN_F2_CONCEPT_EPHEMERAL_ACK=f2-isolated-postgres-fakesms-only`; this is an accidental-execution barrier, not owner authorization.
- Before Backend checkout validation or Docker access, missing/wrong acknowledgment fails closed. The F1-A4 approval does not authorize F2 execution.
- If separately approved, the existing runner creates a uniquely named/ID-captured `postgres:17` container with `--rm`, `--tmpfs` data, `127.0.0.1::5432` ephemeral binding, test-owned label, randomized credentials, loopback API/Next ports, private Unix-socket FakeSMS and isolated `.next-real-stack-*` output. Cleanup checks the exact captured container identity.
- No named Docker volume is attached or eligible for cleanup. No original source worktree, live authentication provider, payment, production catalog, public showcase, real users, VPN/VPS or the 98 Smart Perfumer assets are changed by this candidate.

## Intended proof after a separately approved run

1. Guest completes Guided choices and sees a conceptual result; guest Save presents login without writing.
2. Account A authenticates with a private FakeSMS OTP; challenge HTTP does not disclose OTP; the Guided result persists; login does not auto-save.
3. A second explicit Save produces exactly one accepted create with the visible name, note IDs, layers and positions; another Save is disabled.
4. A sees the saved concept in Account, logs out with server-session revocation, logs back in and sees the same durable record.
   The test deliberately respects the Backend's 60-second per-mobile OTP challenge cooldown before the second account-A challenge; it does not bypass or mutate the rate-limit database state.
5. Account → Creative reopens by ID, renames and saves via **PUT** rather than creating another record.
6. Account UI Duplicate creates one separate record; UI Delete removes only that duplicate, preserving the original.
7. After switching to account B in the same browser context, B sees no A card or concept and API GET/PUT/duplicate/DELETE fail closed on A's record.
8. Existing page-error and 390px Persian layout checks remain intact; the isolated runner checks PostgreSQL state before/after and removes its own disposable resources.

## Not covered by this one candidate

- 320/768/1440 responsive and actual keyboard/screen-reader acceptance, which belong to later F2/F5 checks.
- Injected 401/429/503, ambiguous network-write outcomes and OTP expiry in a real Backend/PG rehearsal; existing mocked/offline tests do not establish these runtime conditions.
- Smart Perfumer Apply/Reject/Undo and comparison, which belong to F3.
- Persistent main/showcase/account-demo databases, production SMS, payments, deployments or commerce.

## Local source-only verification

Run `npm run test:f2-concept-runner-guard`, `node --check scripts/f2-concept-journey.mjs`, `npm run typecheck`, `npm run lint` and the ordinary FrontEnd unit tests. These checks **must not** run the guarded F2 browser mode, since no F2 PostgreSQL/Chrome execution has been authorized.

Before any proposed real-stack run, request fresh explicit approval and separately verify the exact local source SHAs, clean worktrees, image and Python dependencies, resource inventory, unchanged protected volume names, loopback ports, full cleanup path and artifact retention. One approved run is one run; report any failure without unapproved retries.
