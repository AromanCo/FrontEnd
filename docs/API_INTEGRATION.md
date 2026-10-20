# Backend integration

Source: adjacent Backend `develop` at M1-A merge commit `0dfbb8d` (PR #12), `docs/API_CONTRACT.md`, `docs/FRONTEND_INTEGRATION.md`, and a local export of `aroman.openapi_export` at `docs/openapi.m1a.json`. Run `npm run types:api` after updating the schema artifact. The client uses generated schema models and the documented `/api/v1` endpoints.

Public list endpoints return arrays with `limit` and `offset`, no total. The catalog uses name search, brand and family UUID filters, and 12-item paging. Studio notes use server-side `q` and `family_id` filters plus 50-item paging. Product variants are a separate unpaginated call. No API field for price, stock, media, checkout, reviews, or performance is present; local bottle art is explicitly conceptual.

Authentication uses credentialed requests, HttpOnly host-scoped cookie, six-digit OTP, and in-memory CSRF. A successful challenge only means accepted delivery request. HTTP 503 is shown as unavailable. On reload, `/auth/session` precedes `/auth/csrf` and `/users/me`; the CSRF response rotates the token. Protected writes retry once after 403 with a fresh token. A 401 clears account state. Error UI is keyed by status, not English backend detail strings.

Concept payloads use `name` and `notes` containing `note_id`, `layer` (`top`, `heart`, `base`), and layer-local `position`. Save uses POST; edit uses PUT; account uses list, duplicate, and DELETE. The backend owns UUIDs. A failed write never changes the saved marker. Concurrent editing has no revision token in M1-A.

For local HTTP, use `localhost` for both apps, frontend `http://localhost:3000`, API `http://localhost:8000`, backend `CORS_ORIGINS=http://localhost:3000`, and `COOKIE_SECURE=false`. Cookie path `/api/v1` matches all private routes. Do not mix `localhost` with `127.0.0.1`. Deployed cross-site HTTPS needs exact CORS origin, `COOKIE_SAMESITE=none`, and secure cookies.

Studio note requests have a 15-second client timeout. A failed request shows an error and retry control; an HTTP 200 empty array shows the empty-search state. The user's in-memory composition remains available during either state. The screenshot and browser scripts require the seeded 24-note development catalog and fail if the real API does not return it.
