# M1-E.1 Product and Commercial Decisions

Status: product direction updated by owner decisions in M1-E.2. This direction does not approve a launch, supplier, formulation, inventory, provider, or regulatory claim.

## Current product position

AROMAN is a Persian-first fragrance discovery and personalization experience. The approved product direction includes **B: AROMAN Signature Collection**, finished perfumes branded by AROMAN, and **C: AROMAN Controlled Personalization**, a future controlled customization offer. Customers should have room to experiment and receive guidance that suggests potentially more harmonious directions without judging or overriding their choices. Fully bespoke, individually formulated perfume remains a possible later expansion.

The current application still provides only a demonstration storefront and conceptual Studio experiences. Its catalog is not a saleable inventory feed. Seeded products, variants, brands, notes, and families are demonstration records. There are no verified prices, stock, suppliers, production configurations, or order/payment behaviors. Studio concepts do not describe validated formulas or manufacturing instructions.

The current Backend uses FastAPI, PostgreSQL, SQLAlchemy, and Alembic. It has public catalog reads, SMS OTP session authentication, and authenticated concept CRUD. The SMS provider is unconfigured. No commercial catalog or fulfillment API exists.

## M1-E.1 commercial model alternatives (historical labels)

The letters below were labels for alternative business models in M1-E.1. They are **not** the same labels as the now-approved product lines B and C.

| Model | What the customer buys | Benefits | Dependencies and risks |
|---|---|---|---|
| Verified ready-made products | Existing, physically available products with confirmed supplier, product identity, price, and fulfillment | Product, price, and inventory can be verified independently of Studio concepts | Supplier and stock evidence, rights, pricing, delivery/returns, payment eligibility, customer support, jurisdiction-specific review |
| Personalized physical product | A physical product produced from a customer's preferences or concept | Personalization story | No production capability, validated formula, safety review, labeling process, supplier agreement, lead time, or return policy is evidenced. Studio notes are not manufacturing specifications. |
| Phased launch | Verified finished products first, then a limited personalization offer after production/review gates | Separates a known product from future personalization | Requires strict concept/production boundaries, explicit approval, and validated production capability |

## Earlier M1-E.1 recommendation and M1-E.2 update

M1-E.1 recommended verified ready-made products as a possible first transaction, with personalization deferred. The owner has now approved B+C as product direction: AROMAN Signature Collection and AROMAN Controlled Personalization are intended product lines. This supersedes the earlier product-direction recommendation; it does **not** remove the need to verify actual products, suppliers, manufacturing capability, approved configurations, pricing, inventory, or qualified safety/labeling review before either line is sold.

The approved initial market is Iran. This is a business direction, not a finding of legal compliance or provider eligibility. No currency, legal entity, supplier, finished product, controlled formulation set, manufacturer, stock, fulfillment capability, payment provider, SMS provider, or local regulatory approval has been verified. If those dependencies are not met, keep transaction capability off and preserve honest conceptual exploration.

## Established requirements versus proposed decisions

### Established by the current product and code

- Persian-first RTL experience and Iranian mobile-number handling.
- Session cookie is HttpOnly; protected writes use an in-memory CSRF token.
- SMS delivery is unavailable in the current public configuration and returns an honest 503.
- Product and variant records are demonstration data; no price or stock is exposed.
- Studio recommendations use real catalog note IDs but remain conceptual. They do not establish safety, compatibility, formula validity, physical scent behavior, or availability.
- No cart, order, payment, refund, or fulfillment service is implemented.

### Approved product-owner direction

- Initial intended commercial market: Iran; jurisdiction-specific legal and operational review remains required.
- Intended product line B: AROMAN Signature Collection of AROMAN-branded finished perfumes.
- Intended product line C: AROMAN Controlled Personalization.
- Customers should experiment freely and receive optional, understandable suggestions; unusual choices should not automatically be rejected.
- Fully bespoke perfume is a possible future expansion, not a current capability.

### Proposed implementation principles, not yet a launch decision

- Keep Studio concepts freely saveable as creative work, distinct from advice and physical production configurations.
- Offer production eligibility only for an explicitly approved, versioned configuration and current operational availability.
- Keep an original concept intact when creating an improved alternative; applying advice is an explicit customer action and creates a separate version/copy.
- A verified Signature Collection may be a practical first transaction, but the owner has not approved a launch sequence or demonstrated supply readiness.

### Decisions requiring product-owner approval

| Priority | Decision | Recommended default for planning | What approval unlocks |
|---|---|---|---|
| P0 | Iran market scope, legal entity, and applicable sale jurisdictions | Treat Iran as intended market; obtain qualified local legal, tax, and payment review before transactions | Defines provider eligibility, currency/tax, consumer policies, privacy, and claims review |
| P0 | Sequence and launch scope for product lines B and C | Plan B as verified finished products and C as approved options; decide whether B can launch before C is ready | Separates catalog readiness from manufacturing-control readiness |
| P0 | Real products, suppliers, production capacity, and product-claims authority | No sale until each SKU or personalization configuration has documented source and owner approval | Catalog verification, SKU, production, and fulfillment planning |
| P0 | Controlled Personalization configurations and qualified approval owner | No combinations are production-eligible until an accountable qualified partner defines and approves them | Determines option set, evidence, production interface, and withdrawal process |
| P0 | Product safety, labeling, and manufacturing review owner | Qualified, named external or internal responsible party; no engineering self-certification | Review process and evidence requirements; not a claim of compliance |
| P0 | Delivery model, coverage, fees, service levels, failed delivery and returns | Select geography and an operationally supportable carrier/fulfillment approach before checkout | Address, shipping quote, order lifecycle, support and return design |
| P0 | Payment provider and settlement eligibility | Select only after jurisdiction, legal entity, currency, and settlement eligibility are confirmed | Provider integration and verified test/live transaction plan |
| P1 | Sales currency and price authority | Choose a single launch currency and a server-side price owner | Price model, display formatting, accounting and order snapshots |
| P1 | Guest checkout | Decide after Iran-market conversion, identity, delivery, and privacy requirements are reviewed | Customer identity, guest order lookup, recovery and privacy design |
| P1 | SMS provider | Compare eligible providers after market choice; no provider is selected | Production authentication and real browser verification |
| P1 | Tax, invoicing and receipt requirements | Obtain jurisdiction-specific accounting/legal advice before orders are enabled | Order fields, document lifecycle and reporting |
| P1 | Return, refund, cancellation, damaged goods and personalized-goods policy | Approve plain-language policies with operations/legal input before checkout | Customer UX and service operations |
| P2 | Customer support ownership, hours, and escalation path | Name an accountable team before closed beta | Incident and order support procedures |
| P2 | Catalog and inventory operators | Define who may publish, price, adjust stock, and reverse an adjustment | Admin roles, audit records, and release access controls |

These defaults are planning recommendations, not decisions already made by AROMAN.

## Dependencies and unanswered questions

- Which legal entity sells, receives funds, issues invoices, and handles consumer complaints?
- Which Signature Collection products and variants can actually be supplied, in what quantities, and with what provenance and labeling evidence?
- For Controlled Personalization, which approved bases/options exist, who validated them, and which manufacturer can produce them consistently?
- Who owns accurate prices and inventory, and how quickly can changes reach the server?
- Which delivery areas, carrier/service, address formats, fees, delivery promises, and lost/damaged parcel procedures are supportable?
- Which providers can lawfully onboard the business and settle the chosen currency in the chosen market?
- Can an SMS provider serve the target market with delivery telemetry and abuse controls?
- Is guest checkout a conversion requirement? How will a guest safely retrieve an order without an account?
- Who approves imagery rights, product descriptions, claims, safety/labeling, production-configuration versions, and withdrawal decisions?
- What data retention, deletion, analytics, and support access policies are appropriate for mobile numbers, addresses, and order records?

Until these are answered, the application should remain explicit that the catalog is illustrative and transactions are unavailable.
