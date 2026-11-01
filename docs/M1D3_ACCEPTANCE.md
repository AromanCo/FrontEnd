# M1-D.3 Final Integrated Product Acceptance

## Decision summary

**Recommendation: ready for final QA pull-request review after M1-D.3.1.** The public catalog, storefront, Creative Studio, Guided Studio and anonymous account journeys passed the available automated and Chromium browser checks. M1D1-F-001 and M1D3-F-001 are resolved. This does not mean production readiness, full WCAG conformance, authenticated browser Save, or cross-browser compatibility.

This is an acceptance result for the tested M1 implementation, not a claim of production readiness, full WCAG conformance, authenticated browser Save, or cross-browser compatibility.

## Revisions and environment

- Frontend: `feature/integrated-qa-v1`, starting HEAD `c8636e9`.
- Backend: adjacent `develop` checkout, HEAD `0dfbb8d`.
- Backend source was not modified. The worktree was clean at the start; generated M1-D.3 evidence and documentation edits are local and unstaged.
- Runtime: Linux, production Next.js server at `http://localhost:3000`, local isolated Docker Compose PostgreSQL/FastAPI stack. Existing database/volumes were not reset or reseeded for this pass.
- API health endpoints returned 200. Real seed counts observed: 6 families, 24 fragrance notes, 3 demo products. These are seed-fixture observations, not production limits.
- Browser: system Chrome/Chromium through the repository's Playwright scripts. API calls used consistent `localhost` origins and real public catalog/auth challenge endpoints where stated.
- M1-D.3 screenshots: `artifacts/integrated-qa/m1d3/`; contrast-correction screenshots: `artifacts/integrated-qa/m1d31/`. Earlier M1-D.1/M1-D.2/M1-D.3 evidence was not overwritten.

## Accepted areas

| Area | Result | Evidence and boundary |
|---|---|---|
| Home, shop, search/filter, product detail and navigation | PASS | `npm run test:browser:integration`; real FastAPI demo catalog; invalid product route showed not-found UI without fabricated data. |
| Creative Studio | PASS | `npm run test:browser`; real notes, search/filter, retry, selection, six-note limit, layers/order/removal, preview, mobile tabs, anonymous Save behavior. |
| Guided Studio | PASS | `npm run test:browser:guided`; six steps, validation, preferences, review/edit, ready/no-match, restart, real-catalog recommendation, anonymous Save and transfer. |
| Guided-to-Creative transfer | PASS | Browser handoff journey; real catalog UUIDs and layer/order transfer, URL detachment and one-time initialization. Route/auth-specific concept responses in the saved-route scenario are isolated Playwright fixtures. |
| Account | PASS within tested scope | Anonymous account guidance uses the live session check. Pagination/duplicate/CSRF retry/delete/logout are UI checks with isolated Playwright auth/concept fixtures, not a real authenticated user session. |
| Anonymous protected API behavior | PASS | Real FastAPI returned 401 for protected concept reads/writes; anonymous Save did not send a concept POST. |
| Authenticated API contract | PASS, separate backend evidence | Backend private TestClient contract suite covers authenticated concept operations; this is not browser login evidence. |
| SMS challenge handling | PASS | Real challenge returns 503 because public provider is unconfigured; UI reports unavailable and preserves the result. |
| Checkout/payment | Not applicable to acceptance as a feature | Commerce persistence, payment, real price and inventory are intentionally absent and disclosed; not treated as defects. |

## Regression commands

| Command | Result |
|---|---|
| `npm test` | PASS — 106 tests across 15 files. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS — Next.js 16.4.2 production build. |
| `git diff --check` | PASS after documentation edits. |
| `npm run test:browser` | PASS — real seeded FastAPI catalog; retry, six-note behavior, layers, mobile tabs, anonymous Save and 401/503 boundary checks. |
| `npm run test:browser:guided` | PASS — real families/notes, Guided questionnaire/result, computed contrast and typography assertions at four viewports, target-size/keyboard regression, anonymous Save and real-catalog handoff. |
| `npm run test:browser:responsive` | PASS — 320, 390, 768, 1440 CSS px; RTL and no horizontal overflow in tested Studio screens. |
| `npm run test:browser:integration` | PASS — storefront, product detail, Studio/account cross-feature flows; isolated fixtures are explicitly identified in the QA matrix. |

The existing 106-test result is not a new test-count increase. Browser journeys are Chromium-only and do not establish coverage in other engines.

## P2 removal-target fix

M1D1-F-001 remains **RESOLVED**. The original effective target measured 19×19 CSS px at 768 and 1440 because the small base rule was overridden only at the mobile breakpoint. The current browser regression measures Like and Avoid remove targets at **44×44 CSS px** at 320, 390, 768 and 1440. It checks target non-overlap at tablet width, pointer activation near a target edge, Tab reachability, Enter/Space activation, correct removal and counters, hidden selected-note removal, and horizontal overflow. Existing compact chip artwork is retained. Evidence: `npm run test:browser:guided` and `artifacts/integrated-qa/m1d3/guided/step-05-note-affinity-selected-{320,390,768,1440}.png`.

## Accessibility review

Automated component and Chromium tests verify semantic controls, native answer selection behavior, Guided keyboard progression, focusable note removal, mobile Studio navigation, login modal semantics/focus handling, and restart confirmation behavior. The browser journeys also check RTL and overflow at the target widths. Global `:focus-visible` styling and reduced-motion CSS are present in the implementation. These checks are targeted regression evidence, not a complete audit of every control or WCAG success criterion.

The acceptance review did not execute a dedicated end-to-end keyboard-only route through every storefront filter and account action. It also did not run an automated axe scan. Browser-based checks cover representative paths, but manual keyboard review remains advisable for the full global navigation and account action sequence.

### Manual screen-reader checklist — outstanding

No actual screen-reader session was performed. Before a broader accessibility sign-off, use Orca with Firefox/Chromium or NVDA with supported Windows browser and verify:

1. Landmark and heading navigation across Home, Shop, product detail, Creative, Guided and Account.
2. Skip link and global/mobile navigation names and expanded state.
3. Search/filter labels, result updates, empty/error announcements and retry controls.
4. Guided step/progress announcements, radio/checkbox state, validation errors, note-affinity counts and removal names.
5. Focus entry, containment, Escape and restoration for restart, login and import-confirmation dialogs.
6. Result explanation, selected layers, save/login status and handoff announcements.

## Contrast review

The original M1-D.3 values below are retained for traceability. M1-D.3.1 then re-read computed styles from the rebuilt Chromium production app at all four widths and calculated contrast using the WCAG relative-luminance formula. The browser journey composites each computed radial-gradient stop over the computed page base and the translucent question panel over those surfaces. It checks labels against the resulting panel candidates, field borders against the field background and panel candidates, and note metadata against the actual computed note-card gradient stops. This is a deterministic conservative set of CSS-derived backgrounds; it is not a pixel sample of every point on every rendered gradient. Screenshots were visually reviewed at all four widths.

| Rendered pair | Original computed pair and ratio | Corrected measured minimum | Target / result |
|---|---|---:|---|
| Search/form labels on computed question-panel surfaces | Previous `.guided-search-label` color `#786B78`; `.66rem` (10.56px) | **8.20:1** at each viewport | Normal text 4.5:1 — PASS; corrected text is `#59475C`, 12px |
| Search placeholder on white input | `#AA9EAA` on `#FFFFFF`: **2.57:1** | **6.65:1** at each viewport | Normal text 4.5:1 — PASS; corrected placeholder is `#68576A` |
| Entered search text on white input | Existing `#382A3D` on white: **13.40:1** | **13.40:1** at each viewport | Normal text 4.5:1 — PASS; this value did not require a correction |
| Search input border against computed adjacent surfaces | `#D8CBD4` on white: **1.57:1** | **5.46:1** at each viewport | Meaningful boundary 3:1 — PASS; corrected border is 1px `#795F78` |
| Family filter label on computed question-panel surfaces | Same former `#786B78`, 10.56px label | **8.20:1** at each viewport | Normal text 4.5:1 — PASS; corrected label is 12px |
| Family select text on white field | Plum `#382A3D` | **13.40:1** at each viewport | Normal text 4.5:1 — PASS |
| Family select border against computed adjacent surfaces | Former `#D8CBD4` on white: **1.57:1** | **5.46:1** at each viewport | Meaningful boundary 3:1 — PASS; corrected border is 1px `#795F78` |
| Note-family metadata on note-card gradient | `#857886` on white endpoint: **4.18:1**, 9.44px | **6.29:1** at each viewport | Normal text 4.5:1 — PASS; corrected `#68576A`, 12px |
| Visible keyboard focus on field/panel surfaces | Focus token `#80538A`; prior solid-white ratio **5.96:1** | **5.77:1** at each viewport for both fields | UI indicator 3:1 — PASS; 3px outline retained |
| Other prior sampled pairs | Body 12.04:1; selected pill 7.16:1; removal glyph 5.64:1; error text 5.68:1 | Not changed by this scoped correction | Prior results retained; targeted checks only |

The guided browser journey asserts every corrected text/boundary threshold and `>=12px` metadata/field labels at **320, 390, 768 and 1440 CSS px**, logs the measured ratios, checks a visible 3px `:focus-visible` outline and its contrast, and fails on horizontal overflow. It does not hardcode the new CSS color values as acceptance expectations. `docs/M1D1_FINDINGS.md` retains original failure values and marks M1D3-F-001 resolved. Remaining site-wide contrast pairs and disabled states outside this Guided Step 5 scope are not thereby audited or certified.

## Cross-browser and assistive technology

- Chromium: PASS for the listed browser journeys and responsive checks.
- Firefox: **NOT TESTED**. Playwright's Firefox executable was absent. The system Firefox snap could not initialize its mount namespace in this environment. No browser installation or system reconfiguration was performed.
- WebKit/Safari: **NOT TESTED**. Playwright's WebKit executable was absent and Safari was unavailable. Chromium is not treated as a substitute.
- Screen reader: **NOT TESTED**. An Orca binary is installed, but no actual speech/assistive-technology session was run.

## Known limitations and risks

- **Resolved P2:** M1D3-F-001 is resolved by the scoped Step 5 contrast correction; four-viewport browser assertions pass. This is not a site-wide contrast audit.
- **Real authenticated browser Save: NOT TESTED.** SMS is unavailable; no public OTP bypass was added. Private Backend TestClient and isolated frontend fixtures are separate evidence only.
- **Cross-browser and screen-reader checks:** outstanding as listed above.
- Backend seed data are demonstrations; no price/inventory/checkout/payment or order behavior is represented.
- Guided answers and same-tab transfer are memory-only and lost on full refresh by design.
- No chemical, allergy, safety, manufacturing, longevity, projection or intensity validation exists.
- CI currently runs Node 22 install/typecheck/lint/unit tests/build. It does not run the seeded API browser journeys; keep those as a separately reported integration check until a controlled disposable service job is intentionally added.

## Screenshot evidence

New screenshots are under `artifacts/integrated-qa/m1d3/`:

- `integration/`: home, filtered shop, product detail, account anonymous, imported Creative, Guided result/login, isolated API error and invalid product.
- `guided/`: six steps, note affinity at target widths, ready/no-match results, anonymous login, imported composition.
- `responsive/`: Creative note and composition screens at 320/390/768 widths.

These are Chromium captures. Isolated fixture states are not presented as live authenticated sessions. Earlier screenshot baseline directories remain unchanged.

M1-D.3.1 Step 5 screenshots (Chromium): `artifacts/integrated-qa/m1d31/guided/step-05-note-affinity-selected-{320,390,768,1440}.png`, plus `step-05-search-focused-390.png` and `step-05-family-focused-768.png`. The live catalogs were loaded before capture.

## Final merge recommendation

**Ready for final QA pull-request review.** The reproduced P2 Step 5 contrast issue now passes computed-color regression checks at the required widths, and all four browser journeys pass against the existing local seeded environment. Real authenticated browser Save, Firefox/WebKit, and screen-reader verification remain unverified; no production-readiness or full WCAG claim is made. Product-owner review and normal PR checks are still required before merge.

## M1-D.3.1 correction verification

- CSS correction: only Guided Step 5 selectors in `src/app/globals.css` changed. Form labels use dark plum `#59475C` at 12px; placeholder and note-family metadata use `#68576A`; note-family metadata is 12px at every breakpoint; search/select borders use muted plum `#795F78`. Existing white controls, rounded corners, and global 3px focus outline remain.
- Browser regression: `QA_SCREENSHOT_DIR=artifacts/integrated-qa/m1d31/guided npm run test:browser:guided` passed with the existing live API. It verifies contrast/text size/focus, removal targets, search and family filtering across the complete catalog, reset-on-filter behavior, selected-note summary, and no overflow at all four sizes.
- Full verification after correction: `npm test` — 106/106 tests; typecheck, lint, build, `test:browser`, `test:browser:guided`, `test:browser:responsive`, `test:browser:integration`, and `git diff --check` all passed. Vitest printed the existing Vite native config-loader compatibility warning; no test failed.
- Responsive result: CSS geometry and measured contrast values were stable at 320, 390, 768, and 1440px; 44×44px remove targets remain. Search and family controls received keyboard focus in DOM order, with visible 3px outlines and computed focus contrast 5.77:1.
- Outstanding manual checks: gradient tests use computed CSS gradient stops composited over the computed page base and question panel. No pixel-by-pixel sampling, site-wide contrast audit, Firefox/WebKit run, or screen-reader session was performed.
