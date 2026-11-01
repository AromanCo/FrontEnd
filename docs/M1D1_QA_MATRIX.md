# M1-D.1 Integrated Product QA Matrix

## Baseline and environment

- Frontend: `feature/integrated-qa-v1`, starting HEAD `4df7587`.
- Backend: `develop`, HEAD `0dfbb8d`.
- Both repositories were clean before the QA work. No Backend source was changed.
- Browser environment: Linux, system Chromium/Chrome, Next.js production server at `http://localhost:3000`.
- API environment: a newly named, isolated Docker Compose project (`aroman-m1d1-qa`) with a new project volume, PostgreSQL 17, Backend source built read-only from the local `develop` checkout, migrations applied, and the existing seed command run. Existing Docker volumes and databases were not reset or used.
- API health: `/health/live` and `/health/ready` returned 200. Browser requests consistently used `localhost`; API CORS allowed `http://localhost:3000` with credentials.
- Known seeded fixture counts: 6 families, 24 notes, and 3 demonstration products. These are observations for this seed, not production limits.
- Browser failure fixtures are labeled isolated. The account test uses Playwright-only session/concept responses; it is not a real authenticated browser test.

## Automated checks

| Area | Scenario | Evidence or test name | Environment | Result | Notes |
|---|---|---|---|---|---|
| Frontend unit/component | Full Vitest suite | `npm test` (15 files, 106 tests) | Local | PASS | Includes recommendation rules, save race, auth provider, transfer, catalog retry, and Guided UI. |
| Type safety | Strict TypeScript check | `npm run typecheck` | Local | PASS | |
| Lint | ESLint | `npm run lint` | Local | PASS | |
| Production build | Next.js optimized build | `npm run build` | Local | PASS | Next.js 16.4.2, React 19.3.1. |
| Patch hygiene | Whitespace validation | `git diff --check` | Local | PASS | |
| Backend contract | Foundation, auth, CSRF, and concept contract tests | `../Backend/.venv/bin/pytest tests/test_foundation.py -q` (20 tests) | Backend private TestClient fixtures and temporary test database | PASS | One Starlette `httpx` deprecation warning; test suite passed. Fake SMS is confined to the private in-process fixture. |
| CI | Existing required pull-request workflow | `.github/workflows/ci.yml` inspection | Repository | PASS | Node 22; `npm ci`, typecheck, lint, Vitest, build. No live API or SMS secrets required. Workflow was not run on GitHub during this audit. |

## Runtime and API integration

| Area | Scenario | Evidence or test name | Environment | Result | Notes |
|---|---|---|---|---|---|
| Runtime | FastAPI liveness/readiness | `GET /health/live`, `GET /health/ready` | Isolated seeded Docker stack | PASS | Both returned 200 after migration. |
| Catalog | Family/note/product data | Direct API requests plus `integrated-qa-journey.mjs` | Real FastAPI | PASS | Returned 6 families, 24 notes, and 3 products; all seeded products had `is_demo: true`. |
| CORS and origins | Browser catalog and OTP challenge requests | `test:browser`, `test:browser:guided`, `test:browser:integration` | Chromium; `localhost` on both origins | PASS | Real browser reads and the real challenge request succeeded across origins. Challenge correctly returned 503. |
| Protected API | Anonymous concept list/create | `test:browser` protected status assertion | Real FastAPI, anonymous browser | PASS | GET and POST returned 401; Guided/Creative anonymous Save made no concept POST. |
| Auth write contract | Create/read/update/duplicate/delete and CSRF | Backend `test_foundation.py` | Private FastAPI TestClient | PASS | Not evidence of a successful browser login or browser Save. |
| Authenticated browser Save | Real SMS login followed by Save | No public SMS delivery provider configured | Real browser | NOT TESTED | Challenge returns 503; no OTP bypass was added. |
| Network recovery | Note API request fails, then retry | `test:browser` and isolated screenshot fixture in integration journey | Chromium; first note request injected as 503, retry uses real API | PASS | Existing selection stayed intact and retry loaded real notes. |
| HTTP mapping | 400, 401, 403, 404, 422, 429, 503 and network errors | API transport unit test | Vitest mocks | PASS | These status mappings are unit-level; only selected statuses were exercised against the live API. |

## Route and journey inventory

| Area | Scenario | Evidence or test name | Environment | Result | Notes |
|---|---|---|---|---|---|
| Home | Editorial homepage and real SSR demonstration products/families | `integrated-qa-journey.mjs`, `home-1440.png` | Production Next.js + real FastAPI | PASS | Main routes are visible; product art is labeled conceptual/demo. |
| Shop | Product listing and search | `integrated-qa-journey.mjs`, `shop-filtered-390.png` | Production Next.js + real FastAPI | PASS | Search returns the selected real API product. |
| Shop | Family filter matches API records | `integrated-qa-journey.mjs` | Production Next.js + real FastAPI | PASS | Rendered names were compared with the real filtered endpoint response. |
| Product detail | Open a real product and inspect demo disclosure/commerce boundary | `integrated-qa-journey.mjs`, `product-detail-390.png` | Production Next.js + real FastAPI | PASS | Product detail says price, stock, and purchase are unavailable. |
| Product detail | Invalid product identifier | `integrated-qa-journey.mjs`, `invalid-product-route-390.png` | Production Next.js | PASS | Branded no-index not-found UI rendered; no product was fabricated. The streamed response was HTTP 200, which Next.js documents as possible after streaming begins. |
| Cart/checkout | Route boundaries and honest unavailable copy | `integrated-qa-journey.mjs` | Production Next.js | PASS | Both are explicitly non-persistent demonstrations; no payment or order is claimed. |
| Creative Studio | API notes, search/family filtering, retry, selection, layers, reorder, remove, six-note limit, preview, mobile tabs, refresh semantics | `test:browser` | Production Next.js + real FastAPI | PASS | 24 seeded notes loaded; selection resets on reload as documented. |
| Creative Studio | Anonymous Save and SMS-unavailable response | `test:browser` | Production Next.js + real FastAPI | PASS | Result preserved; challenge returned 503; protected GET/POST returned 401. |
| Creative Studio | Imported Guided composition and editable layer controls | `test:browser:guided`, `test:browser:responsive`, `integrated-qa-journey.mjs` | Production Next.js + real FastAPI | PASS | Four real note UUIDs, name, order, and layers transferred; no automatic Save. |
| Guided Studio | Six steps, validation, back/edit, note-affinity limits/skip, recommendation, no-match, restart | `test:browser:guided` | Production Next.js + real FastAPI | PASS | All displayed recommendation IDs/names came from the API catalog. |
| Guided Save | Anonymous Save preserves visible result and does not POST | `test:browser:guided`, `integrated-qa-journey.mjs` | Production Next.js + real FastAPI | PASS | Login dialog retained the result; SMS 503 was displayed honestly. |
| Guided transfer | One-time import, saved-concept precedence, URL detachment, stale in-flight response | `guided-handoff-route-journey.mjs` via `test:browser:guided` | Real App Router transition; catalog is live, auth/concept responses are isolated Playwright fixtures | PASS | Saved-concept route loads first; explicit replacement removes `concept=<id>` before applying Guided draft. |
| Account | Anonymous account guidance | `integrated-qa-journey.mjs`, `account-anonymous-390.png` | Production Next.js + real FastAPI session check | PASS | Login guidance shown. |
| Account | Pagination, duplicate, CSRF retry, confirmed delete, logout | Isolated account journey in `integrated-qa-journey.mjs` | Playwright-only authenticated fixture | PASS | UI behavior only; not a real user session. Backend contract is independently covered by TestClient. |
| Login | SMS-unavailable feedback and modal focus containment | `integrated-qa-journey.mjs` | Production Next.js + real FastAPI challenge | PASS | The 503 message was displayed and the result remained mounted. |

## Responsive and accessibility checks

| Area | Scenario | Evidence or test name | Environment | Result | Notes |
|---|---|---|---|---|---|
| Layout | Home, shop, product detail, Guided result, imported Creative, login dialog, account, cart, checkout at 320/390/768/1440 | `integrated-qa-journey.mjs` `verifyResponsive` | Chromium production build | PASS | No document-level horizontal overflow; RTL was present. |
| Creative Studio | Grid density, labels, controls, tabs, keyboard route | `test:browser:responsive` | Chromium production build + real API | PASS | 320/390: 2 columns; 768: 3 columns; 1440: 2 columns. Note labels measured 12.16, 13.92, 14.4, and 15.2 CSS px respectively. |
| Guided Studio | Step 5 note list, read/reach/remove states | `test:browser:guided` | Chromium production build + real API | PASS | At 320/390, 10 of 24 notes initially shown and the rest remain discoverable with “show more” or search/filter. |
| Guided Studio | Step 5 selected-note removal hit target and removal behavior | Updated `guided-studio-journey.mjs` | Chromium production build + real FastAPI seed | PASS — M1-D.2 regression | Original finding M1D1-F-001 measured 19×19px at 768/1440 due to the 1.2rem base rule and mobile-only override. Now both liked and avoided removal buttons measure 44×44px at 320, 390, 768, and 1440. At 768px target boxes do not overlap; an edge-near pointer click removes only the intended liked note. Tab reaches the summary control; Enter removes liked and Space removes avoided; counters update. The hidden selected note remains removable from its summary. See `artifacts/integrated-qa/m1d2/guided/step-05-note-affinity-selected-768.png`. |
| Keyboard | Creative Studio tab navigation and Guided restart focus/confirmation | `test:browser`, `test:browser:guided`, Vitest Guided component tests | Chromium + Vitest | PASS | Tested keyboard path, restart focus trap, Escape/cancel, focus restoration, and confirmed reset. |
| Dialog | Login dialog modal semantics/focus containment | `integrated-qa-journey.mjs`; `dialog.test.tsx` | Chromium + Vitest | PASS | Tab from final control wraps to first control; `aria-modal=true`. |
| Screen reader | Manual assistive-technology review | None | Not run | No NVDA/VoiceOver/TalkBack or automated axe audit was available. |
| Browser engines | Firefox and WebKit/Safari | None | Not run | Browser coverage is Chromium on Linux only. |

## Screenshot evidence

New screenshots are in `artifacts/integrated-qa/`; existing `artifacts/screenshots/`, `artifacts/visual-alignment/`, and `artifacts/guided-studio/` baselines were not overwritten.

- Storefront: `storefront-studio/home-1440.png`, `shop-filtered-390.png`, `product-detail-390.png`.
- Guided: `storefront-studio/guided-result-320.png`, `guided-result-390.png`, `guided-result-1440.png`, `guided-save-sms-unavailable-1440.png`.
- Creative import: `storefront-studio/creative-guided-import-1440.png`.
- Account/route states: `storefront-studio/account-anonymous-390.png`, `invalid-product-route-390.png`.
- Isolated failure fixture: `storefront-studio/creative-api-error-390.png`; its first 503 was injected by Playwright and its retry reached real FastAPI.
- Guided states: `guided/` contains the six steps, ready/no-match results, anonymous login, and mobile Step 5 screenshots.
- Creative responsive states: `responsive/` contains note-library and composition screenshots at 320, 390, and 768 pixels.

## CI recommendation

Keep the existing mandatory Node 22 CI checks as-is. Add browser coverage in stages: first a separately reported, deterministic Playwright smoke against `next start` using clearly named network fixtures; treat it as UI smoke coverage only. Later, if desired, add an optional/manual integration job that checks out the Backend, creates a disposable PostgreSQL database, migrates/seeds it, and exercises real public catalog APIs. Do not make pull-request CI depend on public SMS, personal secrets, mutable external services, or a fake OTP HTTP endpoint. Continue to use the Backend's private TestClient fixture for authenticated contract coverage until a real provider or explicitly approved isolated browser-auth mechanism exists.

## M1-D.3 acceptance addendum

Verification was rerun from frontend HEAD `c8636e9` on `feature/integrated-qa-v1`; Backend remained at `develop` / `0dfbb8d`. New browser evidence was written under `artifacts/integrated-qa/m1d3/`. The original M1-D.1 and M1-D.2 evidence directories were not overwritten. The existing 106-test Vitest suite and four browser journeys passed again. The M1-D.2 removal-target regression remains **PASS / RESOLVED** at all four widths.

| Area | Scenario | Evidence or test name | Environment | Result | Notes |
|---|---|---|---|---|---|
| Selected-note removal | Actual target rectangle, non-overlap, Like/Avoid removal, keyboard activation, count, hidden selected note, overflow | `npm run test:browser:guided`; `artifacts/integrated-qa/m1d3/` | Chromium production build + real seeded FastAPI | PASS | 44×44 CSS px at 320/390/768/1440; keyboard Enter/Space; no horizontal overflow. M1D1-F-001 remains resolved. |
| Contrast | Guided Step 5 form/search/filter/metadata/focus colors | M1-D.3.1 browser computed-style assertions in `guided-studio-journey.mjs`; details in `docs/M1D3_ACCEPTANCE.md` | Chromium production build, four viewports, WCAG relative-luminance calculation | PASS — M1D3-F-001 RESOLVED | At each width: labels 8.20:1; placeholder 6.65:1; input/selection text 13.40:1; borders 5.46:1; note-family metadata 6.29:1 at 12px; keyboard focus 5.77:1. Targeted check only, not full WCAG conformance. |
| Browser engine coverage | Representative flows in Chromium | `test:browser`, `test:browser:guided`, `test:browser:responsive`, `test:browser:integration` | Linux system Chrome/Chromium + real API where noted | PASS | Does not imply Firefox, WebKit, Safari, or screen-reader coverage. |
| Firefox | Representative route and dialog smoke | Browser launch attempt | Local environment | NOT TESTED | Playwright Firefox executable missing; system Firefox snap could not initialize its mount namespace. No browser was installed. |
| WebKit | Representative route and dialog smoke | Browser launch attempt | Local environment | NOT TESTED | Playwright WebKit executable missing. Safari was unavailable. |
| Screen reader | Spoken names, state, error and dialog announcements | Manual checklist in `docs/M1D3_ACCEPTANCE.md` | No screen-reader session | NOT TESTED | Orca binary exists, but no actual screen-reader interaction/session was performed. |
| Authenticated browser Save | Real SMS login then concept Save | Existing backend/provider limitation | Public browser + real API | NOT TESTED | SMS provider is not configured and challenge returns 503. Backend private TestClient and isolated frontend fixtures are not real authenticated browser evidence. |

This addendum records final acceptance evidence without rewriting the historical M1-D.1 baseline. See `docs/M1D3_ACCEPTANCE.md` for environment, commands, detailed results, limitations, and merge recommendation.

## M1-D.3.1 contrast correction

The former Step 5 contrast failure is resolved by a focused CSS adjustment in `src/app/globals.css`. The guided browser journey now calculates ratios from computed colors and background surfaces and asserts them at 320, 390, 768, and 1440 CSS px. It also checks 12px family metadata, Tab order, visible focus, removal targets and no overflow. The updated journey and the other three requested browser journeys all passed against the existing seeded FastAPI stack. New screenshots are in `artifacts/integrated-qa/m1d31/`; earlier `m1d3` evidence is preserved.
