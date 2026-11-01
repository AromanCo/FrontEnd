# M6-A25 Owner Decision Packet

This packet turns the actual M6-A15 register into an owner worksheet. It proposes no provider, records no approval, and keeps D1–D12 **OPEN**. `docs/launch-decisions.example.json` is deliberately an incomplete template; the validator detects gaps and contradictions but cannot authenticate a person, signature, or business choice.

## Decision sequence and choices

| ID | Owner choice to record | Dependencies and decision consequences |
| --- | --- | --- |
| D1 | First scope: private exploration; later saved concepts behind approved access; separately approved public exploration; or defer. Commerce remains separate. | None. Defines exposed routes, data, users, and which later gates apply. |
| D2 | Approved audience/access method and permitted data, or defer exposure. | D1. Defines reachability, access removal, data classification, and test locations. |
| D3 | Compare hosting location, topology, provider, network boundaries, cost, and operational burden; choose an option or defer. | D1/D2. Architect supplies comparative diagrams and failure boundaries; no provider is preselected. |
| D4 | Select/ defer hostname, DNS control, certificate issuance and renewal ownership. | D3. Requires exact origins and control/renewal evidence. |
| D5 | Select ingress/proxy behavior, exact CORS origins, trusted peer ranges, and cookie policy only if authentication is separately included. | D3/D4; D1 for authentication. Must align with data flow and spoofing tests. |
| D6 | Select database service and environment separation; assign runtime, migrator, operator, migration and recovery responsibilities. | D1/D3. Requires least-privilege grants and migration/failure rehearsal. |
| D7 | Set retention, numeric RPO/RTO, encryption/key custody, restore authority and rehearsal cadence, or explicitly approve disposable data with no backup. | D1/D6. Operations proposes a measurable procedure; owner accepts loss/recovery objectives. |
| D8 | Choose secret delivery, service identities, access approval, rotation/revocation owner, and incident handling. | D3/D6. Requires secret-flow, access and rotation evidence; never put secret values in the decision file. |
| D9 | Keep real SMS out of scope, evaluate a provider, or defer accounts. | D1; D3/D8 only if activated. Any activation needs a separate explicit owner, commercial/compliance review, approved template, costs and abuse/recovery tests. |
| D10 | Assign monitoring/logging service, retention, thresholds, alert delivery, incident owner, response and support expectations. | D1/D3. Requires signal inventory, redaction, alert drill and tabletop. |
| D11 | Assign release/deployment owner, maintenance window, rollback authority and acceptable downtime/data loss. | D3/D6/D7/D10. Requires artifact provenance and rehearsed rollback/restore decision path. |
| D12 | Keep commerce out of scope, name product lines for later assessment, or defer. | Separate later commercial gate (D1 if included). Requires qualified product, safety, legal, manufacturing, payment and fulfillment approvals as applicable. |

## Architecture alternatives to compare

- **Frontend public, Backend restricted behind same-origin allowlist:** browser talks to the Frontend; only its exact five catalog GET templates reach the restricted Backend. This keeps the browser away from the Backend origin but makes the Frontend proxy, its egress identity, and ingress rules part of the trust boundary.
- **Frontend public, separately exposed catalog API:** simpler direct browser routing, but requires an independently protected API origin, exact CORS policy, TLS, rate/abuse controls, and proof that the full Backend app and database remain unreachable.
- **Private/deferred audience:** avoids public ingress until D1/D2 and access-removal rules are settled; still requires controlled access, identity and network evidence appropriate to the chosen audience.
- **Managed service versus owner-operated hosts:** compare isolation, regional/data constraints, recovery features, access audit, support, ongoing cost and operational staffing. No option is selected here.
- **Managed database versus separately operated database:** compare service responsibility, network isolation, identity/grant visibility, backup/restore controls, cost and recovery. In every case the application identity must be SELECT-only for approved catalog objects and migration identity separate.

Avoid expanding this decision into accounts, real SMS, saved-user persistence, orders, commerce, or payments. D9 and D12 remain separate opt-in gates.

## Decision record and consistency check

Copy the JSON template to an access-controlled decision record. For each resolved D1–D12 supply `choice`, `owner` role/name, `rationale`, and `approved_at`, then record evidence references in the approved evidence store. Do not add secrets or personal data. If using optional `architecture`, the checker rejects a directly public Backend alongside a public Frontend and rejects runtime database access other than `SELECT_ONLY`. The checker also reports undefined operations, database, incident, release, recovery, independent-review, owner-approval, retention, and recovery-objective responsibilities.

Run `npm run validate:launch-decisions -- path/to/decision-record.json`. A zero exit means the supplied record is structurally complete for human review; it does not establish authority, authenticate signatures, or approve implementation.
