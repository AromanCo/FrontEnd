# M1-E.1 Implementation Roadmap

Status: proposed sequence for product-owner review. No milestone below is approved or implemented by this document.

## Recommended order

The order starts with market and supply decisions because they determine authentication, currency, tax, delivery, product data and provider eligibility. Work can proceed in parallel only where dependencies are explicit. A first transaction should remain blocked until the product and operational evidence exists.

| Milestone | Goal and prerequisites | Frontend work | Backend work | Acceptance evidence | Exclusions |
|---|---|---|---|---|---|
| **M2-0: Commercial decisions and source verification** | Owner approves initial market, legal entity, launch model, product/supplier path, currency, guest checkout stance, delivery/returns owner, claims/safety reviewer, and payment/SMS provider evaluation criteria. | Keep current demo disclosures; no commerce UI activation. Prepare UX requirements only after decisions. | Inventory existing schema and DB migration state; document catalog/data ownership and legacy cutover plan. No migration before approved records mapping and backup rehearsal. | Signed decision record with named owners, real product evidence, provider eligibility checks, delivery/return process outline, and jurisdiction-specific review plan. | Any sale, prices/stock fabrication, personalized physical production assumption. |
| **M2-A: Production authentication readiness** | Market and delivery channel selected; eligible SMS provider and operational owner available. | Integrate only through existing auth provider/client; verify login, expiry, retry, logout, focus/error states across supported browsers. | Build provider adapter, secret/config handling, delivery callback if supported, abuse controls and safe observability; retain current cookie/CSRF unless a demonstrated gap requires change. | Real staging SMS delivery and failure monitoring; rate/attempt/resend tests; no OTP leakage; HttpOnly/Secure/SameSite/CORS/CSRF tests; browser login/session-expiry/logout in real provider environment; isolated contract tests. | Fake public OTP, hardcoded code, JWT/localStorage rewrite, SMS provider selection without owner approval. |
| **M2-B: Verified product catalog and inventory foundation** | M2-0 product/supplier records, SKU authority, media rights, currency and stock source established. | Replace demo-only storefront data deliberately; show approved media/alt text, variant choices, accurate price/currency and availability status; retain honesty for non-saleable concepts. | Proposed product/variant publication data, media/provenance approval, price history/effective pricing, inventory movements/balances/locations; admin ingestion process and migration/backfill after backup. Exclude demos from buyable API. | Every purchasable SKU reconciles to source supplier, approved copy/media, active server price/currency and stock; API contract tests and pagination; price/stock role protections and audit; legacy mapping approved. | Checkout/payment, fake stock/price, concept-to-product conversion, full PIM/warehouse platform. |
| **M2-C: Cart and checkout quote/reservation** | M2-B saleable catalog; approved shipping/tax/fee and guest/auth identity decisions; payment provider technical eligibility known. | Cart editing, authoritative quote display, address forms, shipping choice, expiry/error recovery, accessible RTL checkout; no client-trusted totals. | Cart identity; quote calculation; address validation; shipping options; atomic stock reservation, expiration and idempotent order creation; server totals and snapshots. | Concurrent checkout cannot oversell; changed/expired price/quote is re-confirmed; repeated idempotency key does not duplicate order; ownership/guest scoping, CSRF, validation, address privacy, expiry release tests. | Payment capture, refunds, broad coupons/loyalty, subscription or custom fragrance orders. |
| **M2-D: Payment, order operations and fulfillment** | M2-C stable; provider approved and sandbox/live credentials available; real fulfillment and support workflows operational. | Payment handoff/status recovery, order confirmation/history, cancellation/refund status and accessible failure messaging. | Payment attempt/intent, signed idempotent webhooks, reconciliation, order state machine, fulfillment/shipping updates, cancellations/refunds, audit/admin access, outbox/jobs. | Provider sandbox and controlled live low-value end-to-end order; webhook duplicate/replay/bad signature tests; callback/redirect disagreement test; amount/currency verification; payment timeout reconciliation; stock release/refund tests; fulfillment dry run. | Storing card details, trust of browser success redirect, unapproved providers or sale claims. |
| **M2-E: Operational QA and launch readiness** | M2-A to D accepted and operational owners trained; jurisdiction-specific policies reviewed. | Final copy, real images, policies, accessibility and browser regression; production configuration with no secrets in bundles. | Security hardening, least privilege, monitoring/alerts, backup restore, migration/rollback plan, incident and support runbooks, retention and audit review. | Release gates below; cross-browser and screen-reader sign-off; load/security testing; restore rehearsal; support/refund/return tabletop; verified real order, delivery and refund in approved scope. | Expanding geography, personalized production or scale infrastructure without evidence. |

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
| **3. Closed beta ready** | Real verified catalog and prices, controlled users/geography, auth delivery, support/fulfillment process, privacy notice and jurisdiction review, monitored rollback | Restricted non-public trial only under owner approval; real payments only if Gate 4 is met |
| **4. Real transaction ready** | Provider onboarding/settlement approved, tested price/tax/receipt and stock reservation, delivery/returns/customer support ready, signed webhook and idempotency verification, qualified product labeling/safety review, end-to-end order/payment/refund/fulfillment evidence | Limited real customer transactions within the approved product and geography |
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

- Approve launch country/jurisdiction, legal entity, currency, initial commercial model and product range.
- Verify suppliers, SKU identities, real product content/media rights, price authority and inventory source.
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
