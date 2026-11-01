# M6-A23 — Public Deployment Runbook

**Status: procedural template for review only. No target, provider, hostname, deployment window, or public exposure is approved. D1–D12 remain OPEN. Do not use this document as authority to provision infrastructure or deploy.**

This provider-neutral runbook describes the evidence and gates required before a separately authorized public release. It does not prescribe provider-specific commands. Fill target-specific values only after the relevant owner decisions and implementation authorization are recorded. The acceptance criteria in [Public Target Readiness](M6_A23_PUBLIC_TARGET_READINESS.md) govern this procedure; the evidence object must follow [`public-target-evidence.schema.json`](public-target-evidence.schema.json) and the offline validator.

## 1. Roles and authority

Assign named people and alternates in the approved release record before any operational rehearsal. A role name alone is not an assignment.

| Role | Responsibility |
|---|---|
| Project owner / release approver | Records applicable decisions and scope; approves public exposure and final GO; confirms exceptions and expiry. |
| Release operator | Uses approved artifacts and change window; records revisions/configuration identifiers; executes only authorized steps; can stop the release. |
| Independent release reviewer / tester | Verifies evidence and target checks independently; does not rely on operator assertion for technical PASS claims. |
| Domain and DNS operator | Controls the approved hostname and DNS records; captures authoritative and independent resolver results. |
| Network / ingress and TLS operator | Applies approved reachability boundaries, ingress, certificate and renewal controls; supports external and peer probes. |
| Backend operator | Confirms the restricted application target, process identity, configuration and exact route behavior. |
| Database operator / reviewer | Confirms runtime grants, migration separation, backup disposition and restore evidence. |
| Catalog/content owner and rights reviewer | Establishes provenance, permitted use and publication approval for each catalog item. |
| Security / secrets owner | Reviews secret custody, least-privilege access, rotation/revocation and redaction. |
| Operations / incident owner | Owns monitoring, alert delivery, on-call response, log access/retention and incident records. |
| Recovery authority | Database and release owners jointly decide forward-fix, code rollback or restore; authority and limits must be recorded. |

The owner must explicitly assign release, stop, rollback, restore, incident and sign-off authority. If any required role or alternate is unassigned, stop. Do not invent names or treat this template as an assignment.

## 2. Prerequisites and stop conditions

Before target-specific work, confirm the following in an approved decision/authorization record:

1. Applicable M6-A15 decisions are resolved for the proposed scope, audience, exposure, hosting/network, domain/ingress, database, secrets, operations and release/recovery. D9 must be resolved if authentication or OTP is proposed; D12 remains a separate commerce decision. In the current state D1–D12 are OPEN, so the release gate is **NO-GO**.
2. Approved target identifier, hostname, architecture/data-flow and peer/port map, budget authority, maintenance window, named role assignments, permitted data, and exact included/excluded routes are documented.
3. Frontend and Backend artifacts are built from reviewed source and their source and compiled identities are recorded. M6-A24 began from Frontend `76ce5fb22904b55792dacdc18842ad38cf8d21ef`; the M6-A25 development baseline is `65568465a67b3697903f7337d4d8e831d6b9acf3` and is not itself a release candidate. Use the M6-A25 candidate manifest to identify the actual source tree, build configuration, and compiled artifact. Backend remains pinned to `0be24c4597bd693e70348243c26e550a20a8ad0e`. The Backend target is the restricted `aroman.exploration_api:app`, never `aroman.main:app`.
4. A target evidence package is created from the example, with exactly the required control IDs and no secrets or personal data. Keep controls `UNVERIFIED` until acceptable evidence for the actual target exists.
5. Target-equivalent rehearsal, accepted recovery objectives, data policy, monitoring and incident coverage are approved. Required access for independent reviewers is available without sharing credentials.

**Stop before change or public exposure** if a required decision, approval, role, evidence item or recovery objective is missing; any control is `FAIL` or `UNVERIFIED`; revisions or configuration differ from the approved record; an unexpected listener, route, peer, data class, secret, or capability is found; direct origin access is possible; a migration or health check fails; alerts do not reach the assigned responder; or rollback/restore authority is unclear. Record the stop, preserve redacted evidence, notify the release owner, and do not continue until a documented review resolves it.

## 3. Evidence handling and release phases

Use a change record with target ID, UTC timestamps, operator and reviewer identities, approved scope, maintenance window, artifact revisions, non-secret configuration identifiers, step outcomes, incident/stop references and evidence-package location. Retain raw evidence in an access-controlled approved store; put only redacted, stable references in the JSON package. Never put credentials, private keys, tokens, passwords, personal data, OTPs or secret values into logs, screenshots, command transcripts or evidence.

The phases below describe a future authorized release. They do not authorize execution now.

### A. Pre-change review

- Verify release approval, artifact provenance/signatures or equivalent integrity record, pinned revisions and configuration change review.
- Confirm the approved route/scope and catalog rights register. Confirm excluded capabilities are disabled and unavailable through every public route.
- Confirm backup disposition and a recent successful restore rehearsal where data is retained; establish a rollback/forward-fix decision owner and communication path.
- Ensure independent probes and monitoring are ready. Record a pre-change health and alert baseline.

### B. Controlled change and health gates

- The authorized release operator follows the target-specific approved change procedure and records each action and result. Keep database and management interfaces private.
- Apply schema changes only through the separately approved migration identity and sequence. Verify migration revision and application readiness. Never place migration credentials in the runtime.
- Start or switch traffic only after origin isolation, TLS, process identity, database grants, route restrictions, logging and monitoring controls have passed their target checks.
- If a gate fails or evidence cannot be captured, stop, prevent or withdraw public traffic as authorized, and enter the recovery decision process in section 9.

### C. Post-change review

- Repeat the external, peer, TLS, exact API, excluded-route, database privilege, logging and alert checks against the named target and approved revisions.
- Compare service and data state with the pre-change record; inspect error rates and alerts for the approved observation period.
- Have the independent reviewer validate evidence references and control claims. The project owner records explicit GO or NO-GO; absent signed GO means no public acceptance.

## 4. DNS, HTTPS/TLS and network isolation

These are target controls `domain_dns`, `https_tls` and `network_isolation`; all are currently **UNVERIFIED**.

- **DNS:** Domain operator verifies approved hostname control, authoritative records and answers from independent resolvers. Record timestamped, redacted query outputs and the intended ingress mapping. Confirm no unintended stale, wildcard, preview or alternate records expose a service.
- **HTTPS/TLS:** From supported clean clients, verify the approved hostname, valid full certificate chain, approved protocol/cipher baseline, HTTP redirect or denial, no mixed content, and certificate renewal ownership and failure alert. Capture independent TLS probe and browser evidence. Do not mark PASS based on a configuration file alone if the live endpoint is required by the matrix.
- **Isolation:** From public and unauthorized networks, probe frontend/API origins, full Backend application, database, management ports, previews, alternate listeners and direct origin addresses. From approved peers, confirm only documented peer/port paths work. Review ingress/firewall rules and test bypass resistance. CORS is not network isolation. Confirm no direct route to the Backend except the explicitly approved restricted catalog path.

Any unexpected resolution, invalid certificate, bypass, reachable private service or undocumented connection is a stop condition. Record source network, timestamp, destination class and redacted result; do not include sensitive addresses if the evidence store is not approved for them.

## 5. Restricted Backend identity and exact API surface

These are controls `catalog_target_routing` and `catalog_routes`; both are currently **UNVERIFIED**.

- Inspect the deployed process command/configuration and artifact provenance to prove it runs the pinned Backend revision and `aroman.exploration_api:app`. Confirm the runtime service identity is dedicated, unprivileged, non-interactive, and lacks deployment, host administration and migration authority. Record identity/configuration evidence without credentials. Prove no public or untrusted path reaches `aroman.main:app`, a full application listener, or an alternate Backend origin.
- Probe through the intended public topology. Only these five exact **GET** templates may succeed:
  - `/api/v1/brands`
  - `/api/v1/products`
  - `/api/v1/products/{product_id}/variants`
  - `/api/v1/fragrance-families`
  - `/api/v1/fragrance-notes`
- For each template, capture the request template, method, status and sanitized response classification. Exercise expected allowed bounded query parameters where applicable. Confirm every other path and method is rejected before protected handlers, including trailing-slash, encoded, ambiguous, traversal-like and alternate-prefix forms. Confirm redirects are not followed to another origin and error responses do not disclose internals.
- Verify catalog requests reach only the restricted target, and that an untrusted caller cannot use proxy headers or alternate paths to change upstream identity or route. Preserve access/handler evidence correlated to probes.
- Confirm login, OTP, account, saved concept, user persistence, order, checkout and payment capabilities are absent/unreachable as required by `excluded_capabilities`.

Local tests, CI, repository checks and synthetic fixtures are not evidence of production process identity or target routes. The evidence validator permits PASS only for production evidence using `automated_probe`, `configuration_inspection` or `independent_review`, with a captured time, named reviewer and non-empty evidence reference.

## 6. Database permissions and catalog publication rights

Controls `database_migrations` and `content_provenance` are currently **UNVERIFIED**.

- Inspect actual database roles and grants. The application runtime identity must be distinct from operator and migrator identities and limited to SELECT on only the approved catalog objects. Negative probes/review must show it cannot INSERT, UPDATE, DELETE, execute unauthorized functions, perform DDL, read excluded tables, grant privileges or escalate. Database network access must be limited to approved peers. Preserve redacted grant output and reviewer record.
- Use a separate, tightly controlled migration identity only for an approved migration window. It must not be present in application runtime, frontend build arguments, browser bundles or ordinary operator environments. Record migration revision, approver, result and grant verification; never record the credential.
- For every public catalog item, record source/provenance, rights owner, license or permission basis, real/synthetic classification, review status and approval reference in the controlled catalog register. Content owner and qualified rights reviewer approve publication. Block unknown, disputed, expired or unapproved assets and claims. A successful database read does not grant publication rights.

## 7. Secrets, logging and monitoring

Controls `environment_secrets`, `logging` and `monitoring_incident` are currently **UNVERIFIED**.

- Separate build, runtime, test and migration environments. Keep upstream URLs and credentials server-side; do not place secrets in `NEXT_PUBLIC_*`, source, browser bundles, images/artifacts, process arguments, evidence or shared operator transcripts. Verify artifact and configuration scans, least-privilege access, delivery path, access audit, rotation and revocation rehearsal. Log only secret identifiers/metadata where approved, never values.
- Sample representative success, failure and proxy logs. Confirm tokens, credentials, private keys, OTPs, full phone numbers and other unapproved sensitive fields are absent; verify approved retention, access and deletion behavior. Use synthetic canaries for leakage checks and redact retained evidence.
- Document approved signals, thresholds, retention, alert delivery, on-call acknowledgement, escalation and incident owner. Cover availability, elevated 5xx, upstream/database failure, migration mismatch, certificate expiry/renewal failure and backup failure. Trigger representative drills in a controlled environment and retain delivered-alert and tabletop evidence. Define containment and communication steps without placing sensitive incident data in the evidence JSON.

## 8. Structured evidence and control status

Use `docs/public-target-evidence.example.json` as the starting shape and validate the completed copy with:

```sh
npm run validate:public-target-evidence -- path/to/target-evidence.json
```

The package is format `1` with `target_id`, `frontend_revision`, `backend_revision`, and `controls`. Each control has exactly `id`, `status`, `target_kind`, `verified_at`, `method`, `evidence_refs`, and `reviewer`. Use each of the following IDs once: `domain_dns`, `https_tls`, `network_isolation`, `catalog_target_routing`, `catalog_routes`, `excluded_capabilities`, `database_migrations`, `content_provenance`, `environment_secrets`, `logging`, `monitoring_incident`, `backup_rollback_recovery`, `release_signoff`.

Use only statuses `PASS`, `FAIL` or `UNVERIFIED`; target kinds `production`, `staging`, `synthetic_fixture` or `repository`; and methods `automated_probe`, `configuration_inspection`, `independent_review`, `operator_assertion` or `synthetic_fixture`. For controls without actual target evidence, set **`status: "UNVERIFIED"`**, `verified_at: "NOT_CAPTURED"` when none was captured, `evidence_refs: []` when no reference exists, and reviewer `UNASSIGNED` until named. A PASS requires production target evidence, a technical method (automated probe, configuration inspection or independent review), captured verification time, non-empty evidence references and named reviewer. Operator assertion, staging, synthetic or repository evidence cannot establish production PASS. Record a failed check as FAIL, never hide it as UNVERIFIED.

The validator checks structure and minimum claim provenance only; it makes no network requests and does not prove evidence truth, signatures, freshness, authorization or release readiness. Keep source evidence in the approved access-controlled store and provide stable redacted references. Do not add fields to the schema or put secrets in evidence.

## 9. Backup, rollback and recovery

Control `backup_rollback_recovery` is currently **UNVERIFIED**. D6, D7 and D11 decisions and numeric recovery objectives must be approved before an applicable persistent environment is operated.

- Record whether data is disposable or retained, approved backup frequency/retention, encryption and key custody, access separation, deletion, restore authority, RPO/RTO and rehearsal cadence. If no backup is justified for an approved disposable target, record the owner-approved rationale and data-loss consequence; do not assume no backup.
- Before a change, verify the required recoverable backup or approved no-backup state and capture a non-secret backup identifier, timestamp and integrity/restore-readiness result. Backups must not be publicly reachable.
- If application health, route scope, migration, data integrity, isolation or recovery checks fail, stop traffic or isolate the release as authorized. The release and database owners decide between compatible code rollback, forward fix, or restore based on migration compatibility and data state. Do not assume Alembic downgrade is safe and do not run an unapproved destructive downgrade.
- For code rollback, restore the prior approved artifact/configuration, confirm schema compatibility, repeat readiness and exact route/exclusion checks, then monitor. For restore, use the approved isolated recovery procedure, validate schema/data and access controls, measure elapsed recovery and data loss against RTO/RPO, and obtain owner approval before traffic resumes. Handle sessions, OTP/auth state and other sensitive data per approved policy; these capabilities are out of current public showcase scope.
- Record decision makers, timestamps, artifact/schema identifiers, actions, measured outage/data loss, validation, communications and follow-up. Rehearse failure and recovery in target-equivalent preproduction before any production acceptance.

### Operator checklist and local rehearsal boundary

Before a target change, the release operator must verify and record: the exact prior artifact and non-secret runtime configuration identifiers; the current schema/migration revision; whether target data is retained or explicitly disposable; the approved backup identifier, timestamp, integrity result and isolated restore readiness (or the owner's approved no-backup rationale); numeric approved RPO/RTO; named stop, rollback and restore decision makers; and an approved route to disable or withdraw traffic. Missing any item is a stop condition.

Rollback triggers include failed health or exact-route checks, unexpected public capability, origin/peer exposure, failed migration, data-integrity concern, failed alert delivery, or inability to capture required evidence. The operator stops the change and contains traffic only within the authorized procedure, records the trigger, and obtains the release/database owners' decision. If the prior artifact is schema-compatible, the authorized operator may restore that artifact and its recorded configuration, then repeat health, isolation, exact-route and excluded-capability checks. If compatibility is unknown or false, do not downgrade or switch artifacts; the owners must choose an approved forward fix or an isolated restore from an approved backup. Traffic resumes only after all checks pass and the release owner records approval.

`npm run verify:public-release:offline` runs local repository/configuration checks, validates the checked-in evidence example, and exercises a pure recovery-decision table. The rehearsal has no network, release, or backup side effects. Its PASS proves only the local decision function and documentation shape. A real recovery drill must retain the target/environment identity, artifact and schema revisions, approved backup reference, named operator and independent reviewer, UTC start/end times, actions, measured outage and data loss, validation outcomes, measured RTO/RPO, and owner disposition in the approved evidence store. Local rehearsal does not establish production rollback or restore capability.

## 10. Release sign-off

Control `release_signoff` is currently **UNVERIFIED**. The release record must include target ID, exact frontend and Backend revisions, artifact/configuration identifiers, completed evidence package and validator output, applicable owner decisions, all control statuses, unresolved findings/exceptions with owner and expiry, observation period, independent reviewer, release operator, project-owner decision, decision timestamp and authorized rollback/recovery contact.

The independent reviewer checks that every evidence reference is accessible and supports the stated target, method, time and claim. The project owner records explicit **GO** only after every applicable control is PASS, required decisions are resolved, no blocking finding remains, and operational/recovery roles accept their duties. Otherwise record **NO-GO**, keep public traffic disabled or withdraw it under the authorized procedure, and track remediation. A valid JSON file, local preflight, CI result, or operator assertion is not sign-off.

## 11. Current control disposition

No production target evidence is supplied by this runbook. All 13 controls listed in section 8 are **UNVERIFIED** as of this document; their release state is NO-GO. D1–D12 remain **OPEN**. This document creates no production evidence and authorizes no deployment, infrastructure provisioning, DNS change, public exposure, data publication, or release.
