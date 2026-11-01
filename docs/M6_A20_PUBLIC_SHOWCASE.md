# M6-A20 Public Showcase Build

Build a public showcase with `AROMAN_RELEASE_SCOPE=public-showcase` and either the exact same-origin `NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1` candidate or an absolute HTTP(S) URL whose path is exactly `/api/v1`. Absolute URLs reject loopback hosts, credentials, query strings, fragments, and non-HTTP(S) schemes. A successful public build records its validated browser API base in `.next/public-showcase-build.json`; starting that artifact in public-showcase mode without the marker fails closed. A full or exploration build cannot be switched into public-showcase mode at runtime.

Public browser catalog calls may use the local allowlisted Next.js route. Server-rendered catalog requests continue to use the server-only `AROMAN_API_BASE_URL`. This candidate does not implement gateway routing or imply that a Next.js route alone provides a complete public security boundary.

For local browser verification, use a syntactically valid non-loopback placeholder API URL at build time; the public showcase browser journey intercepts its catalog reads. The placeholder is test configuration only and does not represent a deployed service.
