# M1-D.1 Integrated QA Findings

## Summary

Two reproducible P2 usability/accessibility findings were recorded and are now resolved: M1D1-F-001 in M1-D.2 and M1D3-F-001 in M1-D.3.1. No P0 or P1 defect was reproduced. Deliberately unavailable checkout, pricing, inventory, and public SMS delivery are product limitations, not application defects.

## M1D1-F-001 — Guided note-removal target is too small at tablet width

- **Severity:** P2 — **RESOLVED in M1-D.2**
- **Affected route/component:** `/studio/guided`, Step 5 note-affinity selected-note summary
- **Reproduction:**
  1. Open Guided Studio and complete Steps 1–4.
  2. Select a note as liked or avoided.
  3. At a 768 CSS-pixel viewport, inspect the remove button beside the selected note in the summary.
- **Expected:** A selected note can be removed using a comfortably sized hit area. A target around 44×44 CSS pixels is the preferred touch baseline where layout permits, without increasing the visual chip height.
- **Original observed dimensions:** Chromium measured the button at **19×19 CSS pixels** at 768px and 1440px, and 44×44px at 320px and 390px. The 1.2rem base rule was overridden only by the `max-width:680px` mobile rule, leaving tablet and desktop at the small base size.
- **Root cause:** The mobile breakpoint alone expanded the button. Also, the original circular hit shape could leave the nominal box corners outside the effective pointer target.
- **Correction:** The selected chip now reserves a 44×44px softly rounded rectangular button box at every width. A compact white 1.2rem circular × remains the visible icon; the chip surface is drawn inset so its visual height remains compact. The target participates in flex layout with spacing, so adjacent controls do not overlap. RTL ordering is unchanged.
- **Final measured dimensions:** `npm run test:browser:guided` measured **44×44 CSS pixels** at 320px, 390px, 768px, and 1440px. Like/Avoid controls remained at least 44px high. Step 5 document heights after this change were 1997px, 1980px, 1610px, and 1618px respectively; the additional tablet/desktop height comes from reserving the usable hit target without inflating the pill artwork.
- **Regression evidence:** The updated browser journey checks both liked and avoided removal target dimensions at all four viewports, verifies targets do not overlap at 768px, clicks near the edge without activating another chip, verifies Tab reaches a summary removal button, and activates liked removal with Enter and avoided removal with Space. It confirms counters update and a note outside the initial ten remains removable from the summary. The run passed against the real seeded FastAPI catalog (6 families, 24 notes), with no horizontal overflow. See `artifacts/integrated-qa/m1d2/guided/step-05-note-affinity-selected-768.png`.

## Non-defects and known product limitations

- **SMS:** The real Backend challenge endpoint returned HTTP 503 because no public SMS provider is configured. The UI displayed the unavailable message, preserved the Guided result, and did not submit a concept before authentication. No OTP bypass was added.
- **Authenticated browser Save:** Not verified because the public SMS provider is unavailable. Authenticated create/read/update/duplicate/delete behavior passed the Backend's private FastAPI TestClient suite (20 tests). Frontend account interactions were exercised only with an explicitly isolated Playwright auth/concept fixture.
- **Commerce:** Cart and checkout routes state that persistence, orders, and payment are unavailable. No checkout, pricing, inventory, or payment implementation exists; this is intentional.
- **Demo catalog:** The local seed has 3 products, all explicitly marked as demo. Artwork is conceptual and no real inventory/price is implied.
- **Draft retention:** Guided answers and same-tab Studio transfer are in memory. Full refresh can discard them, as specified.
- **Not-found status:** An invalid product path renders the custom no-index not-found UI and no product data. The observed HTTP status was 200 because the route response had begun streaming. The installed Next.js 16 docs describe this streamed `notFound()` behavior; no defect is filed for it.
- **Accessibility coverage:** Chromium keyboard and DOM semantics were checked; a full screen-reader, contrast, and automated WCAG/axe audit was not run. Firefox, WebKit, and Safari were not tested.

## M1-D.3 acceptance findings

### M1D3-F-001 — Low-contrast placeholder, field boundary, and secondary note-family label

- **Severity:** P2 — **RESOLVED in M1-D.3.1**
- **Affected route/component:** Guided Studio Step 5 note search and note-card family metadata; similar tokens may be reused elsewhere and need route-level confirmation.
- **Reproduction:** Open `/studio/guided`, reach Step 5, and inspect the search input and note family labels in Chromium at 320–1440 CSS pixels. Read computed foreground, background, border, and gradient styles, then calculate WCAG contrast from those rendered color values.
- **Expected:** Normal-size text should reach 4.5:1 against its actual surface; a visual boundary relied upon to identify a control should reach 3:1 against adjacent colors. The review is a focused contrast audit, not a claim of full WCAG conformance.
- **Original observed values:** Search placeholder `rgb(170, 158, 170)` on white was **2.57:1**; search/select border `rgb(216, 203, 212)` against white was **1.57:1**; note-family metadata `rgb(133, 120, 134)` on the lightest white endpoint was **4.18:1** at 9.44 CSS px. These failed the requested 4.5:1 text and 3:1 boundary thresholds.
- **Root cause:** The Step 5 form labels used small, muted text; the placeholder was lighter still; the 1px control boundary was too close to the white field and pale surrounding surfaces. Note-family metadata was set to `.59rem` (9.44px), with only a small mobile adjustment.
- **Correction:** Scoped Step 5 styles now use a dark plum for the form labels, a readable plum-tinted placeholder and note-family metadata, a muted-plum 1px field border, and `.75rem` (12px) label/metadata text. The rounded white fields and existing `--focus` outline are preserved. No global palette, API, filtering, note-selection, or recommendation behavior changed.
- **Final measured values:** Browser-computed styles and the deterministic WCAG relative-luminance helper measured the same minimum ratios at 320, 390, 768, and 1440 CSS px: search/form labels **8.20:1**; placeholder **6.65:1**; entered search and selected option text **13.40:1**; search and family-select borders **5.46:1**; note-family metadata **6.29:1** at **12px**; keyboard focus outline **5.77:1**. Text was checked against composited question-panel surfaces and note metadata against computed gradient stops; the lightest relevant surface was included. These are targeted Step 5 checks, not full WCAG conformance.
- **Regression evidence:** `QA_SCREENSHOT_DIR=artifacts/integrated-qa/m1d31/guided npm run test:browser:guided` asserts contrast thresholds, computed font size, keyboard Tab order, visible focus, and 44×44px removal targets at all four widths while exercising the real seeded catalog, search/filter, Like/Avoid and Guided handoff. It passed. Screenshot evidence is in `artifacts/integrated-qa/m1d31/guided/step-05-note-affinity-selected-{320,390,768,1440}.png`, with focused states at `step-05-search-focused-390.png` and `step-05-family-focused-768.png`.
- **Remaining manual scope:** Browser styles include radial gradients/translucent panel surfaces. The automated check composites their computed CSS stops over the computed page base and checks the resulting representative surfaces; it does not sample every physical display pixel. Visual screenshots were reviewed at all four widths. A route-wide contrast review and actual screen-reader verification remain outstanding.

## Remaining M1-D.2 QA work

1. Complete a full route-wide contrast and assistive-technology review; the focused Guided Step 5 contrast finding M1D3-F-001 is resolved, but this does not certify other UI states.
2. Expand the account UI fixture coverage only if the account flow receives further changes; current pagination, duplicate, CSRF retry, delete, and logout smoke coverage passes in an isolated browser fixture.

M1-D.2 changed only the frontend selected-chip styling and its browser/component regression checks; Backend source and contracts remain unchanged.
