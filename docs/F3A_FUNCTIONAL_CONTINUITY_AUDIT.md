# F3-A — Guided / Creative / Smart Perfumer functional continuity

**Tracking:** [F3 issue #77](https://github.com/AromanCo/FrontEnd/issues/77).  
**Scope:** Source-only internal synthetic MVP contract check; no new PostgreSQL, FakeSMS, Chrome, production or external-provider execution.

## Frozen inputs and preconditions

- FrontEnd baseline: `develop` at `2692de83ec5aa9ede9d615a2ac5c3c53508d2735` (merged F2-C mobile-tab browser-test correction).
- Backend integration pin for follow-on local acceptance: `e69c286f6758847c08077b12ab621341ebb2a557`.
- F2's first explicitly authorized local acceptance **failed at a test-only hidden mobile Composition input** after PostgreSQL before/after checks passed. The corrected F2 selector has merged, but a fresh isolated **F2 retest remains unapproved and unexecuted**. Do not use F3 source-only success to declare F2 complete.

## Current evidence and remaining gates

| Continuity contract | Existing source evidence | F3-A action / remaining proof |
| --- | --- | --- |
| Guided result transfers name and ordered note IDs/layers to Creative without a server write | `guided-studio.test.tsx`, `guided-handoff-route-journey.mjs`, `guided-creative-save-journey.mjs` and in-memory `StudioDraftProvider` | F3-A uses a synthetic Guided transfer in a full `CreativeStudio` component harness; separately approved real-stack transfer remains pending. |
| Advisor preview and Reject preserve original name/order/layers without POST/PUT | `blend-advisor.test.tsx` covers preview and Reject on a freshly assembled composition | F3-A adds a cross-stage Guided-import → Reject assertion, including no concept writes. |
| Apply on an unsaved draft is explicit, in memory; Undo restores the immediately previous snapshot | `blend-advisor.test.tsx`, `smart-perfumer-v1-journey.mjs`, `M1E3_ACCEPTANCE_MATRIX.md` | F3-A adds Apply → Undo after Guided import, checking name, layer and absence of persistence. |
| Save is a separate, explicit API create; the advisor action cannot auto-save | `guided-creative-save-journey.mjs`, `blend-advisor.test.tsx` | F3-A checks exactly one `concepts.create` with the restored Guided payload **only after** Save, and no `concepts.update`. |
| Saved-source advisor fork is detached and the original cannot be overwritten | `blend-advisor.test.tsx`, `smart-perfumer-fork-journey.mjs`, draft-transfer tests | Existing source tests cover confirmation, route remount and POST vs PUT. A fresh isolated real API comparison is still required for F3 completion. |
| Stale/invalid/partial catalogs fail closed and do not leave Apply-ready suggestions | `advisor-recommendation.test.ts`, `blend-advisor.test.tsx` | Existing synthetic coverage; retain error/timeout and retry evidence in F3-B/F3-C as needed. |
| Persian mobile tabs, RTL, keyboard, 320/390/768/1440 | `mobile-rtl-journey.mjs`, `smart-perfumer-v1-journey.mjs` | CI/browser fixtures are not a substitute for the separately approved full F3-C real-stack journey. |

## F3-A source change

One focused test in `src/tests/blend-advisor.test.tsx` now exercises an actual `StudioDraftProvider` Guided-intent import through `CreativeStudio`, Advisor Reject, a second preview, Apply, Undo, and explicit Save. It asserts name/layer retention and **no API concept writes** until Save, then exactly one POST with the original ordered payload, never PUT. This is a mocked component integration test, **not a PostgreSQL-backed browser acceptance**.

## Follow-on gates

1. Review the F3-A draft PR and CI. No automatic merge implied by F3 source-only evidence.
2. Separately resolve the outstanding F2 real-stack retest on the exact merged source after explicit owner approval. One previously approved F2 attempt is consumed.
3. Prepare only the F3-B coverage that fills a demonstrated gap; avoid rewriting already tested Smart Perfumer behavior.
4. Require another specific owner authorization for any local F3-C PostgreSQL/Chrome run, and check source SHAs, Docker volume identities, loopback-only ports, FakeSMS, browser artifacts and cleanup.

No real SMS/provider, payment, deployment, persistent Docker volume modification, original source-worktree mutation, or the existing 98 Smart Perfumer artifacts are within scope.
