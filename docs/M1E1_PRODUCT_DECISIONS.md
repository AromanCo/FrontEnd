# M1-E.1 Product and Commercial Decisions

Status: planning proposal. Nothing in this document approves a launch model, supplier, price, provider, or regulatory claim.

## Current product position

AROMAN is a Persian-first fragrance discovery and personalization experience. The current application provides a demonstration storefront and two conceptual Studio experiences. Its catalog is not a saleable inventory feed. The seeded products, variants, brands, notes, and families are explicitly marked as demonstration records. The frontend has no real price, stock, cart persistence, checkout, order, or payment behavior. Studio concepts are private creative records; they do not describe validated formulas or production instructions.

The current Backend uses FastAPI, PostgreSQL, SQLAlchemy, and Alembic. It has public catalog reads, SMS OTP session authentication, and authenticated concept CRUD. The SMS provider is unconfigured. No commercial catalog or fulfillment API exists.

## Commercial model options

| Model | What the customer buys | Benefits | Dependencies and risks |
|---|---|---|---|
| A. Verified ready-made products | Existing, physically available products with confirmed supplier, product identity, price, and fulfillment | Smallest path to a truthful transaction; product, price, and inventory can be verified independently of Studio concepts | Supplier and stock evidence, product photography/rights, reliable pricing, delivery and return operations, payment eligibility, customer support, and jurisdiction-specific review |
| B. Made-to-order personalized perfume | A physical product produced from a customer's preferences or concept | Strong personalization story | No production capability, validated formula, safety review, labeling process, supplier agreement, lead-time or return policy is evidenced. Creative Studio notes are not manufacturing specifications. High operational and product-claim risk |
| C. Phased combination | Launch verified ready-made products first; later run a limited personalized pilot only after production and review gates | Establishes commerce with known goods while allowing personalization research without implying that current concepts are orderable | Requires a strict product boundary, explicit owner approval, and a separate validated production workflow before personalized orders |

## Recommended initial approach (not an approved decision)

Prefer **Model A**, limited to a small set of verified ready-made products, as the first real customer transaction. Consider Model C as a later sequence: keep Guided and Creative Studio conceptual at launch, then evaluate a separately scoped personalization pilot only after a qualified supplier or in-house production process, safety and labeling review, and customer-facing claims are approved.

This recommendation minimizes assumptions. It does not imply that AROMAN currently has a supplier, actual products, sellable stock, a payment provider, or permission to sell in a particular market. If no verified ready-made supply is available, the correct outcome is to delay transaction launch while completing discovery and readiness work, rather than presenting demo records as purchasable.

## Established requirements versus proposed decisions

### Established by the current product and code

- Persian-first RTL experience and Iranian mobile-number handling.
- Session cookie is HttpOnly; protected writes use an in-memory CSRF token.
- SMS delivery is unavailable in the current public configuration and returns an honest 503.
- Product and variant records are demonstration data; no price or stock is exposed.
- Studio recommendations use real catalog note IDs but remain conceptual. They do not establish safety, compatibility, formula validity, physical scent behavior, or availability.
- No cart, order, payment, refund, or fulfillment service is implemented.

### Decisions requiring product-owner approval

| Priority | Decision | Recommended default for planning | What approval unlocks |
|---|---|---|---|
| P0 | Initial countries and legal jurisdiction(s) | Choose one launch market before committing payment, tax, privacy, delivery, or claims work | Jurisdiction-specific counsel and provider eligibility assessment |
| P0 | Is physical personalized perfume actually available? Who produces it? | No personalized physical sales in the first launch unless capability and validation are documented | Determines whether personalization is a later research pilot or a separate production stream |
| P0 | Real products, suppliers, and authority for product claims | Begin only with a short verified ready-made range and named supplier/product owner | Catalog verification, SKU, imagery rights, and fulfillment planning |
| P0 | Product safety, labeling, and manufacturing review owner | Qualified, named external or internal responsible party; no engineering self-certification | Review process and evidence requirements; not a claim of compliance |
| P0 | Delivery model, coverage, fees, service levels, failed delivery and returns | Select geography and an operationally supportable carrier/fulfillment approach before checkout | Address, shipping quote, order lifecycle, support and return design |
| P0 | Payment provider and settlement eligibility | Select only after jurisdiction, legal entity, currency, and settlement eligibility are confirmed | Provider integration and verified test/live transaction plan |
| P1 | Sales currency and price authority | Choose a single launch currency and a server-side price owner | Price model, display formatting, accounting and order snapshots |
| P1 | Guest checkout | Defer unless research shows it is needed; support authenticated purchase first only if that is commercially acceptable | Customer identity, guest order lookup, recovery and privacy design |
| P1 | SMS provider | Compare eligible providers after market choice; no provider is selected | Production authentication and real browser verification |
| P1 | Tax, invoicing and receipt requirements | Obtain jurisdiction-specific accounting/legal advice before orders are enabled | Order fields, document lifecycle and reporting |
| P1 | Return, refund, cancellation, damaged goods and personalized-goods policy | Approve plain-language policies with operations/legal input before checkout | Customer UX and service operations |
| P2 | Customer support ownership, hours, and escalation path | Name an accountable team before closed beta | Incident and order support procedures |
| P2 | Catalog and inventory operators | Define who may publish, price, adjust stock, and reverse an adjustment | Admin roles, audit records, and release access controls |

These defaults are planning recommendations, not decisions already made by AROMAN.

## Dependencies and unanswered questions

- Which legal entity sells, receives funds, issues invoices, and handles consumer complaints?
- Which actual products and variants can be supplied, in what quantities, and with what provenance and labeling evidence?
- Who owns accurate prices and inventory, and how quickly can changes reach the server?
- Which delivery areas, carrier/service, address formats, fees, delivery promises, and lost/damaged parcel procedures are supportable?
- Which providers can lawfully onboard the business and settle the chosen currency in the chosen market?
- Can an SMS provider serve the target market with delivery telemetry and abuse controls?
- Is guest checkout a conversion requirement? How will a guest safely retrieve an order without an account?
- Who approves imagery rights, product descriptions, claims, safety/labeling, and future physical personalization?
- What data retention, deletion, analytics, and support access policies are appropriate for mobile numbers, addresses, and order records?

Until these are answered, the application should remain explicit that the catalog is illustrative and transactions are unavailable.
