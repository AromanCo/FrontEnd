# M1-E.2 Smart Perfumer Experience Specification

Status: proposed product specification. Advisory behavior described here is not implemented and is not scientific or production validation.

## Goals and guardrails

Smart Perfumer should extend the current Guided and Creative Studios with optional, transparent help. The customer owns the concept. The system may suggest a direction; it must not silently change, reject, score, or label a subjective composition as bad. A creative concept, an advisory candidate, and an approved physical production configuration are separate records and experiences.

### User goals

- Freely explore real catalog notes and conceptual layers.
- Understand optional suggestions in ordinary Persian.
- See why a suggestion was offered and where its guidance comes from.
- Accept, reject, undo, or ask for another direction without losing the original.
- Distinguish “interesting to explore” from “currently approved for physical production.”

### Non-goals

- Predict the actual smell of an untested formula.
- Invent note compatibility, ingredient concentration, safety, allergens, longevity, projection, or manufacturability.
- Generate a purchasable product from a concept.
- Use an opaque AI score or alter customer selections without consent.

## Experience flow

### 1. Creative exploration

User enters from Guided result or Creative Studio. Existing composition and concept name remain unchanged. Advisor entry is optional and clearly separate from existing Save/Studio controls. Existing concept data remains conceptual.

### 2. Choose guidance intent

The advisor can offer a small set of intents only when its reviewed rule package supports them. Proposed intent examples: «نرم‌تر»، «روشن‌تر»، «گلی‌تر»، «چوبی‌تر»، or «غافلگیرکننده‌تر». These are customer-selected creative directions, not measured scent properties. If intent support is absent or data coverage is inadequate, the UI explains that no reviewed suggestion is available.

### 3. Suggestion card

Every suggestion includes:

- A descriptive title framed as an invitation.
- Explicit before/after composition changes, using real note UUIDs from current catalog data.
- A short Persian rationale tied to the selected intent and actual rule inputs.
- Provenance: advisory ruleset ID/version and review date/owner reference suitable for customer-facing disclosure.
- Coverage limitation if a relevant family/note/rule is absent or unresolved.
- Actions: accept as a separate version, request an alternative, decline/close.

No numerical “harmony/compatibility” percentage, scientific confidence, or safety badge is shown. A later model, if separately approved, still may not override these constraints.

### Confidence and coverage language

For the initial rules-based proposal, prefer a qualitative coverage statement such as «این پیشنهاد بر اساس بخشی از نت‌های شناخته‌شدهٔ این ترکیب است.» Do not call this a confidence score. If a future reviewed method proposes confidence/coverage metadata, define its meaning, calibration/evidence, missing-data behavior, and user-facing interpretation before exposing it. Never convert rule coverage into a claim that the real-world perfume will smell as intended.

### 4. Improve My Blend

«بهبود» is a user request for suggestions. The advisor may propose a maximum small number of distinct directions, not a single canonical answer. Candidates may add, remove, replace, or conceptually move notes only when a reviewed rule explicitly permits that transformation. Each changed item is listed. An empty result is valid and should say the system has no reviewed idea for this combination. Never add an invented catalog note.

Every candidate must also satisfy the existing fragrance-concept payload contract before it can expose an Apply action: stay within the configured note maximum (currently six), use unique actual catalog note IDs, assign only `top`, `heart`, or `base`, and use nonnegative, unique positions within each layer. Do not silently truncate a composition or remove customer selections to make a candidate fit. If a proposed delta cannot produce a valid concept, suppress it or explain the limitation; never present a broken candidate with an enabled Apply action. This is conceptual payload validity only and says nothing about physical production eligibility.

### 5. Compare and apply

Present Original and Suggested as separate labeled versions. Difference indicators identify added, removed, or moved notes without relying on color alone. The user can inspect the notes/layers, accept, decline, request another direction, or undo to the prior active version. Applying creates a child version/copy and records the source concept/version and advisor recommendation ID; the original remains available and unchanged.

### 6. Production eligibility

Only a distinct «بررسی گزینه‌های تولید» action queries the approved production catalog. Advisory suggestions do not set eligibility. The response may be:

- `available`: one or more current, approved configuration choices match the submitted option choices; show configuration name/version, allowed choices, and current availability/quote data returned by the server.
- `unavailable`: no approved configuration matches; preserve the creative concept and explain that it remains an exploration.
- `needs_review`: a human/partner review is required; do not imply availability or quote.
- `stale`: approval/configuration changed; ask to refresh and reconfirm.
- `service_unavailable`: preserve all work; allow retry.

Before any future order, customer reviews the exact approved configuration, version, price/currency, quantity, fulfillment terms and production confirmation. That confirmation is separate from accepting an advisory suggestion.

## Interaction states

| State | Behavior |
|---|---|
| No advisor rules | Existing Studio remains fully usable; show a calm “guidance unavailable” explanation and no fake suggestions. |
| Loading advice | Preserve the concept; announce loading once; retry only through the real advisor source. |
| Suggestions ready | Show rationale, provenance, limitations, and explicit actions. No selection is pre-applied. |
| Suggestion accepted | Create a separate candidate version; announce that the original is preserved. |
| Suggestion rejected | Dismiss only that suggestion; preserve current composition. |
| Alternative requested | Return another eligible candidate deterministically or explain no alternative is available. Never repeat a candidate as “new.” |
| Undo | Restore the exact prior active version; do not destroy the candidate/history. |
| Guidance data missing/contradictory | Suppress affected recommendation; explain limited coverage; log a safe diagnostic without customer-sensitive content. |
| Production unavailable | Show no-availability message and keep concept editable/saveable. Do not change concept state. |
| Production option approved and available | Show exact version and options; require explicit review/confirmation before quote or order. |
| Approval withdrawn / option stale | Stop quote/order; retain concept and explain the option needs refresh or is no longer available. |
| Network/server error | Keep work in memory; show retry and clear status; never announce saved/approved success without response. |

## Persian copy proposals

Use concise, respectful copy. Product/qualified reviewer should approve terminology before implementation.

| Context | Suggested text |
|---|---|
| Advisor intro | «دوست دارید چند مسیر تازه را برای این ترکیب ببینید؟» |
| Optionality | «این‌ها فقط پیشنهادهایی برای کاوش‌اند؛ انتخاب نهایی با شماست.» |
| Creative feedback | «این ترکیب، حال‌وهوایی جسورانه و متفاوت را دنبال می‌کند.» |
| Alternative | «می‌توانیم یک مسیر نرم‌تر و گلی را هم بررسی کنیم.» |
| Rationale | «این پیشنهاد بر اساس جهتِ انتخابی شما و قواعدِ بازبینی‌شدهٔ این نسخه ارائه شده است.» |
| Limited coverage | «برای بخشی از این ترکیب هنوز راهنمای بررسی‌شده‌ای نداریم.» |
| No guidance | «برای این ترکیب پیشنهادِ بررسی‌شده‌ای در دسترس نیست؛ کاوش شما ادامه دارد.» |
| Unusual choice | «این انتخاب مسیری کمتر آشنا می‌سازد. اگر مایل باشید، راه‌های دیگری را هم امتحان می‌کنیم.» |
| Confirm accepting | «نسخهٔ پیشنهادی جداگانه ساخته شود؟ مفهوم اصلی شما حفظ می‌شود.» |
| Accepted | «نسخهٔ پیشنهادی ساخته شد؛ مفهوم اصلی همچنان محفوظ است.» |
| Rejected | «ترکیب فعلی شما بدون تغییر باقی ماند.» |
| Undo | «به نسخهٔ پیشین برگشتید.» |
| Not producible | «این مفهوم فعلاً گزینهٔ تأییدشده‌ای برای تولید فیزیکی ندارد.» |
| Production choices | «این گزینه‌ها در پیکربندی‌های تأییدشدهٔ فعلی قرار دارند.» |
| Approval changed | «وضعیت این گزینه تغییر کرده است. پیش از ادامه، گزینه‌های موجود را دوباره بررسی کنید.» |
| Customer confirmation | «جزئیات این گزینه را بررسی کردم و برای ادامه تأیید می‌کنم.» |

Do not claim that a proposal necessarily smells a certain way. Use “برای کاوش”، “جهت”، and “پیشنهاد” rather than “درست/غلط”، “سازگار قطعی”، or “عطر ایده‌آل”.

## Data and rule requirements

- All selected notes resolve to actual current catalog records. An absent record is omitted with an honest limitation; never fabricate.
- A recommendation is generated from a versioned, reviewed rule package. It records rule-set identifier/version, inputs actually used, candidate changes, provenance reference, and limitation codes.
- Rule packages declare supported catalog version/IDs/slugs, scope, reviewer, effective interval, and explicit exclusions. Unknown, conflicting, expired, or incomplete rules fail closed for the affected suggestion.
- Any deterministic rule output must be stable for the same concept snapshot, request intent, catalog snapshot, and rule version.
- Suggestions do not contain inferred scientific properties unless separately sourced and reviewed; no such properties are available in current M1 data.
- Keep privacy minimal. Do not send preferences to third-party analytics or an external AI service in this specification.

## Accessibility and responsive requirements

- Persian RTL, semantic headings/landmarks and fieldset/legend for choice groups.
- Suggestions use buttons with explicit accessible names; acceptance is never a color-only selection.
- Announce new suggestion/accepted/undo/error status without excessive live-region chatter. Keep focus stable unless an explicit dialog is opened.
- Dialogs require focus entry, containment, Escape/cancel behavior and focus restoration.
- At 320/390/768/1440 CSS px, original and proposed versions remain understandable without forced side-by-side columns on narrow screens. Use a sequential comparison on mobile.
- Keyboard operation, 44px-class targets where practical, visible focus, reduced motion and no horizontal overflow.

## M1-E.2 acceptance criteria for a future implementation milestone

1. Existing Guided and Creative composition works without advisor data or service.
2. Suggestions are optional, display actual note records, and never alter the active composition before explicit acceptance.
3. Original composition remains recoverable after accepting, rejecting, requesting another direction, editing, restarting, and network failure.
4. Accepting creates a distinct version linked to the source; repeated action is idempotent within that user action and does not duplicate hidden changes.
5. Every candidate respects the configured note maximum (currently six), unique actual catalog IDs, valid layers, and nonnegative unique layer-local positions; no selection is silently truncated or removed.
6. Invalid candidate deltas are suppressed or shown as unavailable with Apply disabled; they cannot be serialized as a valid concept.
7. Every shown rationale identifies the relevant rule provenance and is supported by input actually used; missing rule coverage is disclosed.
8. Identical snapshots/rule versions/intent produce deterministic outputs; no unsupported numerical compatibility score appears.
9. Invalid, expired, contradictory, unknown, or withdrawn rule/config data cannot produce production approval or quote.
10. Production availability is obtained only from approved configuration service/data; Studio note selection alone cannot mark eligibility.
11. No quote/order can proceed without explicit review and customer confirmation of the exact approved version and server-provided terms.
12. Keyboard, screen-reader, RTL, responsive, reduced-motion, loading, empty and error states meet the accessibility test plan.

## Test strategy

### Domain/unit tests

- Same concept/rule snapshot produces byte-stable ordered suggestions; changing rule version changes provenance and only changes results when rules differ.
- Suggestion inputs preserve the original; accept creates a separate version; reject is non-mutating; undo restores the exact previous snapshot.
- Missing note, unsupported family, no applicable rule, contradictory rule, expired rule, and incomplete coverage return limitation states rather than fabricated advice.
- Candidate deltas at the configured note limit, duplicate or unknown note IDs, invalid layers, negative/duplicate layer-local positions, and attempts to silently drop customer selections are rejected or suppressed; invalid candidates never have an enabled Apply action.
- Applying a valid candidate creates a concept-contract-valid child version and does not imply production eligibility.
- Every explanation clause maps to a recorded rule and actual input. No unsupported safety/performance claims or invented note IDs.
- Unapproved, withdrawn, expired, unknown-version, and synthetic-only production configurations never yield production eligibility.
- A creative concept may be valid/saveable when no production configuration matches.

### Component/integration tests

- Advisory panel is optional and does not block Studio editing.
- Accept/reject/alternative/undo preserve original and active-version identity.
- Apply is disabled for concept-contract-invalid candidates; note limits, unique IDs, real catalog identity, layer/position constraints, and preservation of customer selections are covered by tests.
- Production eligibility and advisory results remain separate state and error boundaries.
- API outage, stale data, auth expiry, unavailable service and retry preserve user work and never announce false approval/save.
- Persian copy, accessible labels, focus, touch targets, RTL order and no overflow at 320, 390, 768 and 1440.

### Browser/partner verification

- Real catalog-backed exploration is distinct from mocked advisor results.
- Synthetic rule/configuration fixtures are named and visually/test-data marked as synthetic; they must never be represented as production approved.
- Partner-approved configuration integration requires a controlled staging environment, audit logs, version/withdrawal tests, and a documented confirmation journey.
- Production order tests are separate from creative/advisory tests and require actual provider/operations evidence. No public SMS or payment bypass.
