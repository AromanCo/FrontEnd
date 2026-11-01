# M1-E.2 Controlled Personalization Architecture

Status: proposed future architecture. All entities, rules, statuses, and endpoints in this document are proposals. No formula, supplier, manufacturing capability, safety assessment, or production approval exists in the current system.

## Existing foundation and boundaries

The current FastAPI/PostgreSQL backend has `FragranceConcept` and `ConceptNote`. A concept belongs to a user and stores a name plus real note UUID, conceptual layer (`top`, `heart`, `base`) and position. Current concept APIs provide authenticated create/read/full-replacement update/duplicate/delete with cookie session and CSRF. The six-note limit is a configurable UI/product constraint. These records do not include formulation amounts or production validation.

Keep three domains separate:

1. **Creative concept** — customer's editable creative record and optionally versioned child concepts.
2. **Advisory** — optional recommendation request/result tied to a concept snapshot and reviewed ruleset; it can propose changes but never approves production.
3. **Production configuration** — an independently authored and approved set of physical product options that can be checked for current eligibility and quoted. It is not derived implicitly from a concept or advisory result.

The Signature Collection uses verified finished product/variant catalog records. Controlled Personalization may reference approved configuration options. Fully bespoke can later use a separate human-reviewed brief/work order flow. Shared identity/order primitives are possible; validation and status transitions must remain distinct.

## Proposed production-domain model

Use immutable versions for any customer-visible or operationally referenced configuration. Mutable administrative drafts should not be eligible for customer quotes.

| Proposed entity | Role |
|---|---|
| `ProductionProgram` | Identifies an approved product line/method and responsible production partner or internal owner. Contains lifecycle state and operational scope, not customer concept data. |
| `ApprovedBaseVersion` | Partner-defined base identity, version, document reference, status, effective dates, reviewer/approver references, and change history. No real base or composition is specified here. |
| `ApprovedAccordVersion` | Approved option identity/version and controlled metadata/reference. Actual accords, contents, proportions, and claims must come from qualified reviewed source documents. |
| `PermittedCombinationRule` | Versioned constraint over approved bases/accords/options and permitted choice ranges. Each rule includes provenance, applicability, reviewer/approver, effective dates, and withdrawal status. It is not a scientific compatibility score. |
| `ConfigurationVersion` | Immutable customer-selectable specification assembled only from approved option IDs and allowed quantity/proportion values. References the exact rule set and production spec version used. No free-form Studio note UUIDs. |
| `ProductionSpecificationReference` | Opaque versioned reference to the controlled partner/manufacturer document, revision, hash or signed identifier, effective period, and access classification. Do not expose confidential supplier documents publicly. |
| `ProductionApproval` | Approval/review records: authority, scope, decision, date, evidence references, expiry, and revocation/suspension. Approval is explicit, attributable and auditable. |
| `ProductionAvailability` | Current partner, geography, capacity/availability and constraints for a configuration version. Time-bound; not implied by approval alone. |
| `ConfigurationQuote` | Server-generated, expiring quote bound to exact configuration version, selected allowed options, currency, price/tax/shipping policy, quantity/capacity and terms snapshot. |
| `CustomerProductionConfirmation` | Explicit customer acceptance of a particular quote/configuration version and customer-facing terms before order creation. Records accepted version and timestamp. |
| `ConfigurationAuditEvent` | Append-only actor/action/reason/version and approval/withdrawal history. Prevents silent rewriting of production eligibility. |

Avoid storing unneeded chemical or personal data. Actual technical attributes should be added only when a qualified partner supplies a defined schema and a reviewer authorizes its use.

## Advisory architecture is not production logic

An optional `AdvisoryRuleSet` / immutable `AdvisoryRuleVersion` may use reviewed editorial guidance, product research, or future approved signals. A `RecommendationRun` records the concept snapshot/version, user intent, catalog snapshot, rule version, suggestion deltas, rationale provenance and limitations. Rules are versioned and deterministic for an identical input snapshot. The result carries no production approval fields.

Do not reuse `PermittedCombinationRule` to produce creative “harmony” rankings. Production rules are constraints against an approved manufacturing specification; advisory rules are optional suggestions. Their owners, review evidence, data schemas, APIs, authorization, and test suites remain distinct.

## Proposed API boundaries

Names are illustrative; no endpoint currently exists.

### Creative concepts

- Preserve existing `/api/v1/fragrance-concepts` contract for M1 compatibility.
- If immutable comparison/history becomes necessary, propose `/api/v2/studio/concepts/{id}/versions` or a separately scoped version endpoint. It should snapshot the source concept and parent version without changing old concept rows in place. Approval is required before changing the existing full-replacement semantics.

### Advisory

- `POST /api/v1/advisory/suggestions`: submit a concept snapshot/reference plus selected intent; return suggestion IDs, explicit deltas, rationale clause IDs, ruleset version/provenance, coverage limits, and expiry if relevant.
- `GET /api/v1/advisory/suggestions/{id}`: retrieve an owned/user-authorized result if persistence is approved. Prefer ephemeral processing if retention is unnecessary.
- Accept/reject should initially be a frontend/version action or explicit event that creates a new concept version. It must not mutate the source concept in place. Do not send questionnaire answers unrelated to the request.

### Production configuration and eligibility

- `GET /api/v1/personalization/options`: list only currently published options and approved option descriptions appropriate for customer display.
- `POST /api/v1/personalization/eligibility`: send selected approved option IDs and values, not free-form note IDs. Server checks active approval, configuration version, constraints, market and operational availability. Return `available`, `unavailable`, `needs_review`, or `stale`, with exact config version and limitations.
- `POST /api/v1/personalization/quotes`: create an expiring server quote only for `available` configuration and current capacity/price. Bind quote to version, options, currency, quantity and terms.
- `POST /api/v1/orders` (commerce proposal from M1-E.1): accept only an unexpired quote and explicit confirmation; persist order-time snapshots. Revalidate before order creation.
- Protected partner/admin APIs for configuration drafts, approval, publication, suspension/revocation and audit are separate from public/customer APIs. Use least privilege and dual review for high-impact changes as product/security owners decide.

Do not expose supplier-sensitive formulation documents or confidential production attributes through public APIs.

## Versioning, history and approval lifecycle

- Configuration versions are immutable after publication. A change creates a new version and references its predecessor; never edit a quoted/ordered version in place.
- Each published version identifies the exact base/accord/option versions, constraints, external production-spec reference, approval record, applicability, market and effective period.
- `draft -> in_review -> approved -> published -> suspended/withdrawn/expired` is a proposed state lifecycle. `approved` alone is insufficient for sale: published status, effective interval, market applicability and live availability must also pass.
- Withdrawal or expiry blocks new eligibility checks and quotes immediately. Existing quotes follow explicit expiration/reconfirmation policy; orders already accepted preserve their exact snapshots and enter a human operational review if the partner cannot fulfill.
- Approval revocation is append-only with actor, reason, timestamp and reference. Do not erase historical approvals or claim a historical configuration remains currently approved.
- Customer concept versions preserve original note selections and advisory provenance. Later rules/catalog changes do not rewrite the original concept or recommendation run.
- Quote and order snapshots retain the exact configuration version and customer-confirmed options. A later configuration change cannot silently alter an accepted order.
- Define retention and access for partner references, customer concepts, quotes and orders with privacy/legal/operations owners.

## Eligibility and quote invariants

1. Studio note IDs alone can never satisfy production eligibility.
2. Advisory acceptance alone can never set production eligibility.
3. Every selected production option resolves to an active approved version and allowed range/value.
4. The complete option combination satisfies the exact current rule/configuration version; unknown, missing, conflicting, expired, suspended or withdrawn data fails closed.
5. Geography, partner, capacity, minimum/maximum constraints and fulfillment availability are checked server-side at eligibility and again at quote/order time.
6. Prices and terms come from server-authoritative records. No client-computed total becomes a quote.
7. Customer confirms the exact configuration version and quote before production/order. Any version/price/availability change requires a new review and confirmation.
8. Production approval is not a legal, safety, allergen, or efficacy guarantee; customer-facing claims must state only what qualified reviewers authorize.

## Historical stability and audit

Keep immutable snapshots or foreign-key references to immutable versions for advisory runs, eligibility checks, quotes and orders. Maintain append-only approval and status events. Use database constraints to prevent duplicate version numbers per program, invalid active ranges, and duplicate approval/action records. Changes should be transactional and emit auditable actor/time/reason metadata. Restrict sensitive supplier references by role. Reconcile any asynchronously synchronized partner availability and show last-verified times where appropriate.

Before schema work, review the current single initial Alembic revision and supported database state. Plan forward migrations, backups, restoration rehearsal, data mapping and role grants. Do not assume legacy Go product tables can be adopted without explicit mapping.

## Future fully bespoke extension

Do not build bespoke tables or intake UI now. If approved later, add a separate `BespokeBrief` and `HumanReviewCase` (proposed) that hold the customer brief, consent, assigned qualified perfumer, clarification and review states, quote approval, and eventual production-spec reference. Keep the brief distinct from the Studio concept and from controlled configuration. A human-approved bespoke specification may later reference the same generic production partner, quote, order, audit, and fulfillment primitives, but must have its own review/approval lifecycle and change control. It must not bypass safety, labeling, privacy, pricing, or customer confirmation gates.

This boundary permits more than one personalization method without implementing a speculative workflow or assuming every custom product uses one blend method.

## Required architecture tests

- A concept containing any real or unusual note combination remains a valid creative record even if it has no production configuration.
- No API can convert a concept directly to a producible/quoteable object based only on note IDs.
- Advisory rule version and rationale are preserved; changing rule versions cannot mutate prior runs or customer concepts.
- Only synthetic, explicitly marked test configurations are used in tests; synthetic fixture responses never claim real approval.
- Draft, unapproved, expired, suspended, withdrawn, unknown, and contradictory configurations cannot return `available` or produce a quote/order.
- Concurrent approval/withdrawal and eligibility/quote operations have deterministic transaction semantics; a withdrawal prevents new quotes.
- Accepted quotes and orders retain exact version, options, price/currency, terms and customer confirmation snapshots.
- Historical concepts/quotes/orders remain interpretable after a production-rule update or product retirement.
- Authorization prevents customers from reading partner specifications or another customer's concepts, quote, or order.
- API and UI distinguish unavailable production, stale approval, missing advisory coverage, and service errors without losing the creative draft.
