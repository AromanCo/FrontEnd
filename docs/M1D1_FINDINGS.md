# M1-D.1 Integrated QA Findings

## Summary

One reproducible P2 usability/accessibility finding was recorded and is now resolved by M1-D.2. No P0 or P1 defect was reproduced. Deliberately unavailable checkout, pricing, inventory, and public SMS delivery are product limitations, not application defects.

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

## Remaining M1-D.2 QA work

1. Complete a real-SMS-independent screen-reader/contrast review and, if approved, an automated accessibility scan.
2. Expand the account UI fixture coverage only if the account flow receives further changes; current pagination, duplicate, CSRF retry, delete, and logout smoke coverage passes in an isolated browser fixture.

M1-D.2 changed only the frontend selected-chip styling and its browser/component regression checks; Backend source and contracts remain unchanged.
