# M6-A11 — Local Release Smoke Check

This operator-invoked command performs three bounded, read-only HTTP GET checks
against explicitly supplied local services:

1. The Frontend entry route (`/`).
2. Backend liveness (`/health/live`).
3. Backend readiness (`/health/ready`).

## Run

Start the Frontend and Backend locally, then provide both HTTP base URLs:

```sh
node scripts/local-release-smoke.mjs \
  --frontend http://127.0.0.1:3000 \
  --backend http://127.0.0.1:8000
```

Run the isolated local fixture tests with Node.js:

```sh
node --test tests/local-release-smoke.check.mjs
```

Both options are required. Accepted base URL forms are `http://127.0.0.1`,
`http://127.0.0.1:<port>`, `http://[::1]`, or `http://[::1]:<port>`, each with
an optional trailing slash. Only the exact IPv4 spelling `127.0.0.1` and the
bracketed IPv6 spelling `[::1]` are accepted. Hostnames such as `localhost`,
alternate numeric IPv4 spellings, expanded IPv6, credentials, backslashes,
unexpected paths, query strings, fragments, HTTPS, and invalid ports are
rejected. Redirects are not followed. Each request has a five-second timeout.

## Read the result

Each line reports `PASS` or `FAIL`, the check name, HTTP status (or `—` when no
response was received), and a short diagnostic. A non-2xx status, redirect,
connection error, or timeout fails the command. Exit code `0` means all three
checks received successful HTTP statuses; `1` means one or more checks failed;
`2` means the arguments or target configuration were invalid.

The Backend implements `/health/live` as a process liveness check. `/health/ready`
also checks database availability and whether the database migration revision
matches the application schema head; it returns 503 when either condition is
not met. The checker does not infer readiness from liveness.

A successful result is labeled **local smoke verification only**. It is not
production readiness, deployment approval, or evidence about a deployed service.

## Limits and safety

The checker sends only GET requests to the supplied Frontend root and the two
Backend health paths. It does not submit forms, authenticate, request OTPs,
create users, write application data, or call providers. It does not read or
print response bodies or response headers. Output avoids target URLs and
connection exception details so credentials, cookies, tokens, private response
content, and sensitive headers are not disclosed.

This check cannot verify browser rendering, user journeys, authentication,
CSRF/CORS/cookie behavior, database contents, provider delivery, deployment
topology, TLS, infrastructure controls, monitoring, backups, rollback, load,
or production operation. Use the separately documented test and operational
evidence for those questions.

The automated tests create HTTP fixtures bound to `127.0.0.1` and use a closed
loopback port for the unavailable-service case. They do not send requests to
public network targets.
