# M1-E.1 Proposed Commerce Architecture

Status: architecture proposal only. Every commerce entity, endpoint, field, workflow, and migration below is new and requires product, operational, and security review. No commerce capability is present in the current system.

## Current system and boundary

The frontend is Next.js 16 App Router with Server Components for public storefront reads and focused Client Components for interactive Studio and account behavior. `src/lib/api/client.ts` centralizes FastAPI transport and generated OpenAPI types. Browser requests use credentialed CORS; authenticated writes use the existing HttpOnly session and in-memory CSRF flow.

The Backend is a FastAPI modular monolith with PostgreSQL, SQLAlchemy 2, and Alembic. Its current relational models include users, OTP challenges/sessions, brands, fragrance families/notes, products, product variants, and private fragrance concepts. Products currently carry name/description/brand/family/demo status; variants carry SKU, label, volume, and demo status. Neither model has price, currency, image, or stock. Existing catalog endpoints are public reads. The only private customer records are authentication and fragrance concepts.

There is one initial Alembic foundation revision. The Backend documents that it targets a fresh database; the older Go product-service files and schema are retained as reference and have incompatible identifiers/fields. Any legacy data cutover requires a separately reviewed mapping, backup, and migration plan. Do not attach or reinterpret an old volume as commerce data.

## Domain boundary

Commerce catalog records describe verified physical goods and their sale conditions. `FragranceConcept` and its note selections describe a user's conceptual composition. A saved concept must never become a product, variant, formula, stock unit, or order line implicitly. A future personalized product would require an explicit production capability, reviewed product specification, safety/labeling process, and separate customer consent.

M1-E.2 owner direction adds two intended product lines: AROMAN-branded finished Signature Collection products and Controlled Personalization. The latter must not make a raw Studio note list orderable. It requires a separate approved production-configuration model described in [M1E2_PERSONALIZATION_ARCHITECTURE.md](M1E2_PERSONALIZATION_ARCHITECTURE.md). The M1-E.1 ready-made-first suggestion is historical and superseded as product direction by approved B+C; whether B may launch before C remains undecided. All commerce schemas and endpoints here remain proposals.

## Proposed entities and relationships

The schema should be introduced incrementally after product decisions; names below are illustrative.

| Proposed entity | Purpose and key constraints |
|---|---|
| `Product` / localized product content | Stable product identity, publication state, brand, approved descriptions and claims; demo content remains excluded from purchasable feeds. Keep public copy and internal provenance/review metadata distinct. |
| `ProductVariant` | A sellable SKU with stable UUID, unique SKU, product relation, option/size attributes, and active state. A product is purchasable only through an active variant. |
| `ProductMedia` | Asset URL/key, alt text, locale, ordering, rights/provenance, approval and visibility. Prefer owned media storage/CDN; never assume a remote placeholder is licensed product photography. |
| `Price` or `VariantPrice` | Server-owned amount in integer minor units plus ISO currency, tax-inclusion policy and effective interval. Enforce one unambiguous active price per variant/currency/time. Do not use floating point. |
| `InventoryLocation`, `InventoryBalance`, `InventoryMovement` | Location-specific on-hand/available quantities and append-only reasoned adjustments. The balance is a concurrency-controlled projection; movements provide audit evidence. |
| `StockReservation` | Variant quantity reserved for a quote/order with expiry and state. Unique/transaction constraints prevent overselling under concurrent checkout. |
| `Cart` / `CartItem` | User- or guest-scoped mutable selection. Store variant IDs and quantities; any shown price is an informational snapshot and is revalidated on checkout. A guest identifier must be opaque, random, HttpOnly and scoped; never trust a client-supplied owner ID. |
| `Address` and order address snapshot | Optional saved address with customer access controls; checkout stores an immutable order-time recipient/delivery snapshot to preserve what was submitted. Collect only needed fields. |
| `ShippingMethod` / `ShippingQuote` | Server-calculated available service, fee/currency, delivery estimate and expiry. Persist the exact accepted quote on the order; do not trust client shipping totals. |
| `Order` / `OrderItem` | Server-generated order number, owner or guest scope, currency, immutable product/SKU/name/price/tax/discount/shipping snapshots, totals, address snapshot, status and idempotency key. Order items must survive later catalog edits/deactivation. |
| `PaymentAttempt` / `PaymentEvent` | Provider reference, amount/currency, state, request idempotency key, verified callback/event ID and redacted diagnostic metadata. Unique provider event IDs make callback application idempotent. Never store PAN, CVV, OTP or provider secret. |
| `Refund` / `ReturnRequest` | Separate workflow for cancellation, return authorization, received goods, partial/full refund, reason and operator action. A refund is not equivalent to changing an order total. |
| `AuditEvent` | Actor, action, target, timestamp, correlation ID, reason and minimal before/after metadata for sensitive catalog, price, stock, order and refund operations. Exclude secrets and unnecessary personal data. |

Use foreign keys, check constraints, unique keys, explicit monetary currency, timestamps in UTC, and carefully defined deletion/retention policies. Product/variant deactivation should not delete order snapshots or payment history.

### Proposed typed commercial item identity

Future carts, checkout quotes, and order items may reference exactly one of two explicitly discriminated item kinds:

- **Signature Collection (B):** a verified, published product variant/SKU, referenced by its stable variant ID and SKU snapshot.
- **Controlled Personalization (C):** a separately approved, immutable `ConfigurationVersion` ID plus only its permitted customer-selected option IDs/values and exact version snapshot.

Use a server-enforced discriminator and typed reference, not ambiguous nullable IDs. At cart, quote, and order creation, the server must resolve and validate the referenced item type, publication/approval state, market, options, price, and current stock or production capacity. Reserve physical stock for B and the approved capacity/resource for C using transactionally safe reservation. Persist immutable order-time identity, selected options, version, price/currency, terms, and fulfillment snapshots. Later catalog edits or configuration changes must not rewrite an existing order.

A raw Studio note selection, saved concept, or advisory suggestion is never a valid cart item, quote line, order item, or production configuration. C requires a separately approved configuration and explicit customer selection/confirmation; no implicit note-to-product conversion is permitted.

## Proposed API shape

Existing `GET /api/v1/products`, product variant reads, and generated schemas remain the current contract. The following are proposals, not implemented endpoints. Favor a small API in the existing FastAPI monolith until operational scale justifies service separation.

### Public catalog

- Extend published product/variant responses only after approved content, media, currency and price semantics exist. Expose purchasability explicitly; never infer it from `is_demo` alone.
- Add product detail by stable product ID/slug if needed, with only approved localized copy/media and purchasable active variants.
- Return a server-authoritative price and availability summary, but treat availability as advisory until checkout reservation succeeds.

### Cart and checkout

- `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/{id}`, `DELETE /api/v1/cart/items/{id}`: customer- or secure guest-scoped cart. Validate variant visibility and quantity server-side.
- `POST /api/v1/checkout/quotes`: accept cart identity and address/shipping inputs; server reloads products, prices, tax/shipping rules and availability, returns an expiring quote ID and total breakdown.
- `POST /api/v1/orders`: accept quote ID, explicit customer/guest contact and an idempotency key; atomically validate quote, reserve stock, and create `pending_payment` order. Repeating the same key returns the same logical order, never duplicates it.
- `POST /api/v1/orders/{id}/payment-attempts`: authenticated/guest-authorized server call creates a provider intent using server-held credentials. Return only the provider's safe client token/redirect instructions, if its model requires them.
- `GET /api/v1/orders`, `GET /api/v1/orders/{id}`: return only orders scoped to the authenticated customer or securely authorized guest.
- Provider webhook endpoint: provider-specific server route verifies signature over raw body, timestamp/replay rules and event identity. It records the event before applying idempotent state transitions. A browser redirect is not proof of payment.

### Operations/admin

Propose separately protected administrative catalog, price, inventory, fulfillment, cancellation, and refund actions. Use explicit least-privilege roles, step-up controls for sensitive actions where justified, audit events, and a distinct operator workflow. Do not expose write privileges through the current public catalog role or customer API.

## State transitions (proposed)

Order lifecycle should be explicit and validated server-side:

```text
pending_payment -> paid -> processing -> shipped -> delivered
       |              |          |
       +-> expired    +-> canceled (only under approved policy)
       +-> canceled

paid / delivered -> return_requested -> return_authorized -> returned
                                      -> refund_pending -> partially_refunded / refunded
```

This is illustrative; product/operations owners must decide which states and transitions fit the chosen provider and fulfillment model. Payment state should be distinct from order/fulfillment state. Failed, abandoned, expired, disputed, and provider-unknown payment attempts need explicit handling. Only verified provider events or reconciled server-side provider status may establish paid/refunded status. Disallowed transitions return conflict and are recorded for investigation.

## Transaction, inventory, and payment consistency

1. Reprice and revalidate every line at quote and order creation. The browser's amount, tax, discount, shipping fee and availability are never authoritative.
2. In one PostgreSQL transaction, lock or conditionally decrement inventory, create expiring reservations, and create the pending order with immutable snapshots. Use a deterministic lock order across variant IDs to reduce deadlocks. On any failure, roll back all changes.
3. Call the external payment provider outside a long-running database transaction. Persist a payment attempt and idempotency key before/around the call; use an outbox/retry strategy if reliable delivery of side effects is required. Make retries safe against timeouts where provider outcome is unknown.
4. Verify webhook signatures, timestamp/replay window, provider account, amount, currency, and reference. Store each provider event under a unique constraint and apply it once in a database transaction. Reconcile ambiguous payment states through provider APIs/jobs; do not mark paid from a return URL.
5. Expire reservations and unpaid orders through an idempotent worker/job. Release stock exactly once. Handle late success callbacks through a defined compensate/refund/manual-review policy.
6. Record the price, product identity, SKU, tax basis, shipping quote, and total as order-time snapshots. Later price or catalog edits must not rewrite a placed order.
7. Use decimal-safe integer minor units and explicit currency; define rounding, tax, and discount order before implementation.

## Authentication and identity

Reuse the existing HttpOnly session cookie and CSRF protection for authenticated cart, address, and order mutations. Keep the session server-owned; never move session or CSRF values to localStorage, URL, logs, or analytics. Enforce ownership on every request and return non-disclosing not-found behavior for another customer's resources.

Guest checkout is an unresolved business decision. If required, use a high-entropy, short-lived, revocable opaque guest credential in an HttpOnly/Secure/SameSite cookie, store only its digest, bind it to a cart/order scope, rotate it appropriately, and provide a separate recovery/verification process. Never authorize order access using a predictable order number or email/mobile alone. Avoid merging guest and account orders without verified identity and explicit rules.

Production OTP prerequisites: select a provider eligible in the target market; manage credentials outside source and browser bundles; validate delivery callbacks; preserve generic anti-enumeration responses; apply per-number, IP, device/risk and global rate limits, cooldowns, attempt limits and resend limits; normalize numbers; monitor provider acceptance, delivery failures, cost spikes, abuse, latency and 503/429 rates; alert and document provider outage recovery. A 202 means accepted, not delivered. Do not expose fake SMS codes or add a public bypass. Verify actual delivery and browser login in a protected staging environment, in addition to isolated TestClient tests.

## Privacy, security, operations

- Keep payment credentials, webhook secrets, SMS credentials and database credentials server-side in a managed secret store; rotate and scope them.
- Prefer provider-hosted payment entry/tokenization to prevent card data entering AROMAN systems. Never log sensitive payment data.
- Validate inputs, quantity limits, quote expiry, ownership, CSRF, origin/CORS, webhook signatures and provider response consistency.
- Use secure headers, TLS, trusted proxy configuration, narrow DB roles, rate limits, request size limits, dependency and image scanning, and tested backup/restore.
- Minimize personal data: collect only delivery/contact data needed to fulfill an order. Define retention, deletion/legal hold, export, support access and incident response with jurisdiction-specific review.
- Keep order, payment, auth, and admin logs useful but redacted. Add correlation IDs without logging secrets or full addresses/mobile numbers.
- Monitor checkout conversion/error boundaries, stock reservation conflicts, webhook lag/replay, payment reconciliation, SMS delivery, refunds and operational queue age. Establish alert ownership and on-call procedures before launch.
- Never claim legal compliance from architecture alone; obtain jurisdiction-specific legal, tax, payment and qualified product safety/labeling review.
