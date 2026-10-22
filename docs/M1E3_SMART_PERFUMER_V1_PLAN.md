# M1-E.3 Smart Perfumer V1 Technical Plan

Status: proposed implementation plan only. This feature is not implemented. V1 is a local, deterministic **conceptual editorial advisor** in Creative Studio. It does not generate a physical formula, evaluate chemical compatibility, or determine production/sales eligibility.

## V1 boundary

Integrate first in the existing Creative Studio composition workflow. Users may inspect the current composition, request one optional suggestion, preview it against the unchanged original, accept or reject it, undo one accepted change, and continue manual editing. Suggestions are restrained structural experiments about the existing conceptual layers and catalog labels. They are not claims that notes smell good/bad together.

Guided Studio remains unchanged: its six-step recommendation and same-tab transfer continue to work. After import, the user can optionally open Smart Perfumer in Creative Studio. No additional Guided step, Backend endpoint, AI call, commerce action, production check, preference persistence, or unsolicited alert is added.

V1 requires no reviewed perfumery compatibility dataset. The rules are labeled **AROMAN editorial layer-exploration rules**, versioned in source, and explain only observable composition structure. If a rule cannot produce a valid candidate, show no guidance. Do not repurpose Guided Studio's family scoring.

## Existing-code integration points

Audited implementation:

- `src/lib/studio/composition.ts`: `SelectedNote = { note: Note; layer: Layer }`; `Layer` is `top | heart | base`. The ordered `SelectedNote[]` is the editing state. `payload(name, selected)` derives layer-local positions from array order; `addNote`, `moveNote`, `reorder`, and `summary` are existing helpers. Current add limit is six.
- `src/components/studio/CreativeStudio.tsx`: owns `name`, `selected`, real note/family loading, manual controls, tab state, login, errors, Save, and orchestration. Keep it the single source of active composition state. Its Save uses `savedId ? concepts.update(savedId, body) : concepts.create(body)`.
- `/studio/creative?concept=<id>` loads an authenticated concept and sets `savedId`; saving then PUTs that record. The URL and loaded state identify the saved editing target.
- `/studio/creative?from=guided` plus root `StudioDraftProvider` performs a one-time, ID-checked Guided transfer. Saved-concept route takes precedence; a saved concept is detached before Guided import by routing to an unsaved context. Catalog resolution and route-intent protections prevent stale import overwrite.
- `CompositionWorkspace` displays/edit layers and name. `NoteLibrary` browses real API notes. `ConceptPreview` is the existing conceptual result and Save entry point. Insert the compact advisor panel near composition/preview, preferably between the workspace and preview on desktop and as an in-flow disclosure on mobile. Do not replace any existing editor.
- `catalog.notes` is paginated and there is no note-by-ID endpoint. Selected `Note` objects originated in real API responses, but absence from a filtered page does not prove a note is stale. If V1 must validate current availability, fetch a complete paginated catalog snapshot before enabling Preview/Apply; on failure retain the composition and return unavailable.
- Backend contract `ConceptInput` accepts name plus unique actual `note_id`, `layer` in `top|heart|base`, nonnegative position. Backend enforces the configurable note cap (currently six), unique note IDs and unique `(layer, position)`. It has no advisory or production API.

The current ordered array does not store `position` on each `SelectedNote`; preserve compatibility by deriving candidate positions through the existing `payload()` helper and validating that output. Do not introduce a competing composition wire format.

## Proposed TypeScript domain interfaces

These are design signatures, not current exported code. Keep them in `src/lib/studio/advisor/types.ts` (or another small `src/lib/studio/` module) and reuse `SelectedNote`, `Layer`, `Note`, and `ConceptInput`.

```ts
type CompositionSnapshot = Readonly<{
  name: string;
  selected: readonly SelectedNote[]; // order is meaningful within each layer
  revision: number;                  // local edit revision, not a backend version
  compositionIdentity: string;       // changes on load/import/restart/fork
  routeIntent: string;               // current App Router editing intent
  saveTargetId: string | null;       // current savedId, not only the URL query
}>;

type AdvisoryRuleIdentity = Readonly<{
  rulesetId: 'aroman-editorial-layer-exploration';
  version: '1.0.0';
  ruleId: 'explore-empty-layer' | 'explore-layer-sequence';
  labelFa: 'راهنمای ویرایشی آرومان';
}>;

type AdvisorySuggestion = Readonly<{
  id: string;                         // deterministic within snapshot + rule version
  titleFa: string;
  rationaleFa: string;
  provenance: AdvisoryRuleIdentity;
  sourceRevision: number;
  sourceCompositionIdentity: string;
  sourceRouteIntent: string;
  sourceSaveTargetId: string | null;
  original: CompositionSnapshot;
  proposed: CompositionSnapshot;
  changedNoteIds: readonly string[];
  limitationsFa: readonly string[];
}>;

type AdvisorState =
  | { status: 'idle' }
  | { status: 'preview'; suggestion: AdvisorySuggestion }
  | { status: 'accepted'; suggestion: AdvisorySuggestion; original: CompositionSnapshot; undoUntilRevision: number }
  | { status: 'no-guidance'; reason: 'empty' | 'no-structural-rule' | 'catalog-incomplete' }
  | { status: 'invalid'; issues: readonly ConceptValidationIssue[] }
  | { status: 'unavailable'; reason: 'catalog-loading' | 'catalog-failed' | 'stale-selection' };
```

`ConceptValidationIssue` should be a small discriminated union for `too-many-notes`, `duplicate-note-id`, `unknown-note-id`, `invalid-layer`, `invalid-position`, `duplicate-layer-position`, and `selection-removed`. It is domain data, not Persian UI strings.

Snapshots copy the name and ordered selected records at request time. They must not retain mutable arrays. The original and proposed snapshots are presentation/domain versions of existing `SelectedNote[]`, not saved Backend records. In V1, no snapshot is persisted except through the existing explicit concept Save action.

## Deterministic V1 editorial rules

Rules operate only on the current valid composition and current real catalog records. The ruleset object is immutable and has a stable ID/version, Persian label, short description, and rule definitions. Output ordering is stable and independent of API response order.

1. **Empty composition:** return `no-guidance: empty`; there is no existing note to experiment with and no note is invented.
2. **Explore an empty narrative layer (`explore-empty-layer`):** if at least one of top/heart/base is empty, propose moving one existing note into the first empty layer in `top, heart, base` order. Choose the first eligible selected note in current array order; do not remove a user's selection. The rationale only says this explores how the concept is organized across its narrative layers. It does not predict a scent effect.
3. **Explore a different sequence (`explore-layer-sequence`):** when every layer is occupied and no empty-layer suggestion applies, if a layer contains at least two notes, propose swapping the first two notes within the earliest such layer in `top, heart, base` order. This is an editorial ordering experiment, not a top/heart/base chemistry claim.
4. Otherwise return `no-guidance: no-structural-rule`.

For V1, return at most one suggestion per request. “Alternative” repeats the pure engine with a deterministic exclusion of already shown suggestion IDs; if no different valid rule candidate exists, return no alternative. Do not randomly permute, rank by a harmony score, infer traits from note names, or claim actual scent compatibility. Family names may be shown from the real API as neutral catalog metadata only; they do not influence structural rules.

Provenance displayed to customers: «پیشنهاد ویرایشی آرومان · نسخهٔ ۱» plus the specific rationale. This identifies an internal editorial rule source, not expert-validated scientific or manufacturing evidence. The current rules are deterministic product assumptions and should be reviewed before future expansion.

## Candidate validation before Preview/Apply

The pure engine first validates the current selection against the full current catalog and the existing `ConceptInput` payload contract. A candidate is previewable/applicable only if all checks pass:

1. Name is copied unchanged and no answer/preferences are added.
2. Count does not exceed configured maximum (currently six); the advisor never silently truncates.
3. Note IDs are unique and each selected ID resolves to the actual API catalog note record. For current-availability validation, use a complete paginated catalog snapshot. Missing/stale IDs make the candidate unavailable until resolved; no substitute note is fabricated.
4. All layers are exact `top`, `heart`, or `base` values.
5. `payload(name, proposed.selected)` produces nonnegative, contiguous, unique layer-local positions and unique `note_id`s.
6. The candidate preserves the exact set of customer-selected note IDs. V1 only relocates/reorders; it never adds/removes a note.
7. Candidate is a new immutable array; input arrays and current React state are untouched.
8. Before Preview appears and immediately before Apply, compare source revision, composition identity, route intent, live `savedId`/Save-target identity, and async request ID against current state. Any mismatch discards the result and asks the user to request guidance again.

The core can return `Preview/Apply disabled` with a typed reason rather than a broken suggestion. Concept validation is not production eligibility.

## State transitions

| Current state/event | Next state/action | Invariant |
|---|---|---|
| Empty composition → request | `no-guidance: empty` | No invented notes; manual editing stays available. |
| Valid composition → request | Validate catalog and payload; then `preview` or typed no-guidance/unavailable | No mutation and no API write. |
| Preview → keep original/reject | `idle` | Original state and save target unchanged. |
| Preview → accept | Set active composition to a copy of `proposed`; `accepted` stores exact original for one-level undo | Explicit action only; validate revision again immediately before state update. |
| Accepted → Undo | Restore exact original name/order/layers; `idle` | Single level; no save/write side effect. |
| Accepted → new suggestion accepted | Replace undo slot with the immediately prior active snapshot | One-level undo always refers to the last accepted advisor change. |
| Preview → manual edit | Invalidate preview; `idle` | Stale preview cannot overwrite edit. |
| Accepted → manual edit | Keep active composition edit; clear undo slot | Undo expires at the first manual edit after acceptance. |
| Any state → rename, add/remove/move/reorder | Increment composition revision; clear preview and stale undo | A preview cannot replace newer customer edits. |
| Any state → another concept loads/imports, restart, or route/composition identity changes | Change composition identity/route intent; clear preview and undo | A candidate from the earlier editing context cannot apply. |
| Any state → Save target or `savedId` changes | Invalidate preview and undo; block Apply whenever `savedId` is non-empty | Guard uses the live Save target even if URL has no `concept` query. |
| Preview → Save starts | Invalidate preview and clear undo; disable advisor actions while `busy` | A pending write cannot race with Apply. |
| Save completes and may establish/change `savedId` | Update Save-target identity and invalidate candidate/undo before re-enabling advisor | A suggestion created while unsaved cannot remain Apply-ready after POST succeeds. |
| Save fails without changing target | Keep composition; preview was invalidated at Save start; show existing Save error | No stale preview survives an overlapping write. |
| Stale async catalog/advisor result arrives | Ignore unless request ID and complete source token still match | Late results cannot replace current state. |
| Any state → catalog begins loading/fails | `unavailable`; retain active composition and saved target | Retry uses real paginated API reads; no fake notes. Discard preview if it cannot be revalidated. |
| Selected catalog note disappears | `unavailable: stale-selection`; disable preview/apply | Do not silently remove it. Explain refresh/revise path. |
| Route change / restart / concept load / new Guided import | `idle`; clear preview and undo | Advisor state never crosses composition identity or route intent. |
| Request resolves after revision/route changed | Ignore stale result | Compare revision and route/session intent before setting state. |
| Existing saved concept loads | Bind advisor snapshot to loaded concept ID/revision; keep update target unchanged | Preview/reject is safe; applying is blocked until an independent draft is created. |

Undo is single-level in V1 and exists only in memory. It expires on the next manual edit, new composition identity (restart/load/import/route change), Save start, Save-target change, or a later accepted advisor suggestion (which replaces the undo target with the immediately prior snapshot). It never undoes a completed API write. Save clears Undo before sending; the UI does not imply that Undo can revert a persisted record. The existing saved concept remains available through the account experience.

## Saved-concept safety

The current editor intentionally uses `savedId` to choose between PUT update and POST create. Simply accepting a preview into `selected` on `/studio/creative?concept=<id>` would therefore let the next existing Save action PUT over the saved original. Guard on live `savedId`, not merely `conceptId`: a saved record remains protected after query/route changes until the editing context is explicitly detached.

V1 must use one of these safe policies:

1. **Slice B guard:** preview/reject are enabled on saved concepts, but Apply is disabled there with a clear explanation until independent-draft support lands.
2. **Slice C independent draft (recommended):** on explicit Apply from a loaded saved concept, confirm that a separate draft will be created. Put the proposed snapshot in the existing root in-memory `StudioDraftProvider` using a new discriminated advisory-fork transfer type and unique transfer ID. Navigate with a harmless `from=advisor` intent that contains no note/name data. Detach `?concept=<id>` before import, then resolve the transfer against the real note catalog and consume once after validated initialization. Initialize `savedId` empty so the ordinary explicit Save uses `concepts.create` (POST), never PUT to the source. Preserve the original server concept unchanged.

The current `StudioDraftProvider` has one pending-transfer slot, currently used by Guided Studio. V1 collision policy: **block an advisor fork while any Guided transfer is pending or its navigation intent is active.** Show a non-destructive message and let the user recover/finish the Guided transfer; do not overwrite, consume, or silently discard it. Preserve transfer-ID checks so a stale advisor request cannot consume a newer Guided draft or change Guided behavior.

The provider currently rejects names longer than 60 characters, while Creative Studio and the Backend concept contract allow 120. Propose one shared transfer limit of 120 trimmed characters to match Creative/Backend; the Guided input remains capped at 60, so its generated transfers remain unchanged. Advisor forks preserve the full current name. Empty/whitespace or over-120 names return an explicit non-destructive error and create no transfer. Validate at creation and resolution; never truncate silently.

The independent-draft route must also retain the existing Guided protections: saved-concept route precedence, explicit replacement confirmation when composition is dirty, route-intent invalidation, catalog-failure retention, exact transfer-ID consumption, missing-note confirmation, and refresh-expired messaging. Do not add a second slot or URL payload.

After a saved-concept fork completes the route transition, V1 does **not** promise Undo across that transition. The saved source remains unchanged and accessible. Before confirmation, explain that the detached draft starts from the proposed composition and Undo is unavailable after transfer. If import validation/remount fails, retain the transfer and do not consume it. Do not claim that the source was edited or deleted.

On an ordinary unsaved concept, Apply changes only the active in-memory composition. Existing Save remains explicit. If it is subsequently saved, current behavior POSTs a new concept. Existing saved concepts are never auto-saved or auto-duplicated.

## UI insertion and Persian labels

The existing `studio-grid` has exactly three coordinated children: Note Library, Composition panel, and Preview panel. Place the optional advisor disclosure **inside the existing Composition panel**, for example after the layers/disclaimer, using an optional advisor slot/child on `CompositionWorkspace`. Do not add a fourth `studio-grid` child. On mobile the advisor is visible only when the existing Composition tab is active; preserve the existing three tab roles, IDs, `aria-controls`, and panel visibility. Do not add another tab, floating/sticky control, or navigation step.

Suggested labels:

- Entry: «پیشنهاد خلاق» / action «یک پیشنهاد برای ترکیبم».
- Direction: «یک آزمایش در چیدمان لایه‌ها».
- Rationale: «این پیشنهاد فقط راه دیگری برای چیدن روایت مفهومی شماست.»
- Preview heading: «ترکیب فعلی» and «پیشنهاد برای کاوش».
- Apply: «ساخت نسخهٔ پیشنهادی»; reject: «ترکیب فعلی را نگه می‌دارم»; undo: «بازگشت به ترکیب قبلی».
- No guidance: «برای این ترکیب پیشنهاد ویرایشی دیگری نداریم؛ می‌توانید به ساخت آزادانه ادامه دهید.»
- Saved concept apply guard: «برای حفظ مفهوم ذخیره‌شده، ابتدا یک پیش‌نویس جداگانه بسازید. نسخهٔ اصلی تغییر نمی‌کند.»
- Fork/Undo limitation: «نسخهٔ اصلی ذخیره‌شده بدون تغییر می‌ماند؛ پس از انتقال، بازگشت به ترکیب پیش از پیشنهاد در این صفحه ممکن نیست.»
- Save/Undo: «بازگشت، ذخیرهٔ انجام‌شده را برنمی‌گرداند.» Do not offer Undo after Save starts.
- Pending Guided transfer collision: «یک پیش‌نویس هدایت‌شده هنوز در انتظار انتقال است. ابتدا آن را بازیابی کنید؛ این پیش‌نویس جایگزین آن نمی‌شود.»
- Invalid transfer name: «نام مفهوم برای انتقال معتبر نیست. نام را بررسی کنید؛ هیچ بخشی از آن حذف نشده است.»
- Catalog unavailable: «برای بررسی پیشنهاد، دریافت نت‌ها کامل نشد. ترکیب شما محفوظ است.»

Do not use red “bad blend” styling, scores, compatibility badges, safety/performance claims, or manufacturing availability copy in this panel.

## Exact future file plan

### Additions

- `src/lib/studio/advisor/types.ts` — domain state, rule identity, suggestion, validation issue unions.
- `src/lib/studio/advisor/rules.ts` — immutable ruleset identity and presentation copy.
- `src/lib/studio/advisor/recommend.ts` — pure deterministic candidate generation and validity checks, reusing `payload()`.
- `src/components/studio/BlendAdvisor.tsx` — compact optional UI, comparison, explicit accept/reject/undo/no-guidance states.
- `src/tests/advisor-recommendation.test.ts` — pure tests.
- `src/tests/blend-advisor.test.tsx` — component/state tests.
- Optional `src/tests/advisor-transfer.test.tsx` only if the existing draft-provider contract is extended.

### Minimal modifications

- `src/components/studio/CreativeStudio.tsx` — orchestration, revision invalidation, insertion point, explicit unsaved-draft/route handling in Slice C only.
- `src/components/studio/CompositionWorkspace.tsx` — optional advisor slot rendered inside the existing Composition tabpanel; needed to keep exactly three `studio-grid` children and current mobile tab semantics.
- `src/lib/studio/composition.ts` — preferably none; only add a small exported pure validator if needed and cover with existing composition regression tests.
- `src/lib/studio/draft-transfer.tsx` — only in Slice C, add the discriminated transfer type and ID-guarded consumption while preserving Guided semantics.
- `scripts/guided-studio-journey.mjs` or a focused new browser journey — real catalog integration/transfer check, only when browser acceptance begins.

No Backend or OpenAPI changes are needed for conceptual V1. Do not add a Backend advisory endpoint unless a future requirement demonstrates server-owned reviewed rules or persistence is necessary.

## Implementation slices

### Slice A — Pure advisory engine

- **Files:** add `src/lib/studio/advisor/{types,rules,recommend}.ts` and `src/tests/advisor-recommendation.test.ts`; optionally add validator to composition helper.
- **Transitions:** input snapshot → validated deterministic suggestion or typed no-guidance/unavailable/invalid; no side effects.
- **Tests:** determinism, tie-breaking, ruleset provenance, empty and max composition, valid IDs, unique IDs, layers/positions, no removal/truncation, missing catalog, unsupported claim scan.
- **Acceptance:** valid output is a `SelectedNote[]` compatible with `payload()` and preserves selected note ID set; same inputs/version yield identical suggestion; no chemistry or eligibility inference.
- **Risks:** treating UI layer labels as perfumery expertise; unverified catalog records; stale async inputs.
- **Non-goals:** UI, Backend, AI, save, production checks, external expert data.

### Slice B — Creative Studio advisor UI

- **Files:** add `BlendAdvisor.tsx` and component tests; minimal `CreativeStudio.tsx` orchestration, an optional slot in `CompositionWorkspace.tsx`, and scoped CSS. Keep exactly three `studio-grid` children.
- **Transitions:** idle → preview → accepted/undo; reject/no-guidance; any manual edit invalidates preview and after-acceptance undo. Catalog and route changes clear transient advisor state.
- **Tests:** preview does not mutate active `selected`; accept checks revision, composition identity, route intent, Save target and async request ID; reject leaves exact composition; undo restores it; manual edit/rename invalidates preview; Save pending/success/savedId transitions invalidate preview; errors preserve work; desktop/mobile visibility follows existing Composition panel/tab behavior; keyboard and Persian labels.
- **Acceptance:** no advisory state writes to API; only the existing user Save button can persist the active selected concept; result remains explicitly conceptual.
- **Saved concept constraint:** whenever live `savedId` is non-empty (even without a `conceptId` query), preview may be allowed but Apply stays disabled until Slice C. Disable advisor actions during Save. This guard is mandatory if C is deferred.
- **Non-goals:** saved concept fork, Guided behavior changes, provider/backend, price/eligibility.

### Slice C — Saved-concept isolation and browser acceptance

- **Files:** modify `CreativeStudio.tsx` and, if required, `CompositionWorkspace.tsx`; extend `draft-transfer.tsx` minimally with discriminated source/name validation while retaining its single slot; add transfer tests and a focused Playwright journey.
- **Transitions:** loaded saved concept → explicit confirmation → block if Guided transfer pending → validate name/candidate → one-time advisory-fork intent → detach `concept` URL → catalog resolve/validate → initialize unsaved composition with `savedId = ''` → consume matching transfer. Any newer route intent invalidates stale work; failed resolution retains pending transfer. Undo is unavailable after successful fork transition; source saved record stays unchanged.
- **Tests:** saved source unchanged; Save after fork POST/create, never PUT/update; full valid name and composition survive route remount; 120-character accepted/121-character and blank name rejected without truncation; Guided transfer collision blocks without overwrite/consume; missing notes require confirmation; catalog failure retains transfer; mismatched ID cannot consume newer transfer; expired transfer explained; Guided precedence/regressions pass.
- **Acceptance:** real browser confirms URL detachment, state recovery through remount and new-concept Save target. The draft is ephemeral and can expire on full refresh, disclosed honestly.
- **Risks:** async route races, existing provider semantics, accidental source overwrite, hidden API writes.
- **Non-goals:** changing Guided journey, durable drafts, new Backend routes, authenticated real-SMS bypass.

Slices A → B → C are recommended because the pure contract and UI can be reviewed before introducing route/provider lifecycle risk. Do not merge B for saved-concept use without the live-`savedId` Apply guard; C is required to activate independent application from a saved source. Keep the advisor inside the existing Composition panel throughout.

## Explicit exclusions

- Scientific or expert compatibility inference; chemistry, ingredient concentration, safety, allergens, longevity, projection, manufacturing feasibility, or claims about how an untested blend smells.
- Numerical harmony/compatibility/confidence scores.
- Guided questionnaire or Guided family-scoring changes.
- AI/LLM calls, analytics, Backend rules API, formula generator, supplier/manufacturer integration.
- Production configurations, eligibility, quotes, order/cart/payment, or purchasable Studio concepts.
- Persistent advisory history or questionnaire/preferences storage.
- Silent edits, silent note deletion/truncation, auto-save, or updating a saved original after Apply.

## Open product decisions before implementation

- Who reviews and owns the wording/rule set and version-release process?
- Should the `Improve My Blend` label remain, or is «پیشنهاد خلاق» more honest for structural editorial rules?
- Is single-level undo adequate for V1?
- Should recommendation provenance be fully customer-visible or shown through a short “about this suggestion” disclosure?
- Which team owns later expert review and controlled-personalization approval? Current manufacturing and eligibility remain unavailable.
