# M1-C.1 — Deterministic Recommendation Rules

**Status:** Proposed frontend product rules for M1-C.2; not implemented or scientifically validated.
**Purpose:** Turn six non-sensitive preference steps (with optional note-affinity selections) and the current FastAPI catalog into an explainable, editable concept.

## 1. Data constraints and source of truth

Backend docs read: adjacent `../Backend/docs/API_CONTRACT.md`, `../Backend/docs/FRONTEND_INTEGRATION.md`, OpenAPI export/types, and `../Backend/aroman/seed.py`. In the current seeded development environment, family slugs are `floral`, `citrus`, `woody`, `amber`, `fresh`, `gourmand`; there are 24 demo notes. The note seed includes rose, jasmine, orange blossom, violet, iris, lavender; bergamot, lemon, mandarin, grapefruit; cedar, sandalwood, vetiver, pine; amber, vanilla, incense, saffron; mint, green tea, sea breeze, rain; cocoa and coffee. These are demo records, not claims about purchasable stock.

The relevant public endpoints are `GET /api/v1/fragrance-families` and `GET /api/v1/fragrance-notes`. Both return arrays paginated with `limit`/`offset`; neither provides a total. Family records have `id`, `slug`, `name`, nullable `description`, `is_demo`. Note records have `id`, `slug`, `name`, nullable `description`, `is_demo`, and nullable `family_id`. The current seeded notes link to the six family records. Use actual response UUIDs; never construct IDs or derive a UUID from a slug.

The backend does not provide sweetness, freshness, intensity, sillage, longevity, gender/season suitability, chemical compatibility, ingredient concentration, safety, allergen, or manufacturing metadata. No note-level sensory score is assumed. Recommendation scores are family-level **editorial preference mappings maintained in frontend configuration**. The example narratives in this document are product assumptions and not objective scent facts.

## 2. Typed conceptual input

Types below specify intended M1-C.2 domain values; IDs are the actual API UUID strings. A family or note's `slug` is a backend field used to look up presentation rules, not a new API field.

```ts
type Feeling = 'calm' | 'bright' | 'confident' | 'intimate' | 'curious';
type Temperature = 'bright' | 'soft' | 'warm';
type Scene =
  | 'rainGarden' | 'citrusMorning' | 'quietFlowers'
  | 'woodland' | 'warmEvening' | 'coffeePause';
type Discovery = 'familiar' | 'balanced' | 'exploratory';

type GuidedAnswers = {
  feeling: Feeling;
  /** 1–2 IDs from the currently loaded family API response, in selection order. */
  familyIds: string[];
  temperature: Temperature;
  scene: Scene;
  /** 0–3 real note UUIDs; never overlap with avoidedNoteIds. */
  likedNoteIds: string[];
  /** 0–3 real note UUIDs; hard exclusion. */
  avoidedNoteIds: string[];
  discovery: Discovery;
};

type GuidedDraft = {
  answers: GuidedAnswers;
  conceptName: string;
  /** Proposal uses real API Note records, not a second note model. */
  selections: Array<{ noteId: string; layer: 'top' | 'heart' | 'base'; position: number }>;
};
```

Questionnaire state is transient and not sent to the API. The result's selected notes are resolved from the current API response. `conceptName` is presentation/concept data, not a preference signal.

## 3. Preference mappings and weights

Initialize each currently returned family score at `0`. Add the following points for every answer. A missing family slug in the API means the corresponding mapping has no effect. These are transparent editorial rules, to be reviewed after product testing.

| Answer | Family slug | Points |
|---|---|---:|
| Step 2 selected family | each selected family UUID | +8 |
| Feeling `calm` | `floral` | +2 |
|  | `fresh` | +1 |
| Feeling `bright` | `fresh` | +2 |
|  | `citrus` | +2 |
| Feeling `confident` | `woody` | +2 |
|  | `amber` | +1 |
| Feeling `intimate` | `floral` | +1 |
|  | `gourmand` | +2 |
|  | `amber` | +1 |
| Feeling `curious` | `citrus`, `woody`, `gourmand`, `amber` | +1 each |
| Temperature `bright` | `fresh` | +3 |
|  | `citrus` | +2 |
| Temperature `soft` | `floral`, `fresh`, `woody` | +1 each |
| Temperature `warm` | `amber` | +3 |
|  | `woody` | +2 |
|  | `gourmand` | +1 |
| Scene `rainGarden` | `fresh` | +2 |
|  | `floral` | +1 |
| Scene `citrusMorning` | `citrus` | +2 |
|  | `fresh` | +1 |
| Scene `quietFlowers` | `floral` | +2 |
| Scene `woodland` | `woody` | +2 |
|  | `fresh` | +1 |
| Scene `warmEvening` | `amber` | +2 |
|  | `woody` | +1 |
| Scene `coffeePause` | `gourmand` | +2 |
|  | `amber` | +1 |

Discovery modifies family scores after the preference points:

- `familiar`: ordinary candidates are limited to notes belonging to selected family UUIDs. Every valid explicitly liked catalog note is preserved as an exception, even if its family is outside the selection or unresolved. No extra points.
- `balanced`: keep all families eligible; subtract `2` from each *known* non-selected family's score. Selected families remain unmodified. Notes whose `family_id` is unresolved remain neutral at `0`.
- `exploratory`: keep all families eligible; add `2` to each *known* non-selected family's score. Notes whose `family_id` is unresolved remain neutral at `0`.

This is a deterministic breadth control. It does not infer that a family is objectively adjacent or novel. `familyIds` are validated against the latest API family response before scoring. If a previously selected family is absent, explain the unavailable choice and require a valid replacement before generation. An API family record with an unmapped slug is still a confirmed catalog family, but receives no invented mood properties. A note whose `family_id` does not resolve to any returned family record is unresolved and cannot count as an outside-family match.

## 4. Candidate handling and ranking

1. Build a map of family UUID → family record from the current API response; a note's family score is the score of its resolved `family_id`. Do not use note description text to infer a score.
2. Remove every note whose UUID is in `avoidedNoteIds`. Exclusion is absolute, including against an explicit like; UI prevents overlap, and engine should defensively reject overlap as invalid input.
3. Resolve valid explicitly liked notes in answer order. Preserve them first, even when their known family is outside the selected family scope. If an explicitly liked note disappeared, omit it and show a Persian notice identifying that catalog content changed. Avoided notes remain excluded in all later steps.
4. Candidate target is `min(4, count(non-avoided notes eligible by scope plus valid liked exceptions))`. If target is zero, return `no-match`. Start the ordered result with all valid likes; liked notes do not add points to other notes in their family.
5. Apply the explicit `exploratory` reservation before filling remaining positions:
   - If an already included liked note belongs to a resolved, known API family outside the selected family UUIDs, the exploration requirement is satisfied.
   - Otherwise, if at least one non-avoided eligible note in a resolved, known non-selected family exists **and** there is an unfilled target position, reserve one position for the highest-ranked such outside-family note. Rank by adjusted family score descending, then family slug ascending, then note slug ascending, then UUID lexicographically. Add it immediately after the liked notes. This cannot displace a liked note.
   - An unresolved `family_id` never satisfies or fills this reservation. If no known outside-family candidate exists, continue with the remaining eligible records and append an honest limitation explanation.
6. Fill remaining positions with selected-family candidates first. Order selected family buckets by adjusted score descending; equal selected-family scores use the user's family tap order, then family slug. Within a bucket sort notes by `slug`, then UUID. Visit each bucket once per sweep, adding its next note while fewer than two selected records belong to that family (likes/reserved records count). If a full sweep adds nothing and selected-family candidates remain, remove the two-per-family cap and continue in the same order. For `familiar`, stop after this pool; explicit likes from other families are already preserved.
7. In `balanced` and `exploratory`, if positions remain after selected-family candidates are exhausted, fill from non-selected **known** family buckets ordered by adjusted score descending then family slug; use the same note ordering, round-robin, two-per-family cap and no-progress fallback. Balanced does not reserve an outside-family note, so a result with enough selected-family candidates can contain only selected families. Exploratory's reservation is the guarantee when an eligible known outside note and a position are available.
8. In `balanced`/`exploratory`, unresolved-family buckets may fill remaining positions only after known family candidates; they remain neutral and do not qualify as outside-family matches. For deterministic ordering, put notes with `family_id = null` in one null bucket first among unresolved buckets. Then put each unknown, non-null family UUID in its own bucket, ordered by the literal UUID ascending. Within each unresolved bucket, order notes by slug and then actual note UUID using code-point-stable comparison. These are internal ordering keys only. They do not create family records or scent properties. Unresolved notes are excluded in `familiar` unless explicitly liked.
9. Preserve liked-note input order; remaining records follow reservation then deterministic family-pool order. Do not exceed four recommendations; subsequent user refinement may add up to the existing six-note limit. Deduplicate by real note UUID. Never create a fallback catalog record.

If fewer than four eligible records exist, return fewer. If none exists, return a typed no-match result and offer answer revision or Creative Studio. Unknown note families are not used to satisfy the exploratory reservation. If exploratory mode has no eligible known outside-family candidate, return the available result and include a limitation clause such as «در کاتالوگ فعلی نتِ دیگری از خانواده‌های متفاوت برای گسترش پیشنهاد پیدا نشد.»

### Missing/unknown catalog data

- If API family list is valid but empty, the required family step cannot be completed and generation is unavailable. Show an empty-catalog state with retry and a Creative Studio link; do not score against guessed families.
- If a note has a `family_id` that does not resolve to a current family record, keep it as a real catalog candidate with neutral family score `0` for `balanced`/`exploratory`; for `familiar`, it is out of scope unless explicitly liked. Label it «خانواده مشخص نشده» in UI. It never counts as an exploratory outside-family match. Never infer family from note name/description.
- For selection ordering only, place unresolved buckets after known family buckets. Group notes with `family_id = null` together in a null bucket, first among unresolved buckets. Group each unknown, non-null family UUID separately after the null bucket, ordered by its literal UUID ascending. Within each unresolved bucket, sort by note slug and then actual note UUID using code-point-stable comparison. These internal keys do not fabricate a family record or displayed family claim; neither kind of unresolved bucket can satisfy exploratory outside-family expansion.
- If family records exist but some expected slugs do not, ignore their mapping rows. Unknown family records can still be explicitly selected and receive the `+8` selection points; notes in such families rank neutrally apart from the selected family score.
- If note endpoint returns an empty array, Step 5 can be skipped, but result is no-match. Do not show a recommendation success state.
- If a network/HTTP request fails, do not treat it as empty data. Keep existing in-memory answers/selections, show a retry action that repeats the real request, and do not generate from stale or partial data without clearly indicating catalog refresh state.

## 5. Layer assignment and API payload

The layer is a visual/editorial arrangement only. Use a fixed sequence for the selected result in output order:

```text
top, heart, base, heart, top, base
```

The normal result target is four, so four notes distribute `top=1`, `heart=2`, `base=1`. Count `position` independently within each layer starting at zero in the order notes are assigned. Example four-note records:

```json
{
  "name": "رایحهٔ آرام من",
  "notes": [
    {"note_id": "<actual API UUID>", "layer": "top", "position": 0},
    {"note_id": "<actual API UUID>", "layer": "heart", "position": 0},
    {"note_id": "<actual API UUID>", "layer": "base", "position": 0},
    {"note_id": "<actual API UUID>", "layer": "heart", "position": 1}
  ]
}
```

Angle-bracket UUIDs above are explanatory placeholders, not valid values. M1-C.2 must use `note.id` exactly as returned by FastAPI. Before save, call the existing shared concept payload builder (or extract a shared pure builder) and validate: nonempty trimmed name within the UI limit; 1–6 distinct actual note UUIDs; valid `top | heart | base`; nonnegative contiguous layer-local positions. Existing API accepts `name` and `notes` with `note_id`, `layer`, `position`; use existing cookie credentials/CSRF behavior. Do not add questionnaire answers to payload.

## 6. Explainability rules

Build explanation clauses from answer provenance, not from guessed properties:

- If a user-selected family contributed at least one chosen note, say «با توجه به علاقه‌تان به خانوادهٔ {actual family name}…».
- If feeling or scene mapping added points to a selected note's family, mention that chosen preference, e.g. «و حال‌وهوای آرامی که انتخاب کردید…». Only use answer phrasing that actually contributed to chosen families.
- If one or more liked notes were included, add «نت‌هایی که خودتان پسندیدید در پیشنهاد حفظ شده‌اند.»
- If exploratory mode reserved a note from a resolved non-selected family, state «برای کمی کشف بیشتر، نتی از خانوادهٔ {actual family name} هم در پیشنهاد آمده است.»
- If exploratory mode found no eligible known outside-family note, include the limitation message specified above. Do not imply that exploration occurred.
- If balanced fallback adds a non-selected family after selected-family candidates are exhausted, explain that the available catalog supplied the additional note; do not claim it was guaranteed or specifically preferred.
- Avoid “because you are…”, “this will smell…”, “suits you perfectly”, performance, safety, or product efficacy statements.
- If no mapped preference explains a neutral family note (e.g. unknown family), explain only that available catalog data was limited and invite refinement; do not claim a personalized match.

Example: «این نت‌ها با توجه به علاقه‌تان به خانوادهٔ گلی و حال‌وهوای آرامی که انتخاب کردید پیشنهاد شده‌اند. این یک تصویر مفهومی است، نه فرمول ساخت عطر.»

## 7. Worked examples

All names below are actual seed note/family names in `../Backend/aroman/seed.py`; examples intentionally omit UUIDs because database UUIDs are runtime-generated. A valid API result must substitute actual UUIDs from that same live response. Scores are adjusted family scores; note names within a family tie unless explicitly liked, so the defined slug ordering applies. Layers use the fixed sequence above.

### Example 1 — گلی و آرام

**Answers:** feeling `calm`; families `[floral]`; temperature `soft`; scene `quietFlowers`; liked `[رز, اسطوخودوس]`; avoided `[]`; discovery `familiar`.

**Family scoring:** floral `8 + 2 + 1 + 2 = 13`; fresh `1 + 1 = 2`; woody `1`; citrus/amber/gourmand `0`. Familiar limits candidates to floral, except liked override is not needed. Likes رز and اسطوخودوس are included first. Floral slug ordering fills the remaining two: `iris` زنبق, then `jasmine` یاس.

**Result/layers:** top رز; heart اسطوخودوس and یاس (positions 0,1); base زنبق. Four unique actual catalog notes.

**Explanation:** «این نت‌ها با توجه به علاقه‌تان به خانوادهٔ گلی و حال‌وهوای آرام و لطیفی که انتخاب کردید پیشنهاد شده‌اند. رز و اسطوخودوس را هم که خودتان پسندیدید حفظ کردیم.»

**Payload validity:** yes after substituting the four API UUIDs; valid layer values and layer-local positions; no invented backend fields.

### Example 2 — تازه و پرانرژی

**Answers:** feeling `bright`; families `[fresh, citrus]`; temperature `bright`; scene `rainGarden`; liked `[]`; avoided `[]`; discovery `balanced`.

**Family scoring:** fresh `8 + 2 + 3 + 2 = 15`; citrus `8 + 2 + 2 = 12`; floral `1-2 = -1`; other known non-selected families `0-2 = -2`. Balanced allows all. Round-robin across fresh and citrus gives the first fresh note by slug (`green-tea` چای سبز), first citrus (`bergamot` ترنج), second fresh (`mint` نعناع), second citrus (`grapefruit` گریپ‌فروت).

**Result order/layers:** چای سبز (top, position 0), ترنج (heart, position 0), نعناع (base, position 0), گریپ‌فروت (heart, position 1). Four actual, unique notes.

**Explanation:** «با توجه به علاقه‌تان به خانواده‌های تازه و مرکباتی و حال‌وهوای روشن و باغ پس از باران، این نت‌ها برای تصور اولیه کنار هم قرار گرفته‌اند. این توصیف دربارهٔ یک مفهوم است، نه عملکرد عطر واقعی.»

**Payload validity:** yes with runtime API UUIDs and generated valid positions.

### Example 3 — گرم و چوبی

**Answers:** feeling `confident`; families `[woody, amber]`; temperature `warm`; scene `woodland`; liked `[سدر]`; avoided `[]`; discovery `familiar`.

**Family scoring:** woody `8 + 2 + 2 + 2 = 14`; amber `8 + 1 + 3 = 12`; fresh `1`; gourmand `1`; floral/citrus `0`. Familiar confines ordinary candidates to woody and amber. Liked سدر first. Round-robin takes the next woody slug `pine` کاج, then `amber` کهربا, then `incense` بخور.

**Result order/layers:** سدر (top, position 0), کاج (heart, position 0), کهربا (base, position 0), بخور (heart, position 1).

**Explanation:** «علاقه‌تان به خانواده‌های چوبی و کهربایی، همراه با حال‌وهوای استوار و گرم، در این پیشنهاد نقش داشته است. سدر را که خودتان انتخاب کردید حفظ کردیم.»

**Payload validity:** yes; these are real note records; layers express concept organization only.

### Example 4 — خانواده‌های متضاد/متفاوت

“Conflicting” is not treated as an error: selecting different worlds is a legitimate preference. **Answers:** feeling `bright`; families `[floral, woody]`; temperature `warm`; scene `quietFlowers`; liked `[]`; avoided `[]`; discovery `balanced`.

**Adjusted family scores:** floral `8 + 2 = 10`; woody `8 + 2 = 10`; amber `3 - 2 = 1`; fresh `2 - 2 = 0`; citrus `2 - 2 = 0`; gourmand `1 - 2 = -1`. The `+2` from bright feeling applies to fresh and citrus; warm temperature adds no bright-temperature points. Equal selected families use selection order, so floral precedes woody. Selected-family round-robin returns `iris` زنبق, `cedar` سدر, `jasmine` یاس, `pine` کاج.

**Result order/layers:** زنبق (top, position 0), سدر (heart, position 0), یاس (base, position 0), کاج (heart, position 1).

**Explanation:** «دو جهان گلی و چوبی را با هم انتخاب کردید؛ برای همین پیشنهاد، هر دو را در کنار حال‌وهوای گرم و تصویر آرام گل‌ها نگه می‌دارد.» Do not call the choices contradictory or incompatible.

**Payload validity:** yes after API UUID substitution; the engine asserts no physical compatibility. Although other catalog families have eligible notes, the four positions are filled from the two selected families, demonstrating that Balanced does not guarantee an outside-family note.

### Example 5 — نت‌های کنارگذاشته‌شده

**Answers:** feeling `intimate`; families `[gourmand, amber]`; temperature `warm`; scene `coffeePause`; liked `[کاکائو]`; avoided `[وانیل, قهوه]`; discovery `balanced`.

**Family scoring:** gourmand `8 + 2 + 1 + 2 = 13`; amber `8 + 1 + 3 + 1 = 13`; woody `2-2=0`; floral `1-2=-1`; fresh/citrus `-2`. The excluded `vanilla` and `coffee` are removed regardless of family score. Cocoa is explicit and included. Round-robin after it yields `amber` کهربا, `gourmand` (coffee excluded, so no second candidate in seed; gourmand exhausted), then next eligible family amber slug `incense` بخور. Fill fourth from next family by score: no other gourmand; amber next `saffron` زعفران.

**Result order/layers:** کاکائو (top, position 0), کهربا (heart, position 0), بخور (base, position 0), زعفران (heart, position 1). Neither وانیل nor قهوه appears.

**Explanation:** «نت‌های وانیل و قهوه را که ترجیح دادید کنار گذاشتیم؛ کاکائوی انتخابی شما حفظ شده و سایر پیشنهادها از خانواده‌های کهربایی و خوراکیِ انتخاب‌شده می‌آیند.»

**Payload validity:** yes; exclusions are not sent to Backend, only the resulting four real note IDs.

### Example 6 — کاتالوگ ناقص/کم‌نت

**Answers:** feeling `calm`; families `[floral]`; temperature `soft`; scene `quietFlowers`; liked `[]`; avoided `[]`; discovery `balanced`.

Assume the current API response has only two note records: رز linked to the returned floral UUID and سدر linked to a family UUID absent from the current family response. This is a hypothetical **response shape**, not a claim about current seed or fabricated UUIDs. Adjusted scores: floral `13`; fresh `2 - 2 = 0`; woody `1 - 2 = -1`; unresolved-family note remains neutral `0` (balanced does not adjust an unresolved family). Only two eligible records exist, so result returns two notes, ordered رز then سدر; no padding. If note API returned zero, result would be no-match instead.

**Result/layers:** top رز; heart سدر; base empty. UI says the catalog currently has only two available candidates and labels سدر «خانواده مشخص نشده».

**Explanation:** «از نت‌های فعلی، رز با علاقهٔ شما به خانوادهٔ گلی و حال‌وهوای آرام هم‌راستاست. اطلاعات خانوادهٔ نت دوم در کاتالوگ در دسترس نبود؛ می‌توانید پیشنهاد را ویرایش کنید.»

**Payload validity:** yes if both records' actual UUIDs are present and layer-local positions are 0. It is a partial concept, not a full four-note result. If any record disappears before save and Backend returns 422, report failure and let the visitor refresh/edit; do not claim saved.

### Example 7 — تفاوت آشنا، متعادل و اکتشافی با ورودی یکسان

This comparison uses the same six answers and the full seeded catalog for each mode. **Answers:** feeling `calm`; families `[floral]`; temperature `soft`; scene `quietFlowers`; liked `[]`; avoided `[رز, یاس, اسطوخودوس]`; only `discovery` changes between the three runs.

**Scores:** floral `8 + 2 + 1 + 2 = 13`; fresh `1 + 1 = 2`; woody `1`; citrus/amber/gourmand `0` before discovery adjustment.

- **Familiar:** only floral notes are ordinary candidates. The three non-avoided floral notes in slug order are زنبق (`iris`), شکوفه پرتقال (`orange-blossom`), بنفشه (`violet`). Target is three because these are the only eligible notes in familiar scope. Result order/layers: top زنبق; heart شکوفه پرتقال; base بنفشه. No outside-family note is included.
- **Balanced:** adjusted scores are floral `13`, fresh `0`, woody `-1`, and citrus/amber/gourmand `-2`. The three selected-family notes fill first; because only three remain in that family after exclusions, fallback adds چای سبز (`green-tea`) from the highest-ranked non-selected known family (fresh). Result order/layers: top زنبق; heart شکوفه پرتقال and چای سبز; base بنفشه. This includes an outside family because selected candidates were insufficient, not because balanced promises it.
- **Exploratory:** adjusted scores are floral `13`, fresh `4`, woody `3`, citrus/amber/gourmand `2`. No outside-family liked note exists, so the reserved position goes to the highest-ranked eligible known outside family: چای سبز (`green-tea`) from fresh. Remaining positions fill from selected floral family in slug order: زنبق, شکوفه پرتقال, بنفشه. Result order/layers: top چای سبز; heart زنبق and بنفشه; base شکوفه پرتقال.

**Explanation provenance:** all modes can mention the chosen floral family and calm/quiet-flower preferences, and note that رز، یاس، اسطوخودوس were excluded as requested. Balanced may say the fourth note came from the available catalog after the selected family had only three eligible notes; it must not promise exploration. Exploratory can say «برای کمی کشف بیشتر، نتی از خانوادهٔ تازه هم در پیشنهاد آمده است.» All named notes are actual seed records. Familiar's three-note payload uses top position 0, heart position 0, base position 0. Balanced/exploratory four-note payloads use the displayed layer sequence with layer-local positions heart 0 and 1. No UUID is supplied by this example.

## 8. Determinism and test vectors

The same validated answers and same API snapshot must produce byte-for-byte equivalent ordered `{noteId, layer, position}` selections and explanation clauses. No randomization, timestamp, locale-dependent sorting, remote service, or iteration-order tie break. Normalize slugs/UUIDs for comparison, preserve family tap order explicitly, and use code-point-stable slug/UUID tie breaks. Unit tests should assert all worked examples against records with symbolic test IDs, plus these invariants:

- Exploratory reserves one eligible resolved-family note outside chosen family IDs when a target slot is available; an already included liked note from a known outside family satisfies the rule.
- Exploratory never chooses an avoided note, even when it is the top outside-family candidate. Explicit likes remain in their input order and are never displaced by the reservation.
- Familiar includes any valid explicitly liked catalog note, including one with an unresolved family, but otherwise limits ordinary candidates to selected families.
- Balanced has no reservation or guarantee; Example 4 verifies that it can return only selected families even when other catalog families have eligible notes. Example 7 verifies its fallback to a non-selected family when selected-family candidates are insufficient.
- Example 4 adjusted scores equal floral 10, woody 10, amber 1, fresh 0, citrus 0, gourmand -1.
- Unknown/unresolved `family_id` values receive no inferred family properties and never satisfy exploratory expansion. Verify null-family notes form the first unresolved bucket, unknown non-null UUID buckets sort next by literal UUID, notes sort by slug then UUID, and API array permutations do not change these results.
- No-match is a separate result state, has no Save action, and cannot produce a fake successful concept.
- Save body contains only actual catalog note UUIDs, valid layers, and unique nonnegative layer-local positions.
- A second invocation with identical answers and catalog returns identical ordered selections and explanation clauses, regardless of API array ordering.

