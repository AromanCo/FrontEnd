# F1-A — Source-only two-account FakeSMS acceptance candidate

**Target:** Main AROMAN product, not coming-soon, showcase or any VPS.
**Tracking:** [FrontEnd Issue #69](https://github.com/AromanCo/FrontEnd/issues/69).
**Status:** Source-only candidate; the new PostgreSQL/FakeSMS journey has **not been executed**.

## Exact revision boundaries

- FrontEnd source branch: `feat/f1a-synthetic-two-account-acceptance`, based on `develop` at `f3cbe0889f43cc825cfd462d2ec8bd1285816f9a`.
- Backend candidate is pinned to `e69c286f6758847c08077b12ab621341ebb2a557` in `scripts/f1-account-backend-pin.mjs`, rather than changing the older R3C-B candidate pin or the main/showcase infrastructure pins.
- The existing `scripts/real-stack-runner.mjs` is reused only in its new `f1-account` mode; this mode always selects ephemeral PostgreSQL, private FakeSMS and an isolated Next.js build directory.
- Real-stack mode requires `AROMAN_F1_ACCOUNT_EPHEMERAL_ACK=isolated-postgres-fakesms-only` as an **accidental-invocation guard**, not a substitute for explicit product-owner authorization.

## Tests added

`npm run test:f1-account-runner-guard` is offline and safe: it rejects a missing runtime acknowledgment before checking a Backend worktree or calling Docker.

The **not-yet-executed** `test:browser:f1-account:postgres` is designed to verify:

1. Anonymous concepts are rejected; Account A signs in via a real challenge and a test-only Unix-socket FakeSMS code, with no OTP returned by HTTP.
2. A obtains a server-validated session, creates and lists one concept, reloads, edits, duplicates and deletes the duplicate; cookies remain HttpOnly and scoped.
3. A logs out and the Backend rejects the revoked session.
4. B signs in within that same browser context, has a distinct user identity, sees an empty collection and cannot read, edit, duplicate or delete A's concept via the real API.
5. Mobile Persian RTL layout and browser page errors are checked. Cleanup remains delegated to the existing exact-container-ID and temporary-directory guard.

These tests do not yet prove expired OTP, rate limits, service outages, relogin persistence or complete Guided → Creative → Smart Perfumer functionality. Those remain explicitly open on Issue #69/F2/F3.

## Safety requirements before the first real-stack run

- Obtain **separate owner approval** specifically for one disposable local PostgreSQL 17 + private FakeSMS + headless Chrome run. The source-only approval and merges do not grant this execution.
- Confirm exact clean worktree SHA, Backend Python environment, Docker access and image, loopback-only ports, no external DB URL, no shared persistent named volume, and no active main/showcase/account-demo conflict.
- Verify disposable container name, unique ID, private `tmpfs` database, ownership label, expected temporary outputs and exact-ID cleanup. Abort on ambiguity; do not attempt broad Docker cleanup.
- Do not put OTP, session cookies, DB passwords or CSRF values into GitHub evidence or terminal transcripts.
- Preserve existing persistent named volumes and all 98 Smart Perfumer artifacts; no real SMS credentials, payments or deployment.
- Run the offline guard, lint, typecheck, CI and source review first. If an acceptance run later fails, report the failure; do not silently upgrade Backend pins or touch a persistent stack to make it pass.

**Execution command after separate approval and preflight only:**

```bash
AROMAN_TEST_BACKEND_DIR=/absolute/path/to/pinned/disposable/backend \
AROMAN_TEST_PYTHON=/absolute/path/to/test/python \
AROMAN_F1_ACCOUNT_EPHEMERAL_ACK=isolated-postgres-fakesms-only \
npm run test:browser:f1-account:postgres
```

The acknowledgment string above is a technical safety barrier, **not permission**. It must not be set or used until the owner separately authorizes this exact isolated run.
