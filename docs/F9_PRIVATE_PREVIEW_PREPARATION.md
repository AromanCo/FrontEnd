# F9 private preview preparation

The internal MVP passed its unified local browser journey in [PR #83](https://github.com/AromanCo/FrontEnd/pull/83). The homepage and discovery-to-studio updates passed CI and merged in [PR #84](https://github.com/AromanCo/FrontEnd/pull/84) and [PR #85](https://github.com/AromanCo/FrontEnd/pull/85). This checkpoint records the source baseline and the decision needed to prepare an isolated preview. Target evidence and release approval are still pending.

## Source and catalog baseline

| Use | Revision | Evidence |
| --- | --- | --- |
| Frontend source proposed for private preview preparation | `37d18450f4a641c40bb68386ba7c59e4cdd020aa` | Merged F8 discovery flow with passing [CI](https://github.com/AromanCo/FrontEnd/actions/runs/44751629324). Candidate image and target evidence remain outstanding. |
| Internal functional MVP Backend | `e69c286f6758847c08077b12ab621341ebb2a557` | Six synthetic products across six fragrance families. Full application behavior verified with PG17 and FakeSMS in isolated F5 worktrees. |
| Existing restricted showcase Backend pin | `0be24c4597bd693e70348243c26e550a20a8ad0e` | Three synthetic products in the seed. The [release pin](../scripts/backend-pin.mjs) and restricted FastAPI entry point still govern candidate preparation. |
| Local infrastructure reference | `712bd6bba3a6a52a26ae76df5257e99d556cdcbe` | [Local Compose workflows](https://github.com/AromanCo/aroman-infra/tree/712bd6bba3a6a52a26ae76df5257e99d556cdcbe) and the existing-volume guard. |

The six-product seed is an additive Backend change from [PR #27](https://github.com/AromanCo/Backend/pull/27). The [browser candidate pin](../scripts/r3c-b-test-backend-pin.mjs) points to its prerelease test commit. Promoting six products to the restricted preview requires approval of the merged Backend revision and a fresh check of the restricted catalog contract, seed count and artifact identity in an isolated environment.

## Recommended first preview

Use the existing restricted showcase contract with the current three-product Backend pin for a first, synthetic, read-only preview. Start with the owner and named team members. Expand invitations after access, expiry and revocation have been checked. This proposed scope demonstrates catalog, Guided, Creative and Smart Perfumer with in-memory transfers. Full-app accounts, OTP, saved-concept persistence and commerce stay outside the preview scope.

The frontend artifact uses the existing `public-showcase` build scope and same-origin `/api/v1`. The name describes the build profile. Private access depends on the approved ingress and per-request access enforcement. Keep the restricted `aroman.exploration_api:app` behind that boundary with its five catalog GET templates. The [private architecture matrix](M6_A19_OWNER_DECISION_MATRIX.md) and the [operator handoff](M6_A27_PRIVATE_PREPRODUCTION_RUNBOOK.md) cover the access model and infrastructure constraints. Use an isolated target so the Coming Soon and bot services can keep running independently.

## Steps and evidence

| Step | Next action | Evidence |
| --- | --- | --- |
| Source and candidate preparation | Build the exact Frontend revision with the approved restricted Backend pin in a disposable build workspace. Use the existing [candidate preparation script](../scripts/prepare-private-candidate.mjs). | Clean checkout identity, compiled artifact hash, image digests and effective Compose fingerprint. |
| Private target and access | Confirm the target and access method, owner-approved hostname, named testers, operator and access reviewer before target work. | Approved scope, documented ingress, individual access expiry and revocation, private service origins and exact HTTPS origin. |
| Target acceptance | Apply the [target checklist](M6_A25_TARGET_ACCEPTANCE_CHECKLIST.md) for the approved scope. Verify the five catalog reads, denial of excluded routes, private database and catalog-only runtime grants, and recovery and rollback. Reuse the F8 browser evidence for the unchanged application behavior. | Sanitized target evidence and owner sign-off for the agreed private scope. |
| Public or full-app release | Review the [release evidence register](M6_A28F_RELEASE_EVIDENCE_READINESS.md) under the separately approved release scope. | Public release remains `NO-GO`. The [sample record](private-preproduction-release-record.example.json) keeps all 13 production target controls `UNVERIFIED`. |

The four existing private-release-record tests passed during this checkpoint. They verify that missing candidate fields and synthetic evidence cannot clear the release gate. The selected first preview uses the existing restricted three-product Backend pin. The [review image workflow](../.github/workflows/f9-review-images.yml) restores the checksummed Frontend build from the recorded candidate run, builds Frontend and PostgreSQL review images, and retains their archives and image identities. The source artifact and image archives have limited retention. The restricted Backend image still requires the retained Backend evidence and Stage B review before it can enter private target acceptance.

## November 21 follow-up

- The full-app local preview at Frontend `a2cf6caddd4066ab820b44f669f8d469fb4cc375` and Backend `02a29f8e13f1513b963e3dd4228ef4e2f36883aa` passed the owner's manual Account and Studio check. The launcher reported that it removed the disposable workspace.
- A restricted build from that Frontend revision stopped on its locked Next.js version. [Frontend PR #100](https://github.com/AromanCo/FrontEnd/pull/100) upgrades Next.js and its ESLint configuration to 16.4.6. A clean checkout of the PR head `46fbd2db2ffd3633204fa37eb7e8ad98a9cef8d3` compiled with scope `public-showcase` and API base `/api/v1`. Candidate verification matched the source, compiled content, dependency lock, and restricted Backend pin. The 25 offline preparation checks, 314 Vitest tests and lint passed. The production-dependency npm audit returned zero findings for the installed lockfile.
- The compiled loopback HTTP checks reached the browser step after checking catalog routing and exclusions. Chromium could not start in the local runner because the environment denied socket creation. Complete the browser journey and Compose checks in GitHub CI or an environment that supports them.
- The earlier review-image runs in this PR describe the historical F8 revision. After PR #100 passes CI and merges, build a new candidate and review images from the exact selected post-merge revision. Private target evidence remains pending and public release stays `NO-GO`.
