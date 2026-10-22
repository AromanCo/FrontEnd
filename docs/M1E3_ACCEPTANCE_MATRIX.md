# M1-E.3 Smart Perfumer V1 Acceptance Matrix

Status: proposed tests for future implementation. Passing these checks would establish conceptual advisory behavior only, not physical fragrance compatibility, safety, manufacturing readiness, or commerce eligibility.

## Unit tests — pure engine and candidate validation

| Scenario | Expected evidence |
|---|---|
| Identical snapshot, catalog, and ruleset version | Byte-stable suggestion ID, delta, ordering, rationale and provenance. |
| Stable tie-breaking | Same selected note/layer is chosen independent of input catalog order; fixed layer order is explicit. |
| Empty composition | Typed no-guidance; no candidate note invented. |
| One-note / partial-layer composition | Only a documented structural layer experiment or typed no-guidance; no scent/performance assertion. |
| Maximum composition (current six-note cap) | Candidate may rearrange but cannot add a seventh note or silently truncate. |
| Duplicate selected note ID | Invalid input/candidate; no Apply-ready output. |
| Unknown catalog ID or stale/missing selected note | Typed invalid/unavailable result; no substitute note. |
| Invalid layer | Candidate rejected unless it uses exactly `top`, `heart`, or `base`. |
| Position validation through existing payload helper | Positions are nonnegative, contiguous and unique within each layer; no duplicate `(layer, position)`. |
| Selection preservation | Proposed note-ID set exactly equals the original set in V1; no removal/addition. |
| Rule provenance | Every result carries the exact editorial ruleset ID/version/rule ID; no Guided recommendation scores reused. |
| Missing/contradictory guidance data | No guidance or typed limitation; never fabricate rationale or result. |
| Ruleset version change | Old result remains unchanged; new run carries new version; output changes only if the rules actually change. |
| Candidate validation failure | No enabled Apply-capable candidate; failure reason is stable and testable. |
| Revision/source-token validation | Rename, note add/remove/move/reorder, route intent, composition identity, Save target, `savedId`, or async request ID mismatch invalidates the candidate. |
| Manufacturing eligibility | No advisory output can create or imply production eligibility; no formula/safety/performance fields exist. |
| Synthetic production fixture boundary | If future integration tests use one, it is explicitly marked synthetic and cannot be labeled real approval. |

## Component tests — Creative Studio UI and state

| Scenario | Expected evidence |
|---|---|
| Request suggestion | Active composition/name/revision remain unchanged while preview is displayed. |
| Preview comparison | Original and proposed names, notes, and layers are distinguished textually and changed notes are identified without color alone. |
| Accept | Explicit action applies a valid proposed snapshot only when source revision still matches. |
| Reject/keep original | Active composition remains byte-for-byte equivalent; no API request occurs. |
| Undo | Restores exact pre-accept name/order/layers; one-level undo expires on next manual edit or composition identity change. |
| Manual edit during preview | Preview is invalidated and cannot later overwrite the edit. |
| Manual edit after accept | Edit remains; stale undo is cleared. |
| Invalid candidate | Apply is disabled/absent and limitation is explained; no silent note truncation/removal. |
| Empty/no-guidance state | Useful Persian copy, Studio editing remains available, no alert that interrupts the user. |
| Catalog unavailable/stale note | Work is retained, retry/error is honest, suggestion is not applied. |
| No Save side effects | Request, preview, reject, accept and undo make no concept API writes. Existing Save remains explicit and uses existing auth/CSRF client. |
| Persian labels and keyboard | Accessible names for Improve/Preview/Apply/Keep/Undo; Tab/Enter/Space works; visible focus; no surprise focus movement. |
| Saved-concept route before Slice C | Apply is guarded on a loaded saved concept; preview/reject do not change `savedId` or issue PUT. |
| Saved ID without `concept` query | Apply remains guarded whenever live `savedId` is non-empty, regardless of URL query. |
| Save pending/success transition | Save start clears preview/undo and blocks advisor actions; successful create changing `savedId` invalidates prior candidate before advisor re-enables. |
| Rename while preview is open | Preview is discarded; a late apply attempt cannot restore the old name or composition. |
| Save during preview / late completion | Preview cannot apply while Save is pending; delayed success/failure cannot make a stale candidate current or attach a new Save target to another composition. |
| Undo and persistence | Save start clears Undo; UI does not imply Undo reverts a completed API write. |
| Existing grid and mobile tabs | Advisor is rendered within the existing Composition panel, not as a fourth grid child; at desktop it appears within that panel, and on mobile it appears only when Composition tab is active. Existing three tab roles/IDs/`aria-controls` continue to work. |
| Advisor focus/navigation | Keyboard reaches advisor disclosure/actions in logical RTL order; focus remains visible and stable across preview/reject/accept/undo; mobile tab switching retains existing semantics. |
| Transfer name contract | 120-character trimmed name round-trips; blank/whitespace and >120 names fail without mutation or truncation. Guided-generated names remain within their existing 60-character input limit. |
| Pending Guided transfer collision | Advisor fork is blocked while Guided transfer/intent is pending; the Guided draft remains current and unconsumed. |
| Saved-fork Undo boundary | UI says Undo is unavailable after successful route fork; original saved record remains unchanged and accessible. |

## Browser and integration tests

| Scenario | Environment / expected evidence |
|---|---|
| Creative Studio loads actual notes/families | Existing seeded FastAPI public catalog; record UUIDs from real API responses, not hardcoded application fallback. |
| V1 suggestion against selected real records | Browser uses actual loaded notes; advisory result is visibly labeled editorial and conceptual. |
| Manual editing after preview | Add/remove/move/reorder invalidates stale preview; no stale candidate overwrites composition. |
| Guided-to-Creative import | Existing real catalog handoff remains one-time and preserves name, real note IDs, layers, and order; advisor starts idle after import. |
| Saved concept and independent fork (Slice C) | Isolated authenticated fixtures may load a saved record; user explicitly confirms fork; URL detaches; composition survives route remount; Save targets POST/create and source remains unchanged. Clearly label fixtures; no public OTP bypass. |
| Saved-fork route remount | Proposed composition initializes only after detachment and validation; stale route intent cannot restore or overwrite the saved source. |
| Source-record preservation | After fork and Save-as-new fixture, original concept still has its original name/notes/layers; new concept is a separate POST target. |
| Expired fork transfer | Full refresh or missing matching in-memory transfer shows an honest expired message; no empty/fake draft initializes. |
| Guided/advisor transfer collision | With one Guided transfer pending, an advisor fork returns a blocked state and cannot replace, consume, or alter its ID/data/navigation intent. |
| Full refresh | Advisor/undo/unsaved fork is ephemeral as specified; no false persistence claim. |
| No unexpected writes | Network assertion: only explicit Save may call existing concept POST/PUT; advisor operations do not. |
| Catalog/API failure | Real or isolated failure fixture; retain active composition and report unavailable guidance without fake data. |

## Accessibility and responsive checks

- At 320, 390, 768, and 1440 CSS px, advisor remains inside the existing Composition panel in normal flow, no horizontal overflow, and original/proposed comparison is usable (sequential on narrow screens).
- At desktop widths, all three existing grid panels remain present with no extra grid child; at mobile widths, switching Notes/Composition/Result preserves current tab semantics, and advisor content is visible only within the active Composition panel.
- Keyboard-only request, preview, reject, accept, undo, and manual editing; focus remains predictable and visible.
- Semantic headings, clear status announcements for suggestion/accept/reject/undo/unavailable; no excessive live-region chatter.
- Changed notes and state are identified by text/icon/semantics, not color alone.
- Comfortable pointer targets, RTL reading and focus order, Persian line wrapping, reduced-motion behavior, no sticky overlay.
- Verify dialog focus containment/restoration only if saved-fork confirmation uses a dialog.
- Browser-engine and screen-reader coverage is reported only for technologies actually used; Chromium tests do not establish Firefox, WebKit/Safari, or screen-reader support.

## Failure and unavailable states

- Empty composition returns no guidance.
- No applicable rule returns useful no-guidance without fake advice.
- Missing or stale note disables preview/apply and preserves composition.
- Invalid candidate cannot be accepted or serialized.
- Catalog error preserves work and allows real retry.
- Stale async rule result is discarded after manual edit, route change, concept load, restart, or new Guided import.
- Unauthenticated explicit Save follows existing login preservation; advisor operations never open login and never save automatically.
- No production eligibility, quote, or order appears in Smart Perfumer V1.

## Saved-concept and Guided draft safety

Before Slice C, loaded saved concepts may be previewed but Apply must remain blocked. If Slice C is implemented:

1. Existing `?concept=<id>` route loads and remains the current saved target until explicit fork confirmation.
2. Fork detaches the saved concept route/target before applying the candidate and preserves the source server record.
3. The one-time in-memory transfer is ID-bound, survives the route transition, and is consumed only after catalog resolution and candidate validation.
4. Save from the resulting unsaved draft calls concept creation, not update of the source ID.
5. A failed catalog load, missing note, stale route intent, newer Guided transfer, or failed transition never consumes or overwrites a newer draft.
6. Existing Guided saved-route precedence, transfer retry, partial-import confirmation, and one-time consumption tests continue to pass.
7. If a Guided transfer occupies the provider's single pending slot, the advisor fork is blocked without replacing or consuming that transfer.
8. A transfer name uses the shared 120-character non-truncating contract; invalid names fail visibly without losing source state.
9. Undo is explicitly unavailable after successful saved-concept fork; the source record remains unchanged and the limitation is announced before confirmation.

## Acceptance boundary

V1 is acceptable for review when all unit/component checks pass, seeded catalog browser tests confirm actual catalog identity, desktop/mobile behavior preserves the three-panel/three-tab architecture, Save remains explicit and protected by the existing session/CSRF flow, and saved originals cannot be overwritten by advisor application. Until Slice C passes route/remount/API-target and transfer-collision checks, Apply must stay disabled for any non-empty live `savedId`. Acceptance does not establish chemistry expertise, product safety, manufacturing, production eligibility, provider readiness, or commercial availability.
