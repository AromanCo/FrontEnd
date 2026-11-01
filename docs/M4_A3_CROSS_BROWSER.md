# M4-A3 cross-browser regression

Baseline: `develop` at `d6e641d`, on the isolated `test/m4-a3-cross-browser` review branch.

## Run the checks

Build and start the production frontend once (`npm run build`, then `npm run start`). The browser journeys use `FRONTEND_ORIGIN` (default `http://localhost:3000`) and a Playwright-only API fixture. They do not require a Backend or send SMS requests.

```bash
npm run test:browser:mobile-rtl -- --strict-a11y
npm run test:browser:firefox -- --strict-a11y
npm run test:browser:webkit -- --strict-a11y
```

`BROWSER_ENGINE` selects `chromium` (default), `firefox`, or `webkit` in `scripts/browser-utils.mjs`. Chromium retains the system `CHROME_BIN` path (`/usr/bin/google-chrome` by default). Firefox and WebKit use the Playwright-managed binaries that match the installed Playwright package. Install them with `npx playwright install --with-deps firefox webkit` where the environment permits. An unsupported engine fails immediately.

Each engine runs the same isolated journey at **320, 390, 768, and 1440px**. It checks Persian language and RTL direction, document overflow, responsive navigation and keyboard focus, the six Guided steps and handoff into Creative Studio, imported composition editing and note selection, mobile tab pointer and RTL keyboard operation, Save validation, and login dialog focus containment and restoration. All viewport failures are collected before the process exits. `--strict-a11y` retains the mandatory rendered focus checks; this is an accessibility smoke test, not a WCAG audit.

CI installs Firefox and WebKit after `npm ci` and runs both engine commands after the seven existing Chromium journeys. All browser commands share the single production Next.js server. The job timeout is 35 minutes to cover browser installation and the additional journeys.

## Local verification

| Check | Result |
| --- | --- |
| Unit tests | PASS: 20 files, 173 tests |
| TypeScript | PASS |
| Lint | PASS |
| Production build | PASS |
| Existing Chromium journeys | PASS: auth, Guided save/account, Guided-to-Creative save, 503 retry, 401 reauthentication, pending Save, mobile RTL |
| Chromium mobile RTL | PASS: 320, 390, 768, 1440px |
| Chromium strict focus | PASS: 320, 390, 768, 1440px |
| Firefox mobile RTL | PASS: 320, 390, 768, 1440px |
| Firefox strict focus | PASS: 320, 390, 768, 1440px |
| WebKit mobile RTL and strict focus | BLOCKED locally before any viewport: managed binary present, host dependencies missing |

No Chromium- or Firefox-specific issue was observed. Both WebKit commands stop at `browserType.launch` before opening a viewport. Playwright identifies these missing host packages: `libevent-2.1-7t64`, `libgstreamer-plugins-bad1.0-0`, and `libavif16`. They were not installed locally because system package installation requires separate approval. CI uses `npx playwright install --with-deps firefox webkit` on its Ubuntu runner; the CI browser results have not yet been observed. Independent review can inspect the implementation now, but WebKit verification remains outstanding.
