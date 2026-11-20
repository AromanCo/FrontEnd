# F3-B — saved-source continuity and one-time F3-C candidate

Tracking: [FrontEnd F3 #77](https://github.com/AromanCo/FrontEnd/issues/77). This is **source-only** engineering and does not grant a test-execution or deployment approval.

## Pinned scope

- FrontEnd starting point: `develop` at `1b79d670f4eb08853d9dfa90fbf373e7731f9241` (F2-E).
- Backend pin: `e69c286f6758847c08077b12ab621341ebb2a557`.
- F2-E owner-run acceptance: **PASS** on these revisions (42 API responses, PostgreSQL before/after PASS, no test-owned containers, volume-inventory equality). See F2 #73.
- F3-A source-only Guided → Advisor Reject/Apply/Undo → explicit Save regression: already merged in PR #78.

## What F3-B adds

1. A four-note, three-layer saved-source component test covers the previously unverified **same-layer position swap** rule: `top(A0), heart(B0,C1), base(D0)` suggests `top(A0), heart(C0,B1), base(D0)`. The source is reopened after an explicit fork create, and the test checks no original PUT, no implicit create, and exact source preservation.
2. A distinct `f3-continuity` real-stack mode is disabled unless the owner supplies **F3-specific** acknowledgment `AROMAN_F3_CONTINUITY_EPHEMERAL_ACK=f3-isolated-postgres-fakesms-only`. The mode enforces the fixed Backend commit, PostgreSQL 17 in a disposable tmpfs volume on loopback, FakeSMS over a private IPC socket, and test-owned container cleanup. It does not reuse F2 approval.
3. A **candidate** F3-C headless Chrome journey authenticates a synthetic customer via private FakeSMS; creates a four-note source record via the real API; opens it in Creative at 390px; checks preview and Reject never write; confirms the Advisor fork is in-memory; performs one explicit fork POST; rereads source and fork from real PostgreSQL; verifies exact original preservation and proposed heart-layer order; and checks the original source at desktop width. No API route mocking is used.
4. An offline guard checks missing/wrong F3 acknowledgment fails before Docker, even on the right source; the right acknowledgment with an intentionally wrong Backend checkout also fails before Docker. It checks the candidate's resource and no-mocking invariants.

## Required F3-C approval and execution

**Do not run the candidate as part of CI or automatically on merge.** A new, separately owner-approved, one-time invocation on the owner's local machine is required. The execution must use fresh exact detached worktrees, a preflight ensuring no `aroman.real-stack=test-owned` container exists, record the full named Docker-volume inventory before/after, and inspect residual test-owned containers. Do not run if the Backend environment, PostgreSQL image, Docker preflight or source SHA does not match.

After merge, use the **merged frontend commit SHA**, not this branch's unmerged commit, for the local preflight. The only intended runtime command within that preflight is `npm run test:browser:f3-continuity:postgres` with `AROMAN_F3_CONTINUITY_EPHEMERAL_ACK=f3-isolated-postgres-fakesms-only` plus the same isolated Backend Python/worktree variables as F2.

## Evidence, limitations and boundaries

- F3-B source-only verification: focused BlendAdvisor **38/38**, F3 runner guard **7/7**, full Vitest **305/305** across 26 files, TypeScript PASS; lint zero errors and one existing AccountContent warning. No PostgreSQL/Chrome run was made while preparing F3-B.
- The new browser script is **not yet validated against a real stack**; its PASS status must be determined by its separately approved local run. The earlier fixture-based Smart Perfumer fork journey does not substitute for this real source/fork database comparison.
- Source-only tests cannot certify the complete F3 breakpoint, keyboard, outage or concurrency matrix. Do not declare F3 functionally frozen until owner-run F3-C evidence and review close the remaining gaps.
- No real SMS/provider credentials, payment, manufacturing/chemistry claims, external AI service, staging/VPS/deployment, existing Docker volumes, original source worktrees, or existing 98 Smart Perfumer artifacts are in scope.
