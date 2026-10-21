# M1-C.1 — Guided Studio M1-C.2 Implementation Plan

**Status:** Proposed plan only. No route, component, recommendation engine, or backend code was changed for M1-C.1.

## 1. Existing architecture reviewed

The current frontend is Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, Persian RTL and self-hosted Vazirmatn. `src/app/studio/guided/page.tsx` is an informational placeholder. `/studio/creative` renders the existing client `CreativeStudio`; that component loads actual family/note API records, handles note selection and concept CRUD, and uses the existing auth dialog/client. `NoteLibrary`, `CompositionWorkspace`, and `ConceptPreview` separate major Creative Studio views. `src/lib/studio/composition.ts` owns the `SelectedNote` / layer payload operations and `presentation.ts` owns explicitly presentational family mapping. The API client and `generated.ts` are the source for actual endpoint response/payload types.

Relevant design and integration documents reviewed: `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/API_INTEGRATION.md`, `docs/M1B_HANDOFF.md`, and `docs/M1B2_HANDOFF.md`. Backend sources reviewed: adjacent `../Backend/docs/API_CONTRACT.md`, `../Backend/docs/FRONTEND_INTEGRATION.md`, `../Backend/aroman/seed.py`, plus frontend-generated OpenAPI types. Backend was available locally; no backend changes are proposed.

Existing persistence boundary: concept API stores name and note selections only. Anonymous Creative Studio composition currently lives in component memory and resets on reload. There is no established guided-to-creative draft-transfer mechanism. Keep these statements true until a transfer mechanism is implemented and verified.

## 2. Recommended frontend modules

Names below are proposed file boundaries, not files created in M1-C.1. Adjust to the existing repository naming conventions during M1-C.2.

```text
src/app/studio/guided/page.tsx                 Server route/shell; metadata and page framing
src/components/studio/guided/GuidedStudio.tsx   Client flow coordinator, six-step state and catalog lifecycle
src/components/studio/guided/GuidedProgress.tsx Accessible progress + back/step announcement
src/components/studio/guided/GuidedStep.tsx    Step renderer/step-specific form groups
src/components/studio/guided/GuidedOptionCard.tsx Reusable radio/checkbox option presentation
src/components/studio/guided/GuidedNotePicker.tsx API-backed note search, like/avoid
src/components/studio/guided/GuidedReview.tsx   Review/edit summary, discovery and concept name
src/components/studio/guided/GuidedResult.tsx   Conceptual result, explanation, save/handoff/review/restart actions
src/lib/studio/guided/types.ts                 Answer and result unions/types
src/lib/studio/guided/answers.ts               Pure defaults, validation, reducer/update helpers
src/lib/studio/guided/recommendation.ts         Pure deterministic scoring/selection/explanation
src/lib/studio/guided/config.ts                 Editorial family mappings and weights with rationale
src/lib/studio/guided/payload.ts                Convert resolved notes to shared concept payload shape
src/lib/studio/save-concept.ts                  Shared concept POST/auth result handling; delegates CSRF to API client
src/lib/studio/draft-transfer.tsx               Optional in-memory Guided → Creative draft provider
```

Do not make `GuidedStudio` a monolith: keep its job to orchestration, focus/navigation, loading/error state, and calling pure functions. Step-specific components remain mostly controlled UI. The recommendation function accepts validated answers, readonly API family/note arrays, and config; it imports no React, fetch, browser storage, or auth module, making scoring independently testable.

### Shared concepts

- Continue using the actual generated `Family`, `Note`, `ConceptInput`, and concept client types. Avoid copied backend model definitions.
- Reuse `SelectedNote`, `Layer`, maximum-note constant and shared payload builder in `composition.ts`; if current helpers are too Creative-specific, extract a pure general builder without changing existing behavior.
- Reuse UI buttons/dialogs, `AuthProvider`, `LoginForm`, `apiClient` and concept CRUD. Add one shared concept-save/auth helper or carefully extract the existing Creative Studio save flow so Guided and Creative share 401, CSRF, duplicate-submit and error behavior. Do not implement a second auth or CSRF path.
- Reuse existing presentation palette/mood helper only where it is genuinely applicable. Add a separate guided family-color map if needed, labeled presentation-only, rather than changing recommendation logic in `presentation.ts`.
- Creative Studio's `NoteLibrary` and composition controls remain available as the detailed refinement UI. Guided flow need not duplicate a second full composition editor.

## 3. Catalog and API integration

1. Fetch families and notes using the existing client `catalog.families` and `catalog.notes`; request all pages because list endpoints have limit/offset and no total. Avoid assuming 24 or 6 outside the seeded local test fixture.
2. Distinguish request loading/error from valid empty arrays. Retry repeats the actual request; never replace a failed response with mock records.
3. Keep only UUIDs in answer selections where possible. Resolve every selected UUID against the current catalog at generation and before payload construction. Store no copied/derived UUIDs.
4. If a selected family disappears, display status, remove stale ID or require reselection, and do not calculate with a stale family. If a liked note disappears, omit it and tell the visitor. Unknown `family_id` never receives inferred metadata.
5. The only Guided network write is the existing concept `POST` after explicit `ذخیرهٔ مفهوم`. The action exists on a ready result with at least one selected real note; no-match cannot be saved. Use the shared save/auth helper, existing cookie credentials and CSRF client. No recommendation service, questionnaire endpoint, backend schema change, analytics event, or third-party service.

## 4. Draft handoff to Creative Studio

**Recommendation:** an in-memory app-level `StudioDraftProvider` (React context) mounted next to existing app providers. It stores one pending handoff `{transferId, name, selections: [{noteId, layer, position}]}` using actual note UUIDs; it does not store questionnaire answers. On `رفتن به استودیوی خلاق`, set the handoff and explicit navigation intent, then navigate to `/studio/creative?from=guided` (the query is a harmless view hint, not data). Creative Studio fetches the current catalog, resolves every ID, validates layers/positions, initializes state, and only then consumes the handoff exactly once. Failed catalog loading or failed resolution keeps the handoff and offers retry; never discard it on a failed load. If a note disappeared, show the missing item and require explicit confirmation to continue with remaining records; do not silently substitute or claim all suggestions transferred.

This provider is same-tab memory, not browser storage. Draft and navigation intent are lost on reload, matching the existing unsaved-composition expectation. It does not include phone, auth/session data, or questionnaire answers, and no note names/answers appear in URL parameters.

**Route precedence:** an explicit saved-concept route (`/studio/creative?concept=<id>`) always has priority over a pending Guided handoff. Load the saved concept first; never initialize it from or overwrite it with stale Guided state. If a pending Guided draft also exists, keep it dormant and show a visible notice with an explicit `بارگذاری پیشنهاد استودیوی هدایت‌شده` action only after the saved concept has loaded. Loading that draft requires explicit user intent (and confirmation if it replaces edits). Do not auto-apply a dormant draft on later Creative visits. A failed saved-concept load does not consume the Guided handoff. When the user explicitly loads the Guided draft, consume it only after successful catalog resolution and state initialization.

**Canonical editing and direct save:** Creative Studio remains the canonical full editor for layer assignment, ordering, add/remove, and six-note refinement. Guided result has four explicit actions: Save Concept, Continue in Creative Studio, Review Answers, Start Again. For direct save, both Guided and Creative call the same shared frontend concept-save/auth helper (or existing flow extracted once). A 401 opens the existing login UI without clearing the complete Guided result. After successful login, the user must click Save again; never auto-retry the create POST. A 503/network/422 failure retains the result and shows an honest error; failed POST never clears state or claims saved. The helper delegates credentialed requests and CSRF renewal to the existing API client. No-match has no save action.

No cross-route transfer exists today. The provider, route precedence and direct-save integration are proposed M1-C.2 work and need browser verification, especially saved-concept precedence and catalog failures.

## 5. Recommendation implementation contract

Implement `recommend(answers, families, notes, config): RecommendationResult` as a pure deterministic function. Use the rules in `M1C1_RECOMMENDATION_RULES.md` verbatim unless the product owner approves a documented change. Return a discriminated result such as:

```ts
type RecommendationResult =
  | { status: 'ready'; selections: SelectedNote[]; explanation: string[]; matchedFamilyIds: string[] }
  | { status: 'no-match'; reason: 'no-notes' | 'all-excluded' | 'familiar-scope-empty'; explanation: string[]; exploratoryLimitation?: string }
  | { status: 'invalid'; reason: 'missing-family' | 'unknown-family' | 'conflicting-note-choice' };
```

Do not let the pure function perform API calls, mutate answer arrays, or fall back to sample records. Enforce at most six notes in both recommendation and later editing; the normal recommendation target is four. Backend `position` is unique/nonnegative per layer; generate contiguous layer-local positions. Layer assignment is explicitly conceptual.

## 6. Test plan

### Unit (Vitest)

- Answer validation: required steps, family count 1–2, like/avoid max 3 and disjoint, name trim/length.
- Every mapping row and weight; absent/unknown family behavior; discovery score effect and exploratory outside-family reservation.
- Deterministic tie-break independent of API array ordering.
- Explicit likes preserved in input order; avoided UUIDs never selected; familiar allows explicitly liked outside-family notes; exploratory reservation cannot replace likes or select avoided notes.
- Familiar preserves a valid explicitly liked note whose API `family_id` is unresolved, but such a note does not satisfy exploratory's known outside-family requirement.
- Same-answer/catalog comparison across all three discovery modes; balanced is allowed, but not required, to return an outside-family note.
- Corrected Example 4 scores are asserted exactly: floral 10, woody 10, amber 1, fresh 0, citrus 0, gourmand -1.
- Null `family_id` and unknown non-null family UUIDs receive no inferred properties and cannot satisfy exploratory expansion. For internal ordering, null is the first unresolved bucket; unknown UUID buckets follow in literal UUID order; notes within each bucket sort by slug then note UUID. Permuting API arrays preserves this order.
- No-match has no save action and cannot create a fake successful concept.
- Same answers/catalog produce the same ordered selections and explanations, including when API array input order is permuted.
- Four-note target, fewer-than-four, zero candidates, >6 protection, unique IDs.
- Layer sequence and contiguous per-layer positions; payload contains only actual current API note UUIDs, valid layers, and no answer fields.
- One-time handoff tests, catalog-failure retention, and saved-concept route precedence over stale Guided state.
- Explanation clauses mention only real contributing answers; no unsupported claims or name-derived score.
- Worked examples from recommendation rules, including conflicting preferences and incomplete catalogs.

### Component (Testing Library/Vitest)

- Six steps and progress labels; required validation; back/edit retains answers; changing prior answer recalculates on review/result.
- Family/note API loading, empty, error/retry, stale note/family states; retry invokes the actual client mock once.
- Note like/avoid cap and mutual exclusion; search/filter; skip; visible selection count.
- Focus moves to step heading; selected radio/checkbox semantics; status/error live announcement.
- Exact four result actions; no-match save unavailable; rename, restart confirmation, auth preservation, explicit post-login save retry, failed-POST draft retention and pending-save guard.
- When a saved concept route and dormant Guided draft coexist, a simulated successful saved-concept load wins; the draft is not auto-applied and is offered only through explicit user action. If saved load fails, the pending handoff remains intact.
- Reduced-motion and responsive class/state behavior where practical.

### API integration

- Existing integration suite exercises actual FastAPI contract for families, notes, auth, CSRF and concepts. Do not add a recommendation endpoint.
- Run the Backend's existing private `TestClient` fixture for authenticated concept create/read/update through its isolated in-process test setup. The fixture may use test-only fake SMS internally; never expose OTP values or add a public bypass. This verifies the FastAPI contract, not frontend browser authentication.

### Browser (Playwright)

- **A — real anonymous browser verification:** load live public families/notes; do not assert fixed production counts (seeded local environment may assert six families/24 notes). Complete Guided anonymously, verify recommendations/actions, no-match state, and same-tab Creative handoff with name, UUID, layers and positions; test catalog retry. Anonymous Save opens the existing login while preserving the complete visible result. If challenge returns SMS 503, verify honest unavailable copy and no false saved state.
- **B — isolated authenticated API verification:** use the existing private FastAPI `TestClient` fixture to create, read and update a concept with the fixture's isolated in-process authentication/CSRF setup. This is backend contract coverage only; do not report it as browser saving.
- **C — authenticated browser Save:** remains unverified while real SMS delivery is unavailable, unless a separately approved, strictly isolated browser mechanism becomes available without exposing a public OTP bypass or returning fake codes through HTTP. Real SMS is not a Guided development milestone blocker.
- Handoff regression: successful Guided initialization consumes the handoff once; failed catalog loading retains it; an explicit saved `concept=<id>` route loads saved data first and never auto-overwrites it; any dormant Guided draft needs an explicit load action.
- 320, 390, 768 and 1440 widths: RTL, no horizontal overflow, visible focus, content reachability, reduced motion, touch target sizing, no sticky overlap.
- Keyboard and screen-reader smoke checks for progress, radio groups, result updates, errors, and focus.
- Assert no unsupported performance/safety copy and no browser console errors.

## 7. Small implementation stages

1. **Contract and pure model:** agree on spec decisions; implement answer types/validation and rules config; unit-test scorer, tie-breaks and payload mapping using API model fixtures.
2. **Catalog-backed questionnaire:** implement route orchestration, accessible progress, steps 1–5 and loading/empty/error/retry; test with real seeded catalog.
3. **Review and recommendation result:** implement step 6, result, explanation and no-match; validate deterministic behavior at component and browser level.
4. **Creative handoff and save:** add in-memory transfer provider with saved-concept precedence; add direct result Save through the shared auth/save helper; reuse canonical Creative editor. Run isolated FastAPI TestClient create/read/update tests and anonymous browser/login-preservation checks. Mark authenticated browser Save unverified unless an approved isolated mechanism exists.
5. **Responsive/accessibility QA:** verify target widths and keyboard/screen reader behavior, update visual docs/screenshots, then run full required test/typecheck/lint/build gates.

Each stage should remain reviewable; do not add backend or production dependencies in this milestone unless an approved contract gap is demonstrated.

## 8. M1-C.2 acceptance criteria

M1-C.2 is acceptable only when all applicable criteria below pass:

### Product flow and answers

- Exactly six questionnaire steps render with the Persian titles, questions, options and progress copy specified in `M1C1_GUIDED_STUDIO_SPEC.md`.
- Steps 1–4 and 6 block Continue until valid; Step 5 requires either an explicit note choice or the explicit skip choice. No answer is silently preselected.
- Back and review-edit navigation preserve all unchanged answers. Changing any scoring answer recalculates the recommendation when the visitor returns to the result.
- The same answers and same API snapshot yield the same ordered UUID/layer/position result on every run.
- Concept name trims correctly and remains within the UI limit; it does not affect scoring.

### Catalog and recommendation integrity

- Families and notes are fetched from the real FastAPI endpoints with all pages; no production-path hardcoded notes, IDs, or success fallback exists.
- Every selected note UUID exists in the current API note response; selected UUIDs are unique; result has 0–6 notes and normally targets four when enough eligible data exists.
- Avoided IDs never appear. Explicit liked notes that remain in the catalog are included; a missing liked note is disclosed and omitted.
- Each selection has only `top`, `heart`, or `base`; positions are nonnegative, unique and contiguous within each layer. The outgoing body matches existing concept schema exactly (`name`, `notes[{note_id, layer, position}]`) and has no questionnaire fields.
- Family weights, discovery behavior, tie-breaking and result explanations match the rules document and worked test vectors. Unknown family IDs receive no invented mapping; unresolved note families, including `family_id = null`, stay neutral. Test the null bucket before unknown non-null UUID buckets, UUID ordering between those buckets, and slug-then-note-UUID ordering within each bucket.
- Exploratory reserves a note from a resolved, known non-selected family whenever an unfilled target position and eligible candidate exist, unless a preserved liked note already satisfies the rule. Avoidance is never overridden; unavailable exploration is disclosed. Balanced has no outside-family guarantee; familiar permits explicitly liked outside-family notes.
- Example 4 adjusted scores are asserted exactly: floral 10, woody 10, amber 1, fresh 0, citrus 0, gourmand -1; its Balanced result uses only selected families despite other families being available. Example 7 verifies familiar/balanced/exploratory differences and Balanced fallback when selected-family candidates are insufficient.
- Permuting family/note API arrays does not change ordered selections or explanations. Null-family notes form the first unresolved bucket; unknown non-null family UUID buckets follow in literal UUID order; notes within each bucket sort by slug then note UUID. Neither unresolved kind receives invented properties or satisfies exploratory expansion.
- No-match has no Save action and cannot create or claim a successful concept.
- Valid empty catalogs, network errors, stale records, familiar-scope no-match, and all-excluded cases show distinct honest states; no fabricated recommendation is shown.
- Explanation clauses mention only answers that affected the selected notes. No unsupported claim about a real scent, safety, allergy, chemical feasibility, performance, concentration, inventory, or price appears.

### Authentication and Creative Studio

- Anonymous visitors can answer and see/refine the result. Save uses existing cookie session and CSRF client; no token is stored in browser storage.
- Direct Save uses existing cookie/CSRF concept API through shared save/auth logic. Anonymous save opens existing login while preserving the complete visible result; after login, explicit retry is required. SMS HTTP 503 is honest; no OTP is exposed, fixed or assumed. Failed POST never displays success or clears state; duplicate submits are prevented.
- Guided-to-Creative handoff carries name, actual note UUIDs, layers and positions in memory only; successful initialization consumes it once; catalog failure retains it. Saved-concept route takes precedence and is never overwritten by stale handoff; dormant handoff requires explicit user action.
- Saved concepts reopen through existing flow. Missing note IDs are handled without substituting fake records. Backend TestClient verifies authenticated create/read/update; that is not browser Save verification.
- Real browser checks cover anonymous Guided completion and Creative handoff. Authenticated browser saving remains explicitly unverified unless real SMS works or an approved strictly isolated browser mechanism exists. Real SMS is not a development-milestone blocker.
- Refresh resets questionnaire and unsaved draft in the documented V1 behavior; no UI copy claims persistence.

### Responsive, RTL, and accessibility

- At 320, 390, 768 and 1440 CSS px, no unintended horizontal overflow occurs, all content/actions remain reachable, and layouts adapt without fixed bars covering controls.
- Persian content, alignment, reading order, focus order, and progress announcements are correct in RTL. At least keyboard-only testing completes all six steps, edits answers, receives validation, and activates result actions.
- Choice groups expose fieldset/legend and native radio/checkbox semantics; selected state is not color-only; step changes move focus to the new heading; loading/errors/selection counts are announced accessibly.
- Primary interactive targets are at least 44×44 CSS px where practical; focus is visible; reduced-motion mode removes nonessential transitions.
- Browser console has no unexpected errors; seeded local browser run confirms its demo catalog (six families, 24 notes) loads, while assertions do not impose those counts on future production catalogs.

## 9. Risks and dependencies

- **Editorial mappings may not feel right:** weights are transparent and adjustable, but require product review and later qualitative testing. Keep mapping config separate from code flow.
- **Sparse or changing catalog:** API is demo-seeded, paginated, and has no total. Fetch all pages; graceful no-match is required.
- **Stale UUID at save time:** Backend validation can reject a removed note. Keep user draft and offer refresh/refine; no false success.
- **Creative Studio is stateful:** initializing it from a handoff must not overwrite a user-edited current composition without clear navigation intent. Use a source marker and explicit draft acceptance or route transition contract.
- **Auth provider has no public SMS delivery:** authenticated FastAPI contract uses the existing private TestClient fixture; frontend authenticated browser Save remains unverified unless an approved isolated mechanism exists. No test-only login path belongs in the public frontend.
- **Privacy:** no answer persistence or preference analytics by default. A future persistence request needs explicit product/privacy review.
- **Seed records are demonstrations:** label demo context where appropriate; never imply products are purchasable or notes are stock.

## 10. Product-owner approval status

The defaults accepted for this revision are incorporated: six steps, four-note target, six-note refinement ceiling, one or two chosen families, up to three liked/avoided notes, absolute exclusions, anonymous use, memory-only questionnaire, same-tab handoff, existing concept API/auth/CSRF, no recommendation API, and conceptual-only claims.

The remaining approval is sign-off on the revised editorial family weights and deterministic selection policy, including exploratory's reserved outside-family note, as a coherent V1 recommendation experience. Implementation should wait for product-owner approval of these revised documents. Real SMS is not a product approval gate for the development milestone; authenticated browser Save remains a separately reported verification limitation.

## 11. Explicit future proposals (not M1-C.2 requirements)

- Backend questionnaire persistence or recommendation endpoint: only if product needs cross-device recovery, server-side auditing, or evolving recommendation policy; requires separate API/privacy review and schema approval.
- Any scientific, safety, allergen, manufacturing or performance claims: require appropriate validated data and product/legal review; unsupported by current backend.
- Real SMS provider, commerce, checkout, price/inventory, and product recommendation integrations remain separate milestones.

