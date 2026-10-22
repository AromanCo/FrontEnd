# M1-D.1 Integrated QA Findings

## Summary

One reproducible P2 usability/accessibility finding was recorded. No P0 or P1 defect was reproduced. Deliberately unavailable checkout, pricing, inventory, and public SMS delivery are product limitations, not application defects.

## M1D1-F-001 — Guided note-removal target is too small at tablet width

- **Severity:** P2
- **Affected route/component:** `/studio/guided`, Step 5 note-affinity selected-note summary
- **Reproduction:**
  1. Open Guided Studio and complete Steps 1–4.
  2. Select a note as liked or avoided.
  3. At a 768 CSS-pixel viewport, inspect the remove button beside the selected note in the summary.
- **Expected:** A selected note can be removed using a comfortably sized hit area. A target around 44×44 CSS pixels is the preferred touch baseline where layout permits, without increasing the visual chip height.
- **Observed:** Chromium measured the remove button at **19×19 CSS pixels** at 768px. It measured 44×44px at 320px and 390px. At 1440px it is also 19×19px, where pointer input is more likely. Like/Avoid controls measured at least 44px high at all four checked widths.
- **Evidence:** Browser output from `npm run test:browser:guided`; `artifacts/integrated-qa/guided/step-05-note-affinity-selected-768.png`. Step 5 full document heights were 1585px at 768px and 1997px/1980px at 320px/390px. No clipping, overlap, or horizontal overflow was detected. All 24 seeded notes remain accessible through the in-flow expansion control and filtering.
- **Proposed correction scope:** In M1-D.2, enlarge the removal button's CSS hit area to at least 44×44px for touch/tablet breakpoints while preserving the compact selected-note chip. Recheck neighboring chips, RTL spacing, keyboard focus, and overflow.
- **Regression test needed:** Add a browser assertion that measures the remove target at 768px with touch enabled and requires width and height of at least 44px. Keep the existing mobile measurement and selected-note removal assertions.

## Non-defects and known product limitations

- **SMS:** The real Backend challenge endpoint returned HTTP 503 because no public SMS provider is configured. The UI displayed the unavailable message, preserved the Guided result, and did not submit a concept before authentication. No OTP bypass was added.
- **Authenticated browser Save:** Not verified because the public SMS provider is unavailable. Authenticated create/read/update/duplicate/delete behavior passed the Backend's private FastAPI TestClient suite (20 tests). Frontend account interactions were exercised only with an explicitly isolated Playwright auth/concept fixture.
- **Commerce:** Cart and checkout routes state that persistence, orders, and payment are unavailable. No checkout, pricing, inventory, or payment implementation exists; this is intentional.
- **Demo catalog:** The local seed has 3 products, all explicitly marked as demo. Artwork is conceptual and no real inventory/price is implied.
- **Draft retention:** Guided answers and same-tab Studio transfer are in memory. Full refresh can discard them, as specified.
- **Not-found status:** An invalid product path renders the custom no-index not-found UI and no product data. The observed HTTP status was 200 because the route response had begun streaming. The installed Next.js 16 docs describe this streamed `notFound()` behavior; no defect is filed for it.
- **Accessibility coverage:** Chromium keyboard and DOM semantics were checked; a full screen-reader, contrast, and automated WCAG/axe audit was not run. Firefox, WebKit, and Safari were not tested.

## Proposed M1-D.2 order

1. Fix and regression-test the 768px Guided selected-note remove hit target.
2. Add the tablet touch-target assertion to the responsive browser journey.
3. Add a separate real-SMS-independent screen-reader/contrast review and, if approved, an automated accessibility scan.
4. Expand the account UI fixture coverage only if the account flow receives further changes; current pagination, duplicate, CSRF retry, delete, and logout smoke coverage passes in an isolated browser fixture.

No application code or Backend source was changed to address this finding during the audit.
