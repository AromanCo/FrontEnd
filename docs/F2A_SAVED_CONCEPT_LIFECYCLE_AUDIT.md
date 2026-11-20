# F2-A — Saved concept lifecycle source-only audit

**Tracking:** [F2 Issue #73](https://github.com/AromanCo/FrontEnd/issues/73)

**Scope:** Main AROMAN product, FrontEnd `develop` at `05104acaa043a5aff14a39684c6f26d42d87be6a`; pinned Backend `e69c286f6758847c08077b12ab621341ebb2a557`.
**Evidence class:** Source review and isolated mocked FrontEnd tests only. No PostgreSQL, FakeSMS, Chrome or VPS execution by this slice.

## Existing implementation reused

| Journey component | Existing source and behavior | Current verification limit |
| --- | --- | --- |
| Guided result Save | `GuidedStudio.tsx` and `GuidedResult.tsx` use user-triggered Save with a pending/saved/error state keyed to the recommendation snapshot | Existing unit tests exercise successful Save, double-click, pending/late result and changed result; real guest-to-login preservation remains unverified |
| Guided → Creative draft | `draft-transfer.tsx` validates immutable note identity/layer/position, navigation intent and one-time consumption | Unit tests exist; full routed real-stack continuity is not part of F1-A4 |
| Creative editing / Save | `CreativeStudio.tsx` differentiates existing concept ID from new Save and validates loaded selections; auth and advisory states are present | Source is implemented, but complete browser reopen/edit/relogin persistence needs F2-C evidence |
| Account collection | `AccountContent.tsx` remounts per user ID, aborts unmounted list requests, and exposes reopen/duplicate/delete UI | F1-A4 verified A/B isolation and API CRUD; it did not click every UI action or log A back in |
| Backend ownership | `f1-account-journey.mjs` denied B's GET/PUT/duplicate/DELETE of A's concept | Does not establish all possible ownership or expiry/error scenarios |
| Transport | `client.test.ts` checks 401/403/429/503 mapping, bounded CSRF recovery and no automatic replay on an ambiguous write | Mocked responses, not runtime failures injected into real PostgreSQL |

## F2-A new offline regressions

The Account dashboard component tests now cover:

1. At most one Duplicate request while a network response is uncertain; no false success and no automatic refresh/retry.
2. Confirmation required for Delete; uncertain failure keeps the card and never silently replays the mutation.
3. A failed next page retains already loaded concepts and retries only through another explicit click.
4. Remount after logout/relogin reloads the saved collection instead of reusing old in-memory results. This is a **UI refetch contract**, not proof of backend persistence.

## Explicit F2 gaps for the next bounded slice

1. **Guest to authenticated Save:** verify that a guest's Guided result survives login and the user must explicitly confirm one Save. Check no duplicate create and failure recovery using targeted component/routed tests.
2. **Reopen/edit UI:** verify Account → Creative saved ID route, edited name/notes and subsequent account list; test missing/deleted concepts and 401/403/503 without clobbering an unsaved draft.
3. **Relogin persistence:** require a separate owner-approved disposable PostgreSQL/FakeSMS/Chrome F2 run. A source-only remount test cannot establish durable persistence.
4. **Broader responsiveness and accessibility:** run agreed width/keyboard routes in an explicitly scoped future browser acceptance, preserve Persian RTL, avoid an unrelated visual redesign.
5. **Safety and scope:** no production/public-showcase authentication, real OTP, commerce, external provider, migrations, persistent named-volume writes, or Smart Perfumer artifact changes.

## Next evidence gate

Review this source-only patch and its CI. F2-B may then add a dedicated pinned real-stack journey and guard, **without executing it**. F2-C requires a new, separately scoped product-owner execution approval; the completed F1-A4 permission does not carry forward.
