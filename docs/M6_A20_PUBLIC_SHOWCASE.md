# M6-A20 Public Showcase Build

Build a public showcase with `AROMAN_RELEASE_SCOPE=public-showcase` and an absolute `NEXT_PUBLIC_AROMAN_API_BASE_URL` whose path is exactly `/api/v1`. The build rejects loopback hosts, credentials, query strings, fragments, and non-HTTP(S) schemes. A successful public build records its validated browser API base in `.next/public-showcase-build.json`; starting that artifact in public-showcase mode without the marker fails closed. A full or exploration build cannot be switched into public-showcase mode at runtime.

The current API client also makes catalog requests from the server, which requires an absolute API URL. Same-origin gateway routing with a relative `/api/v1` base is not implemented, so the build rejects that form. No gateway route or rewrite is implied by this build configuration.

For local browser verification, use a syntactically valid non-loopback placeholder API URL at build time; the public showcase browser journey intercepts its catalog reads. The placeholder is test configuration only and does not represent a deployed service.
