# M6-A25 Integrated Public Launch Gate

## Development baseline versus candidate

M6-A25 starts from Frontend `65568465a67b3697903f7337d4d8e831d6b9acf3` and Backend pin `0be24c4597bd693e70348243c26e550a20a8ad0e`. The Frontend value is a **development baseline**, not an immutable release candidate. A local manifest can identify the exact working tree and output used for checks; no immutable Frontend release candidate has been designated or approved in this milestone.

`npm run build` remains the public-showcase build entry point. For the public scope it deletes the dedicated `.next` directory first, validates explicit scope/API configuration, builds, then writes:

- `.next/public-showcase-build.json`: format version, release scope, compiled browser API base, full source revision, Backend pin, and configuration digest.
- `.next/release-candidate.json`: source revision plus source-tree digest; Backend revision; scope; API base; configuration identity; Node/Next versions; lockfile digest; and compiled artifact digest/file count.

Source identity and artifact identity reject symbolic links at every path component. Source inputs, compiled files, compiled directories and static browser assets must be regular files/directories; even in-root links are rejected rather than normalized. This prevents external or aliased content from being counted as part of a candidate. Diagnostics identify the offending relative path. Next's runtime-generated `.next/server/route-cache` is excluded from the compiled artifact digest because `next start` writes it after build; it is still traversed and every entry must obey the same no-symlink policy. Normal Next.js output and post-start verification are covered by the public build/browser checks.

The artifact digest covers every regular compiled output file except these two metadata files (which are checked separately), with sorted relative paths, file modes and file hashes. The source revision labels a commit; the source-tree digest distinguishes the actual checkout, including local tracked and untracked non-ignored source content. The artifact digest identifies the actual compiled output. This is integrity evidence, not a claim that builds are bit-for-bit reproducible or that Git revision alone uniquely identifies output. The server-only upstream URL and its digest are not recorded because it may reveal infrastructure details and it is runtime configuration, not compiled browser configuration. Preflight validates its required syntax; target evidence must establish the deployed upstream identity. No secret values, private keys, upstream host value, or approval data are recorded.

Use the following offline commands against the same checkout and artifact:

```sh
AROMAN_RELEASE_SCOPE=public-showcase \
NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1 \
AROMAN_CATALOG_UPSTREAM_URL=http://127.0.0.1:8011/api/v1 \
npm run build

AROMAN_RELEASE_SCOPE=public-showcase \
NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1 \
AROMAN_CATALOG_UPSTREAM_URL=http://127.0.0.1:8011/api/v1 \
npm run verify:public-release:offline
```

Offline verification compares source tree/revision, Backend pin, scope, API base, hashed non-secret configuration, metadata/toolchain/lockfile and compiled files. A present candidate manifest that is malformed, incomplete, stale or mismatched fails. If no compiled candidate is available, repository/local checks can still pass while candidate integrity remains **UNVERIFIED**. Local CI, rollback rehearsal, and browser journeys are not target verification.

## Decision and target gates

`docs/M6_A25_OWNER_DECISION_PACKET.md` maps actual M6-A15 D1–D12 meaning, dependencies and alternatives. The checked-in decision template intentionally leaves all 12 OPEN. Run `npm run validate:launch-decisions -- <decision-record.json>` for missing decisions, responsibilities, retention/recovery and release authority, plus declared topology/grant contradictions. This is a completeness check, not a business decision or signature verifier.

`docs/M6_A25_TARGET_ACCEPTANCE_CHECKLIST.md` is the operator procedure for all 13 M6-A23 controls, including expected outcomes, evidence, stop conditions and accountable roles. Probe planning is offline only. A future live probe requires a separately selected/approved target and explicit execution authorization.

The offline report presents local checks, candidate identity and a gate assessment separately. A target acceptance PASS requires all 13 production controls, applicable resolved owner decisions, independent review and explicit owner GO. Structural JSON validity does not authenticate evidence. Current decisions remain OPEN, current target controls remain 13/13 UNVERIFIED, and current release gate is NO-GO. Nothing here authorizes public exposure.

## Validation and CI

Five existing GitHub jobs remain: `verify`, `exploration-release`, `exploration-real-stack-browser`, `real-stack-browser`, and `postgres-real-stack-browser`. Deterministic candidate and decision tests run within `verify`. The application retains its public catalog and five exact GET templates; Backend source and pin are unchanged.
