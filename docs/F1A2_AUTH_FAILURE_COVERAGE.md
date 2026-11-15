# F1-A2 — Source-only failure-path coverage

**Product:** Main AROMAN application (not the coming-soon website).
**Tracking:** [FrontEnd Issue #69](https://github.com/AromanCo/FrontEnd/issues/69).
**Execution boundary:** FrontEnd mocked-unit tests only. No PostgreSQL, Chrome, external SMS, migration, seeding, production account, or persistent Docker resource is required or authorized by this change.

## Source-only behaviors covered

| Failure or recovery path | Contract evidence | Live F1 acceptance |
| --- | --- | --- |
| Challenge 429 and SMS outage 503 | Login form remains on mobile entry; API transport never silently replays the request | Pending |
| OTP invalid/expired 400 | Login form keeps the code step and permits deliberate retry; does not refresh profile | Pending |
| OTP throttled 429 / service outage 503 | No account navigation or silent verification replay; retry remains explicit | Pending |
| Verify retry after temporary outage | The same code may be resubmitted deliberately; no second challenge is sent | Pending |
| Resend failure and recovery | No false success, no lost code entry, deliberate retry available; successful resend clears stale code | Pending |
| Persian and Arabic digit entry | Normalized to ASCII for both mobile and OTP submission | Pending |
| Session boot / refresh 401, 503, network error | Guest only after 401; transient errors retain known identity or unresolved loading state | Pending |
| Logout 503 and already-revoked 401 | 503 never falsely claims logout; 401 clears local authentication state | Pending |
| CSRF mismatch and authenticated mutation failures | Single CSRF refresh/retry only on `csrf_invalid`; no replay of an ambiguous network write | Pending |

The pinned Backend source already contains tests for OTP expiry, single-use/replay, failed-attempt limits, resend invalidation, API request throttling, sender uncertainty and server-side logout revocation (for example `tests/test_foundation.py` and `tests/test_kavenegar_integration.py`). **Those Backend tests are not executed by this FrontEnd-only change**, and any prior test evidence must not be mistaken for a new F1 run.

## Verification commands (source only)

```bash
npm run typecheck
npm run lint
npm test -- --run src/tests/login-form.test.tsx src/tests/auth-provider.test.tsx src/tests/client.test.ts
npm test
git diff --check
```

## Still open

- Execute the exact separate F1-A3 two-account PostgreSQL + private FakeSMS + Chrome candidate from draft PR #70, **only after the owner's explicit scoped approval and preflight**.
- Prove expired/replayed codes, throttling and transport-outage handling against a real isolated Backend/DB; mocked FrontEnd responses alone do not prove server enforcement.
- Prove saved-concept retention across relogin and complete Guided → Creative → Smart Perfumer journeys in later F2/F3 acceptance.
- Real SMS credentials, production accounts, payments, deployment and broad UI redesign remain out of scope.
