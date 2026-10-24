# M4-A1: isolated mobile Persian RTL browser coverage

Baseline: `develop` at `fff65a0d2f2d5e503c09e25440dc41431068b0b3` (merged PR #19).

M4-A2 focus-fix baseline: `develop` at `fa6fc534ff05fa560fb8b20cebc61817d93202b1`.

Run `npm run test:browser:mobile-rtl` with the frontend running and system Chrome available. Set `CHROME_BIN=/usr/bin/chromium` when using the cloud image's Chromium. The CI step runs this command after the six existing isolated journeys, reusing their production Next.js server and system Chrome. No new dependency or Backend service is needed.

## Coverage and boundaries

`scripts/responsive-studio-journey.mjs` already checks grid columns, note-card dimensions, font sizes, the real 24-note Backend response, overflow, and a partial mobile continue/tab path. It writes screenshots. This milestone leaves that script intact and does not run screenshot jobs or write any artifact directory.

The new journey reuses `guided-save-fixture.mjs` and `browser-utils.mjs`. Each width gets a fresh browser context and synthetic in-memory API, with a catch-all network guard blocking unexpected external requests. It does not repeat the existing OTP, persistence, HTTP 401/503 retry, or duplicate-Save journeys.

At **320, 390, 768, and 1440 pixels**, with an 844px viewport height, it exercises:

- Persian document language, RTL direction, and document overflow at navigation, each Guided step, results, Creative editing, mobile tab states, and the Save dialog.
- Real sequential keyboard navigation and named links through the responsive main navigation, including opening the mobile menu with Enter and following the Guided link.
- The six-step Guided UI using a keyboard radio selection and pointer/touch choices, labelled search/filter/name controls, disabled validation, progress semantics, and polite note-selection feedback.
- The actual Guided-to-Creative route, imported name/composition, keyboard layer changes, removal, filtering, note selection, and named count/status updates.
- Mobile Studio pointer/touch tab activation, RTL ArrowLeft/ArrowRight navigation, Home/End and wraparound, roving tab stops, focused tabs, and the corresponding visible panels. At 1440px it instead checks that mobile tabs are hidden and all three workspace panels remain visible.
- Actionability and in-viewport bounds for primary actions after normal scrolling. A local empty-name Save error is exposed as an alert; the normal Save action opens the named login dialog without a concept POST or OTP request.
- Form labels, sequential dialog Tab navigation, forward/reverse focus containment, Escape dismissal, and focus restoration to Save.

All unexpected browser errors, API errors, focus-order failures, missing focus indicators, and functional failures are fatal, including both Creative filter controls. Every viewport is attempted so a failure at one size does not conceal failures at other sizes. Readiness comes from UI state and response events, without arbitrary sleeps or screenshots.

## M4-A1-001 — Resolved in M4-A2

Before the fix, the existing normal journey reproduced two missing-focus advisories per viewport at all four widths; `--strict-a11y` failed on those eight findings. Both controls received keyboard focus without a visible indicator.

Regression verification:

1. Open Creative Studio with catalog data loaded. At 320/390/768px, select the Notes tab; at 1440px the library is already visible.
2. Focus the active Notes tab (or the top Save action at desktop width), then press Tab to reach the note search.
3. Press Tab again to reach the family filter.
4. Confirm that the focused control's rounded wrapper displays a 3px outline using `--focus`, offset by 4px, and that the ring moves from search to the family filter with keyboard focus. Before M4-A2 neither wrapper displayed this ring.

The original cause was `outline:none` on `.studio-search input,.studio-family-filter select`, overriding the global `:focus-visible` outline without a wrapper focus rule. The narrow correction in `src/app/globals.css` adds keyboard-focus outlines to the two existing wrappers:

```css
.studio-search:has(input:focus-visible),
.studio-family-filter:has(select:focus-visible) {
  outline: 3px solid var(--focus);
  outline-offset: 4px;
}
```

The advisory mechanism and both issue exceptions have been removed. The normal CI journey now asserts visible keyboard focus on both controls and fails if either indicator is missing. The outlines are tied to `:focus-visible` on the contained input/select; unfocused wrapper styling is unchanged.

Both the normal command and the retained `--strict-a11y` invocation enforce the same mandatory focus assertions:

```bash
CHROME_BIN=/usr/bin/chromium npm run test:browser:mobile-rtl -- --strict-a11y
```

Both invocations pass at 320, 390, 768, and 1440px after the fix, with no accessibility advisories. The browser checks verify the rendered wrapper outline during real sequential keyboard navigation, alongside the existing mobile RTL interactions and overflow checks.

## Accessibility scope

This is an accessibility smoke test, **not a full WCAG audit or compliance claim**. It checks actual keyboard focus and React interactions, accessible names through role/label queries, rendered outlines, and DOM live-region/error semantics. It does not measure color contrast, validate actual screen-reader announcements, cover every possible composition, or replace assistive-technology testing. Touch emulation in Chromium is not physical-device, Safari, or Firefox validation.

M4-A1 added test coverage only. M4-A2 changes only the narrow Creative filter focus rule in production CSS, strengthens the existing browser assertions, and updates this resolution record. No real SMS, account, payment, or manufacturing workflow is exercised.
