# Backend integration

Source: adjacent Backend's committed `feature/foundation-v1` M1-A implementation, `docs/API_CONTRACT.md`, `docs/FRONTEND_INTEGRATION.md`, and a local export of `aroman.openapi_export` at `docs/openapi.m1a.json`. The adjacent Backend `develop` branch does not contain those M1-A files yet. Integration against `develop` therefore depends on that branch receiving M1-A. Run `npm run types:api` after updating the schema artifact. The client uses generated schema models and the documented `/api/v1` endpoints.

Public list endpoints return arrays with `limit` and `offset`, no total. The catalog uses name search, brand and family UUID filters, and 12-item paging. Studio notes use server-side `q` and `family_id` filters plus 50-item paging. Product variants are a separate unpaginated call. No API field for price, stock, media, checkout, reviews, or performance is present; local bottle art is explicitly conceptual.

Authentication uses credentialed requests, HttpOnly host-scoped cookie, six-digit OTP, and in-memory CSRF. A successful challenge only means accepted delivery request. HTTP 503 is shown as unavailable. On reload, `/auth/session` precedes `/auth/csrf` and `/users/me`; the CSRF response rotates the token. Protected writes retry once after 403 with a fresh token. A 401 clears account state. Error UI is keyed by status, not English backend detail strings.

Concept payloads use `name` and `notes` containing `note_id`, `layer` (`top`, `heart`, `base`), and layer-local `position`. Save uses POST; edit uses PUT; account uses list, duplicate, and DELETE. The backend owns UUIDs. A failed write never changes the saved marker. Concurrent editing has no revision token in M1-A.

For local HTTP, use `localhost` for both apps, frontend `http://localhost:3000`, API `http://localhost:8000`, backend `CORS_ORIGINS=http://localhost:3000`, and `COOKIE_SECURE=false`. Cookie path `/api/v1` matches all private routes. Do not mix `localhost` with `127.0.0.1`. Deployed cross-site HTTPS needs exact CORS origin, `COOKIE_SAMESITE=none`, and secure cookies.
