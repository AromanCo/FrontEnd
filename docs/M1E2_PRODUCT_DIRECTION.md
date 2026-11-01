# M1-E.2 Product Direction: Smart Perfumer

Status: records approved product direction and proposes experience/architecture for review. It does not establish current production capability or approve a commercial launch.

## Approved direction

- The intended initial market is Iran. This is not a legal-compliance determination.
- Product line **B — AROMAN Signature Collection** is a collection of AROMAN-branded finished perfumes.
- Product line **C — AROMAN Controlled Personalization** is an intended offer for customizing fragrances within future documented and approved production options.
- Customers should be able to experiment with combinations. AROMAN should offer helpful, understandable suggestions toward a requested direction rather than automatically rejecting unusual concepts.
- Fully bespoke, individually formulated perfume may be considered later.

These are product-owner decisions about direction. No supplier, production partner, actual finished product, formulation library, approved base/accord set, stock, price, payment provider, SMS provider, safety review, labeling review, or fulfillment capability has been verified. No customer purchase should be represented as available until the relevant evidence and release gates exist.

## Three product layers

| Layer | Customer meaning | May do | Must not imply |
|---|---|---|---|
| Creative concept | “This is the fragrance story I want to explore.” It includes the customer's selected real note records and conceptual top/heart/base arrangement. | Freely create, save, rename, compare, and edit unusual combinations. | A physical formula, real ingredient list, safety, compatibility, performance, stock, or orderability. |
| Advisory recommendation | “Here is an optional direction you could try, and why.” Future advice may use documented, versioned, expert-reviewed editorial/technical rules with stated scope and gaps. | Explain an optional suggestion, present an alternative, and let the user accept, reject, or undo it. | Scientific certainty, actual smell prediction, a validated compatibility score, safety approval, or automatic alteration of the user's concept. |
| Approved production configuration | “This exact version and option set can currently be quoted for production.” It is maintained and approved by accountable qualified production partners. | Offer only current permitted options, capacity, approved price quote, and an explicit confirmation flow. | That any Studio note UUID or advice result is a producible perfume. |

## Proposed experience

Smart Perfumer is a layer of optional guidance across the existing Guided and Creative Studios, not a replacement for either Studio and not an administrative formula builder.

1. **Explore:** The user starts in Creative Studio or completes Guided Studio and receives a conceptual result. Existing answers and composition remain the user's work.
2. **Ask for guidance:** An optional control such as «پیشنهادهایی برای ادامه» opens a compact advisor panel. The panel states whether it has relevant reviewed guidance. It does not block saving or editing the concept.
3. **Review options:** Each suggestion presents a concise proposed change, the direction it is intended to explore, why the rule suggests it, the rule-set version/source, and any scope limitation. The original remains visible.
4. **Choose:** The customer may accept, decline, request another direction, or close the advisor. Accepting creates a separate suggested version/draft. It never edits the original in place. Undo returns to the prior working version.
5. **Compare:** A side-by-side or sequential comparison shows selected notes/layers in the original and candidate, with changes explicitly highlighted. No match percentage or “better perfume” rating is shown.
6. **Check production options:** Only after Controlled Personalization has approved configurations does an explicit action check whether a current configuration corresponds to allowed choices. A creative concept can remain valid when no production option matches.
7. **Confirm:** If an approved option is available, show the exact configuration version, permitted selections, current operational availability, and server-generated quote when commerce exists. The user must confirm the physical product and price separately before an order can proceed.

### Improve My Blend

This is an optional request for ideas, not a command to modify or validate the blend. The advisor may return zero or a small set of alternatives only from its current reviewed rule set. Each candidate must have a specific rationale and source/version. The UI preserves the original and asks the user to apply a candidate. If guidance coverage is insufficient, say so and leave the composition unchanged.

## Product-line boundaries

### B — Signature Collection

Finished AROMAN-branded products should use the verified physical-product catalog, variant/SKU, approved media/copy, price, availability, fulfillment, and order model proposed in M1-E.1. It is a distinct catalog path. Smart Perfumer may help users explore preferences, but it must not claim that a Signature SKU is a match unless product mapping is explicitly reviewed and maintained.

### C — Controlled Personalization

Customization must be limited to versioned configurations, options, quantities/proportions, and combinations that a qualified production partner has documented and approved. It must show only options currently eligible for the chosen production route. Capability, constraints, availability, price and lead-time must come from authoritative approved services/data, not from Studio note data or advisory output.

### Future bespoke

Individually formulated perfume is a possible separate service. Do not model all current customization as bespoke. A later bespoke intake could capture a brief and route it to human perfumer review, with distinct scope, quote, approval, production, and change-control records. It should share customer identity and order primitives where appropriate, but not bypass controlled-configuration approval.

## Persian interface copy proposals

Copy is proposed, subject to product and Persian UX review:

| Situation | Copy |
|---|---|
| Neutral creative feedback | «این ترکیب، حال‌وهوایی جسورانه و متفاوت را دنبال می‌کند.» |
| Optional suggestion | «اگر بخواهید، می‌توانیم یک مسیر نرم‌تر و گلی را هم بررسی کنیم.» |
| Explain a possible direction | «این پیشنهاد برای نزدیک‌شدن به حال‌وهوای روشن‌تر ارائه شده؛ انتخاب با شماست.» |
| Alternative direction | «دوست دارید یک مسیر تازه‌تر را هم ببینید؟» |
| No reviewed guidance | «برای این ترکیب هنوز پیشنهادِ بررسی‌شده‌ای نداریم؛ می‌توانید آزادانه به کاوش ادامه دهید.» |
| Unusual combination, nonjudgmental | «این انتخاب ترکیبی کمتر آشنا می‌سازد. اگر دوست دارید، چند مسیر دیگر را هم امتحان کنیم.» |
| No production option | «این مفهوم فعلاً گزینهٔ تأییدشده‌ای برای تولید فیزیکی ندارد.» |
| Available approved option | «این گزینه در حال حاضر در میان انتخاب‌های تأییدشده قرار دارد. جزئیات و قیمت نهایی را پیش از ادامه بررسی کنید.» |
| Confirm applying suggestion | «این پیشنهاد را به‌عنوان نسخه‌ای جداگانه باز کنیم؟ مفهوم اصلی شما حفظ می‌شود.» |
| Accept action | «ساخت نسخهٔ پیشنهادی» |
| Decline action | «همین ترکیب را نگه می‌دارم» |
| Undo action | «بازگشت به نسخهٔ قبلی» |
| Confirm production choice | «این گزینه و جزئیات تولید را بررسی کردم و برای ادامه تأیید می‌کنم.» |

Avoid red/green “bad/good perfume” language. Use visual selection states rather than quality grades. Production restrictions should be presented plainly and separately from aesthetic advice.

## Dependencies and owner decisions still open

- Which qualified perfumer/production partner owns editorial and technical advisory review? What evidence and periodic review process are required?
- Will Controlled Personalization use a finite approved base/accord catalog, or another constrained production method? Actual method remains unknown.
- What option granularity is operationally meaningful and safe to present? No proportions or ingredient values are approved.
- Who approves/revokes production configurations, production capacity, lead time, pricing and supplier reference data?
- Is advisor guidance rules-based, human-authored, or later assisted by a model? This specification recommends versioned reviewed rules first; no model or score is selected.
- How long are concepts, accepted alternatives, advisory provenance and production check records retained? Do not store unnecessary questionnaire data.
- Can product line B launch independently of C? The owner approved both as direction but not their release order.
- What Iran-specific legal, labeling, consumer, privacy, tax, payment and product review is required? Qualified local review is needed; this document makes no compliance claim.

## Current capability statement

The current Guided Studio recommendations are deterministic editorial suggestions from catalog data. Creative Studio permits conceptual composition. There is no Smart Perfumer advisor, reviewed compatibility rule library, approved production configuration, physical customization service, quote, or order integration today.
