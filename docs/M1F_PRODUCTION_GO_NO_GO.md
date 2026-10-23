# M1-F Production Readiness and Go/No-Go Matrix

Status: readiness template only. All B and C gates below are **Not verified**. No product line or stage has been approved or reached.

Use this matrix only with linked, dated evidence and named reviewers. Complete B and C independently. A gate may be “verified” only for the exact product/SKU or configuration version, market, site, and scope stated by its evidence. A candidate or received document is not approval.

## Status vocabulary

- **Not verified:** required evidence has not been established for this scope.
- **In review:** evidence is linked and a named reviewer is assessing it; it is not approval.
- **Blocked:** a required dependency is unavailable, contradictory, expired, or unresolved.
- **Verified for scope:** evidence and qualified review support only the exact recorded scope. This status alone does not authorize the next stage.
- **Approved:** the named decision authority recorded a dated decision and conditions for the specific line/scope.
- **Rejected/withdrawn:** the scope cannot advance or a prior approval is no longer current; preserve history and prevent new eligibility/quotes as applicable.

## Readiness stages

| Stage | Minimum meaning | Status for B | Status for C |
|---|---|---|---|
| 1. Research candidate | A real, identifiable organization/capability has an attributable source and open questions. This is not qualification. | **Not reached** | **Not reached** |
| 2. Feasibility supported by evidence | Relevant documents and checks support a bounded feasibility conclusion; gaps and dependencies are explicit. No customer sale is implied. | **Not reached** | **Not reached** |
| 3. Approved for internal prototyping | Product owner and required qualified reviewers authorize a controlled internal sample/prototype scope, with written criteria, handling, and stop conditions. | **Not reached** | **Not reached** |
| 4. Approved for pilot planning | Product-specific evidence and operational plan support a limited pilot proposal; separate pilot authorization is recorded. Not commercial release. | **Not reached** | **Not reached** |
| 5. Commercial release eligible | All line-specific, market-specific, legal/professional, commercial, fulfillment, support, security, and release gates pass; product owner records explicit release scope. | **Not reached** | **Not reached** |

No stage has been reached based on existing documentation. “Eligible” is a release decision only after all applicable approvals and current operational checks; it is not a claim of universal legal compliance.

## Independent product-line gates

| Gate | B — Signature Collection | C — Controlled Personalization | Evidence / accountable review | Initial status |
|---|---|---|---|---|
| Qualified manufacturer identified | Identify and qualify a partner for each specific finished SKU and site. | Identify a partner with evidence for the proposed controlled method and configuration system. | Attributable entity/site evidence; sourcing lead and qualified reviewer. | B: **Not verified**; C: **Not verified** |
| Product/configuration identity and ownership | Exact product, variant/SKU, brand and product/document rights established. | Exact method, approved option/configuration version, rule owner, rights and manufacturer reference established. | Contracts, versioned records, rights review; product owner and IP counsel. | B: **Not verified**; C: **Not verified** |
| Sample/prototype validation | Product-specific sample identity, written criteria, review record, and approval authority. | Sample tied to exact configuration version and permitted choices; repeatability/review criteria recorded. | Sample chain, criteria, reviewer/sign-off; qualified quality/product reviewer. | B: **Not verified**; C: **Not verified** |
| Manufacturing and quality documentation | Current scope-appropriate process, quality, batch/traceability, deviation, defect, and change records. | Controlled configuration-to-production traceability, quality controls, batch repeatability, and rule/change history. | Authenticated records, scope/date, independent review; manufacturer and qualified quality reviewer. | B: **Not verified**; C: **Not verified** |
| Qualified Iran-local regulatory/legal review | Classification, product/site/sale scope, entity and applicable approval questions reviewed for specific SKUs. | Same categories reviewed independently for the proposed customization method and options. | Current official primary sources and written qualified local advice; legal/regulatory professional. | B: **Not verified**; C: **Not verified** |
| Safety, ingredient, claims and labeling review | Product-specific review ownership, evidence, claims substantiation, label content and approval documented. | Review covers the controlled method/options and every customer-facing claim/label variation; no approval inferred from a Studio note. | Qualified review records and versioned approved content; responsible safety/label reviewer. | B: **Not verified**; C: **Not verified** |
| Supply and capacity | SKU-level source, quantity, capacity, replenishment and discontinuation evidence. | Option/configuration-specific capacity, batch/per-order limits, availability source and continuity evidence. | Dated written capacity/supply terms and change notifications; sourcing and operations owners. | B: **Not verified**; C: **Not verified** |
| Packaging and fulfillment | Product packaging rights/components, storage, delivery, damage and returns supportable. | Packaging/fulfillment validated for each allowed output and change/withdrawal process. | Written package specification, sourcing, handling, fulfillment tests; operations owner. | B: **Not verified**; C: **Not verified** |
| Pricing and commercial terms | Dated SKU costs/terms, price authority, currency, quote validity and applicable commercial conditions. | Dated configuration/option cost model and quote inputs; price bound to exact approved version and capacity. | Written commercial quote/contract, finance and product-owner approval. | B: **Not verified**; C: **Not verified** |
| Operational owner | Named owner for catalog publication, stock, quality incidents, replenishment and customer issue escalation. | Named owner for configuration publication, availability, rule version, review, suspension and withdrawal. | Approved RACI/runbooks and access rights; product and operations owners. | B: **Not verified**; C: **Not verified** |
| Customer support, returns and defects | Customer-facing support, defects, damage, returns/refunds, complaints, and discontinuation policy ready. | Separate handling for personalized orders, unavailable/withdrawn options, defects, returns and recovery; professional review where needed. | Approved policies, escalation and rehearsal evidence; operations/support/legal. | B: **Not verified**; C: **Not verified** |
| Product-line-specific approval | Explicit approval for exact SKU(s), market, channel, claims, price, and release scope. | Explicit approval for exact configuration versions/options, market, capacity, quote and release scope. | Dated decision record with conditions and approvers; product owner and required qualified roles. | B: **Not verified**; C: **Not verified** |
| Revocation/withdrawal | Process to stop sale of discontinued, unsafe, unavailable, or unapproved SKU/claims and handle existing stock/orders. | Immediate block for withdrawn rule/option/configuration; quote/order transition and historical-version treatment documented. | Testable status/notification process, responsible owner, audit record and operational rehearsal. | B: **Not verified**; C: **Not verified** |

## Cross-line release controls

These controls do not replace product-line gates.

| Control | Initial status | Required evidence |
|---|---|---|
| Product owner has decided launch sequence and scope | **Not verified / decision open** | Written decision: B before C, together, C before B, or neither; explicit exclusions and intended channel/geography. |
| Legal entity and Iran-market scope | **Not verified** | Qualified local review of the intended seller, product classification, activity, territory, and applicable legal/consumer questions. |
| Currency, tax, invoicing, and payment eligibility | **Not verified** | Owner decisions and current provider/accounting/legal evidence; no assumed currency or provider. |
| Privacy, support, security, monitoring, and recovery | **Not verified** | Release-specific privacy/security review, incident and support owners, logs/retention, backup/recovery tests. |
| Customer-facing boundary | **Not verified** | Clear distinction between conceptual Studio work, advisory suggestions, and exact approved physical product/configuration; no false availability/quality/safety claims. |
| Actual end-to-end operational rehearsal | **Not verified** | For the approved scope: source/price/capacity check, order or pilot handling, delivery/support/return/withdrawal rehearsal, and product-owner sign-off. |

## Decision record

Complete one per line and scope. Do not copy approval from B to C or C to B.

| Decision field | B record | C record |
|---|---|---|
| Exact product/SKU or configuration/version and market | Not identified | Not identified |
| Evidence register references and dates | None | None |
| Blockers and conditions | Not assessed | Not assessed |
| Qualified reviewer(s) and scope | Not assigned | Not assigned |
| Product-owner decision / date | **No approval recorded** | **No approval recorded** |
| Permitted next stage | None | None |
| Expiry, review date, or withdrawal trigger | Not defined | Not defined |

## Iran-specific verification boundary

Do not mark legal or regulatory gates verified from general web content, supplier marketing, or this template. For the exact product line and activity, identify the responsible official authorities and current primary documents with qualified Iran-local legal/regulatory professionals. Topics to investigate include product classification, applicable manufacturing/product approvals, required quality/manufacturing documentation, ingredient and safety review, labeling and consumer disclosures, import/local sourcing, trademark/branding rights, seller/entity requirements, tax/invoicing, consumer protection, payment/settlement, storage, distribution, and logistics. This document does not state which specific rule applies or claim compliance.

## No-go conditions

Keep the relevant line unavailable and do not enable production/purchase interfaces if identity, evidence, scope, authority, safety/labeling review, supply/capacity, price/terms, customer policy, or operational ownership is missing, stale, contradictory, withdrawn, or unverifiable. Raw Studio notes and Smart Perfumer suggestions never satisfy a production gate. A negative or blocked C decision does not invalidate the customer's creative concept; a B approval does not authorize C.
