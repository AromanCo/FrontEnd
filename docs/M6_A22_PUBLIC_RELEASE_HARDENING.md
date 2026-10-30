# M6-A22 Public Release Hardening

## Local guarantees

- A `public-showcase` build requires an explicit browser API setting. `/api/v1` selects the same-origin handler; an absolute browser-facing API URL must be canonical HTTPS, use exactly `/api/v1`, contain no credentials, query, or fragment, and cannot use loopback.
- Runtime checks validate the build metadata, enforce explicit `AROMAN_RELEASE_SCOPE=public-showcase` for a public artifact, and reject a runtime public API setting that differs from the value recorded at build time.
- `AROMAN_CATALOG_UPSTREAM_URL` is server-only. The handler accepts a canonical HTTP(S) URL at exactly `/api/v1`; HTTP loopback remains valid for isolated local fixtures. It forwards only five catalog GET templates, validates bounded query parameters, strips caller headers, does not follow redirects, caps response size and time, and returns generic errors. Other paths return 404 and non-GET methods return 405.
- CI retains its five jobs and runs the public-release preflight regression tests in the existing `verify` job. Preflight reads repository evidence and local configuration only; it does not provision resources or call an external service.
- Public showcase release scope excludes login, account, cart, and checkout navigation. No account, real SMS/OTP, saved concept, user persistence, order, checkout, or payment flow is enabled by the public showcase scope.
- The Backend checkout was not modified. The authorized Backend revision remains pinned in `scripts/backend-pin.mjs` as `0be24c4597bd693e70348243c26e550a20a8ad0e`.

Run locally with:

```sh
AROMAN_RELEASE_SCOPE=public-showcase NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1 AROMAN_CATALOG_UPSTREAM_URL=http://127.0.0.1:8011/api/v1 npm run preflight:public-release
```

For a same-origin public API, preflight and the production start wrapper require a valid `AROMAN_CATALOG_UPSTREAM_URL`. Set it only in the server environment when validating a local fixture or a controlled runtime configuration. Never put it in a `NEXT_PUBLIC_` variable.

## Still unverified deployment requirements

The preflight deliberately reports these as unverified because they require deployment-side evidence or access:

- DNS points to the intended public host.
- HTTPS termination, certificate chain, and redirect behavior are correct.
- Firewall and origin access rules prevent unintended direct access to the Backend.
- Production database roles and credentials provide only the required catalog reads.
- The deployed target is the restricted `aroman.exploration_api:app` at the pinned Backend revision.
- The deployed runtime supplies the intended server-only upstream setting and secrets.

Neither Next.js unit tests nor browser tests establish DNS, HTTPS termination, firewall isolation, production database permissions, or the identity of a production service. Those checks remain deployment blockers. This milestone does not authorize public exposure or deployment and does not close D1–D12.
