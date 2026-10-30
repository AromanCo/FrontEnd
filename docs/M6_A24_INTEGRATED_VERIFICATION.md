# M6-A24 Integrated Showcase Verification

## Smart Perfumer state

`BlendAdvisor` renders a native `<details>` element controlled by React. Before M6-A24, `CreativeStudio` also assigned `details.open = true` directly while handling the hash and navigation event. That created two state owners: the browser DOM could be open while React still held `open === false`. A subsequent Creative Studio render reapplied the stale controlled `open` value and collapsed the panel. Hash activation also selected the mobile composition tab, so the race could occur during the same navigation.

M6-A24 stores the expanded state and navigation focus request in `CreativeStudio`. Navigation handlers select the composition tab and update that state; `BlendAdvisor` reports native summary toggles back to the same owner. No navigation handler changes the DOM disclosure state. The native summary remains the keyboard-operable disclosure control. Browser acceptance checks cover desktop and mobile links, same-page hash activation, an initial hash, close/reopen, a React tab rerender, focus after navigation, Guided transfer query preservation, and width overflow at 320, 390, 768, and 1440 CSS pixels.

Run the compiled same-origin browser journey after a public-showcase build with the same-origin upstream configured:

```sh
AROMAN_RELEASE_SCOPE=public-showcase \
NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1 \
AROMAN_CATALOG_UPSTREAM_URL=http://127.0.0.1:8011/api/v1 \
npm run build
npm run test:browser:public-catalog-same-origin
```

The browser journey uses a local synthetic catalog fixture. A passing result establishes compiled local Frontend behavior and its five-route proxy boundary under that fixture; it is not production evidence.

## Offline release verification

Run `npm run verify:public-release:offline` with the intended local candidate configuration explicitly present in the environment. The command supplies no configuration defaults: missing public scope or browser API base fails, and same-origin `/api/v1` also requires `AROMAN_CATALOG_UPSTREAM_URL`. A canonical absolute HTTPS browser API base is also accepted and does not require the same-origin proxy upstream. It checks the source route boundary, release scopes, CI job count, Backend pin, M6-A23 example structure, and readiness/stop-condition text. If a compiled public-showcase metadata file exists, it checks that its recorded browser API base matches the supplied configuration. It then executes a pure four-branch recovery decision rehearsal. The rehearsal has no network or filesystem release side effects.

`PASS` applies only to those checks. The command leaves all 13 M6-A23 target controls `UNVERIFIED`; DNS, TLS, target isolation, production Backend and database identity, operational controls, backups, real recovery capability, authority, and release sign-off still need evidence from the named target. A missing compiled metadata file is reported as `UNVERIFIED`. A present but mismatched artifact is `FAIL`.

The recovery rehearsal proves only that the local decision function returns the expected stop/rollback/restore recommendation for its inputs. It does not operate an artifact, database, backup, or service and cannot establish production rollback or recovery capability. The required evidence for an actual drill remains in section 9 of the M6-A23 runbook.

## Release status

M6-A24 source baseline: `76ce5fb22904b55792dacdc18842ad38cf8d21ef`.

Backend remains pinned to `0be24c4597bd693e70348243c26e550a20a8ad0e`; no Backend changes are in scope. This working tree remains uncommitted. The M6-A23 example is structural only and intentionally contains zero `PASS` target controls.
