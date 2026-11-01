# M1-E.1 Implementation Roadmap

Status: proposed sequence updated for the owner-approved B+C direction. No supplier, production capability, launch sequence, or milestone implementation is approved by this document.

## Recommended order

The order starts with market and supply decisions because they determine authentication, currency, tax, delivery, product data and provider eligibility. Work can proceed in parallel only where dependencies are explicit. A first transaction should remain blocked until the product and operational evidence exists.

For the Smart Perfumer and controlled-personalization product direction, see [M1E2_PRODUCT_DIRECTION.md](M1E2_PRODUCT_DIRECTION.md), [M1E2_SMART_PERFUMER_SPEC.md](M1E2_SMART_PERFUMER_SPEC.md), and [M1E2_PERSONALIZATION_ARCHITECTURE.md](M1E2_PERSONALIZATION_ARCHITECTURE.md). These documents specify future behavior; they do not claim that it exists or is production-approved.

| Milestone | Goal and prerequisites | Frontend work | Backend work | Acceptance evidence | Exclusions |
|---|---|---|---|---|---|
| **M2-0: Commercial decisions and source verification** | Iran is the intended market. Owner confirms legal entity, B/C sequence, real Signature products/suppliers, whether controlled configurations and production exist, currency, guest checkout, delivery/returns, qualified claims/safety owner, and provider evaluation. | Keep demo disclosures; do not activate commerce. Specify the boundary among exploration, advisory, and production eligibility. | Inventory schema and migration state; define data ownership and legacy cutover. No migration before approved product/configuration records, mapping, and backup rehearsal. | Decision record; real product/supplier evidence; for C, qualified approved-configuration evidence and accountable approver; provider eligibility checks; delivery/return plan; jurisdiction-specific review. | Selling B or C before its evidence exists; treating concepts as production specifications. |
| **M2-A: Production authentication readiness** | Market and delivery channel selected; eligible SMS provider and operational owner available. | Integrate only through existing auth provider/client; verify login, expiry, retry, logout, focus/error states across supported browsers. | Build provider adapter, secret/config handling, delivery callback if supported, abuse controls and safe observability; retain current cookie/CSRF unless a demonstrated gap requires change. | Real staging SMS delivery and failure monitoring; rate/attempt/resend tests; no OTP leakage; HttpOnly/Secure/SameSite/CORS/CSRF tests; browser login/session-expiry/logout in real provider environment; isolated contract tests. | Fake public OTP, hardcoded code, JWT/localStorage rewrite, SMS provider selection without owner approval. |
| **M2-B: Verified catalog and production-option foundation** | M2-0 has verified B products or documented C production options, SKU/configuration authority, media rights, currency and stock/capacity source. | Present Signature SKUs and, only if actually available, approved customization choices. Distinguish conceptual exploration from production eligibility. | Product/variant publication, price history, inventory; separately model versioned C configurations, approval, supplier references, permitted options, capacity/status, and audit. Exclude demos and unapproved options from purchasable APIs. | Every offered SKU/configuration resolves to evidence, accountable approvals, active price and capacity/stock; unapproved/revoked versions cannot be quoted; API, migration, audit, and authorization tests pass. | Formula generation, unrestricted note-to-order conversion, fake stock/price, full bespoke workflow. |
| **M2-C: Cart and checkout quote/reservation** | M2-B saleable B items and/or currently approved C configuration; approved shipping/tax/fees and identity decisions; provider eligibility known. | Cart/quote identifies the verified SKU or exact configuration version and options; customer reviews and confirms before order. | Quote binds immutable product/configuration version, selected approved options, price, stock/capacity, and policy snapshot. Reserve inventory or approved production capacity atomically and expire safely. | Cannot quote unapproved, withdrawn, stale, or unavailable configurations; customer confirms exact option/version/total; concurrency, expiry, idempotency, ownership, and recovery tests pass. | Arbitrary Studio composition checkout or generated formula purchase. |
| **M2-D: Payment, order operations and fulfillment** | M2-C stable; provider approved and sandbox/live credentials available; real fulfillment and support workflows operational. | Payment handoff/status recovery, order confirmation/history, cancellation/refund status and accessible failure messaging. | Payment attempt/intent, signed idempotent webhooks, reconciliation, order state machine, fulfillment/shipping updates, cancellations/refunds, audit/admin access, outbox/jobs. | Provider sandbox and controlled live low-value end-to-end order; webhook duplicate/replay/bad signature tests; callback/redirect disagreement test; amount/currency verification; payment timeout reconciliation; stock release/refund tests; fulfillment dry run. | Storing card details, trust of browser success redirect, unapproved providers or sale claims. |
| **M2-E: Operational QA and launch readiness** | M2-A to D accepted and operational owners trained; jurisdiction-specific policies reviewed. | Final copy, real images, policies, accessibility and browser regression; production configuration with no secrets in bundles. | Security hardening, least privilege, monitoring/alerts, backup restore, migration/rollback plan, incident and support runbooks, retention and audit review. | Release gates below; cross-browser and screen-reader sign-off; load/security testing; restore rehearsal; support/refund/return tabletop; verified real order, delivery and refund in the approved product-line scope. | Fully bespoke and unapproved production remain excluded. Controlled Personalization C is an approved direction, but its launch requires independently verified manufacturing, safety/labeling, supplier, capacity, pricing, and operational gates. Gate B and C separately: evidence for Signature Collection B does not establish C readiness, and C evidence does not establish B readiness. Whether B may launch commercially before C remains unresolved. |

## Repository workstreams

### FrontEnd

- Keep `src/lib/api/client.ts` the transport boundary and regenerate types only from an approved Backend OpenAPI contract.
- Replace demonstration catalog presentation only when the API supplies verified saleable state, price/currency and approved media. Avoid client-side price arithmetic as authority.
- Build cart/checkout state around server quote IDs and explicit expiry; do not treat browser cart values as order totals.
- Preserve existing cookie/CSRF architecture and Studio conceptual boundary.
- Add focused unit/component tests and real browser journeys for price changes, quote expiry, authentication expiration, validation, accessibility, and error recovery.

### Backend

- Keep FastAPI/PostgreSQL as the initial commerce system of record; do not activate the legacy Go product service without a separate architecture decision.
- Design Alembic migrations against the actual fresh-schema baseline and an explicit legacy/data backfill plan. Do not silently attach old volumes.
- Add database-enforced money, SKU, inventory, idempotency, ownership and payment-event constraints. Use transactions and background reconciliation/expiry jobs.
- Add protected administrative writes and audit trail before relying on a manually editable production catalog.
- Keep provider SDKs and secrets on the server; test webhook verification and retry behavior using provider sandbox fixtures.

## Shared quality requirements

- Contract tests tie frontend generated types to the reviewed OpenAPI export.
- Backend tests cover migration upgrade from the supported baseline, transaction rollback, authorization, CSRF, concurrency, idempotency, provider callbacks and privacy controls.
- Frontend component tests cover accessible cart, quote, checkout, order and failure states without implying a live payment.
- Browser tests separate real public API/catalog journeys, isolated auth/payment fixtures, provider sandbox, and real-money or live delivery tests. Label each evidence class accurately; no public OTP/payment bypass.
- Add stable request correlation and redaction tests. Validate no credentials or personal data leak into client storage, URLs, browser logs, analytics or screenshots.
- Preserve existing M1 tests and QA screenshots. New commerce screenshots belong in a separate milestone evidence directory.

## Release gates

| Gate | Required evidence | What it permits |
|---|---|---|
| **1. Technical development complete** | Code review, migration/API/unit/component tests, CI, threat review, error handling, no demo data exposed as purchasable | Internal code acceptance only; no customer transaction claim |
| **2. Internal demonstration ready** | Clearly labeled synthetic/demo catalog, isolated provider sandbox, no real checkout claims, verified resettable test records | Staff demonstration with no real money or fulfillment |
| **3. Closed beta ready** | Product-line-specific evidence: B needs verified finished SKUs, prices, stock, labeling and fulfillment; C independently needs verified manufacturing capability, approved immutable configurations, safety/labeling review, supplier, capacity, pricing and operational procedures. Also controlled users/geography, auth delivery, privacy/jurisdiction review, support and monitored rollback. | Restricted trial only for each individually approved line; real payments only if Gate 4 is met for that line |
| **4. Real transaction ready** | Provider onboarding/settlement approved and product-line-specific evidence. B requires verified finished SKU, price/tax/receipt, stock and delivery. C separately requires approved configuration/version, permitted options, manufacturing/capacity confirmation, qualified safety/labeling review, quote, customer confirmation and fulfillment. Both require return/support readiness, signed webhook/idempotency verification, and end-to-end order/payment/fulfillment evidence. | Limited transactions only for the line(s) that independently pass and are explicitly approved |
| **5. Production launch ready** | Gate 4 plus threat/security test, load/resilience, backup and restore, monitoring/on-call, incident/refund runbooks, privacy/data retention review, Firefox/WebKit/Safari and screen-reader verification, accessibility review, successful operational rehearsal and explicit owner go/no-go | Public launch only for approved scope |

These gates do not certify legal compliance. Legal, tax, consumer protection, product safety, labeling, privacy and payment obligations need qualified jurisdiction-specific review.

## M1-D follow-up items

M1-D acceptance evidence reports passing available Chromium/real-public-catalog journeys, with explicit boundaries. Before or alongside commerce work, track:

1. Real authenticated browser Save remains unverified because the public SMS provider returns 503; retain isolated Backend TestClient coverage and perform a real staging SMS/browser flow after M2-A provider setup.
2. Firefox, WebKit/Safari, and actual screen-reader sessions were not executed; complete before a customer-facing launch gate.
3. Existing accessibility checks are targeted regressions, not complete WCAG conformance. Continue keyboard, contrast, focus and screen-reader review as affected flows expand.
4. Do not treat demo products or their variants as price, stock, imagery, availability, supplier, or fulfillment evidence.
5. Existing Alembic migration is a fresh-foundation baseline; legacy product-table migration/cutover and recovery require explicit mapping and backup rehearsal.

Known non-features that are not defects in M1: cart persistence, prices, inventory, payment, checkout, orders, refunds, real SMS delivery, and physical manufacturing of Studio concepts.

## Prioritized backlog and blockers

### P0 — Owner and external decisions

- **Selected direction:** Iran is the intended initial market; B (AROMAN Signature Collection) and C (AROMAN Controlled Personalization) are approved product directions. This is not evidence of legal, supplier, or production readiness.
- Resolve seller/legal entity and applicable local review; decide whether B may launch before C (still open).
- Verify B suppliers, finished SKU identities, content/media rights, price authority, inventory and fulfillment. Independently verify C manufacturing partner/capability, approved configuration source, capacity, pricing, qualified safety/labeling review, and operations.
- Select sales currency and delivery/returns/support policies for the chosen launch scope.
- Define and staff the qualified review/approval process for Controlled Personalization options, configuration versions, availability, and withdrawal.
- Decide when a separate production eligibility check may be introduced; Studio exploration and advisory remain distinct from production approval.
- Name qualified product safety/labeling and legal/tax reviewers; decide fulfillment/delivery, returns and support operations.
- Confirm payment and SMS provider eligibility, settlement, credentials, sandbox/live process and service owners.

### P1 — Foundations after decisions

- Complete M2-A production auth and browser verification.
- Approve commerce schema, order/price snapshots, inventory concurrency, guest identity, audit, retention, migration and legacy-data plan.
- Implement M2-B catalog/price/inventory records and protected operator workflow.

### P2 — Transaction journey

- Implement M2-C server quote, cart, address/shipping decisions, reservations, idempotent pending orders.
- Implement M2-D provider payment lifecycle, fulfillment, cancellations, returns and refunds.
- Add operational dashboards, alerts, reconciliation, runbooks and restore/security exercises.

## External blockers and explicit exclusions

No milestone can truthfully enable real customer transactions until real products/suppliers and fulfillment exist, payment onboarding is approved, currency/tax/legal questions are answered, SMS/auth delivery is operational if account access requires it, and qualified product claims/labeling review is complete. Personalized physical perfume remains out of scope until production capability and validation are separately approved. No implementation should imply that recommendation scores make a product safe, available, compatible, or manufacturable.
