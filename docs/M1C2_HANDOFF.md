# M1-C.2C Handoff

## Guided result Save

The ready Guided result builds its request with `toConceptInput` against the current API note catalog and calls the existing `concepts.create` client. The client owns credentialed requests, CSRF renewal/retry, timeout handling, and API error mapping. No request is sent before authentication. Anonymous Save opens the existing login dialog and keeps the result mounted; after successful login the visitor must press Save again. A successful response records the concept ID under the exact submitted name and ordered composition snapshot. Pending requests are keyed the same way, so duplicate POSTs for one snapshot are blocked while a genuinely changed snapshot can be saved separately. The UI derives pending, success, and error messages only from the snapshot currently visible. A late success or failure for an older result cannot label or replace the current result. Regenerating an identical saved snapshot does not POST a duplicate; restarting returns to the questionnaire without showing old result status. Unmounts do not call React state setters.

Failed requests keep the visible result. A 401 opens login again; 422 reports a stale catalog/composition issue; service and network failures show an error. No-match and invalid results have no Save action. Questionnaire answers are never sent to the API.

## Guided to Creative draft

`StudioDraftProvider` is mounted under the root `AuthProvider`, above the shared header, route content, and footer. It stores one same-tab draft containing only an ephemeral transfer ID, name, and `{ noteId, layer, position }` rows. It never writes to browser storage and carries no answers, note names, session data, or CSRF value. Replacing an existing pending draft requires confirmation in Guided Studio.

Guided navigation uses the harmless `/studio/creative?from=guided` hint. The hint alone cannot create a composition. Creative Studio fetches the complete current note catalog, validates draft IDs, note count, layers, and contiguous layer-local positions, then resolves every UUID to a real API record. It initializes existing editor state directly so layers and ordering survive, and consumes only the matching transfer ID after successful initialization. A newer pending draft cannot be cleared or overwritten by an older in-flight import.

Catalog failure preserves the pending draft and exposes a real retry. Missing notes are identified by UUID suffix; importing the remaining real notes requires explicit confirmation. If none remain, the transfer is not consumed. The ordinary Creative route does not auto-load a dormant draft: it offers an explicit load action. If that action replaces an existing composition, including a saved concept, a confirmation is required. For a loaded saved-concept URL, confirmation first navigates to `/studio/creative?from=guided`, removing `concept=<id>` before import. The draft stays in the root provider through that URL transition/remount, then is resolved again from the live note API and consumed only after initialization. This makes the imported work an unsaved composition; Save creates a new concept, and the previous saved concept remains unchanged. Saved-concept loads and in-flight imports are checked against the current route intent before asynchronous results apply, so stale responses cannot overwrite a newer editing context. A failed saved-concept load still cannot fall back to Guided import.

`/studio/creative?concept=<id>` takes precedence over Guided transfer. The saved concept is loaded first and a pending Guided draft remains dormant. A failed saved-concept load does not trigger fallback import. A `from=guided` URL after a full refresh has no provider state; it displays an expired-draft message and does not invent data. V1 transfer and questionnaire state are intentionally memory-only.

## Verification

- Component tests cover anonymous Save, exact create payload, successful and failed Save, deferred stale success/failure after editing or restart, same-snapshot duplicate prevention, identical-result regeneration, real catalog resolution, layer preservation, one-time consumption, catalog retry, missing-note confirmation, saved-concept URL detachment, and import invalidation after route changes.
- `npm run test:browser:guided` also runs a real App Router URL journey: it holds the first live catalog import in flight, visits a saved concept, accepts the Guided draft, observes the `concept` query being removed, and confirms the draft survives the route transition with its API UUIDs and layers. The saved session/concept responses in this route-only journey are isolated Playwright network fixtures; there is no application OTP bypass. Catalog calls still use the seeded FastAPI service.
- Real authenticated browser Save is not verified: the public SMS provider is unconfigured and returns HTTP 503. No OTP bypass or test code is exposed by this frontend.
- Authenticated API create/read/update should continue to be verified with the Backend's isolated private `TestClient` fixture. This is separate from a browser authentication test.
- The real anonymous browser journey is `npm run test:browser:guided`; it checks live FastAPI data, anonymous Save/login preservation, and same-tab Creative import. It saves screenshots only under `artifacts/guided-studio/m1c2c/`, preserving the earlier M1-C.2B screenshots.

## Local reproduction

Run the seeded Backend and frontend using the existing development setup. Use consistent `localhost` origins for both services so the configured CORS origin and cookie host remain aligned. Open `/studio/guided`, complete the six steps, then try both result actions. For anonymous Save, the expected current behavior is an honest SMS-unavailable message; the result remains available. For handoff, the imported composition should appear in Creative Studio with the same name and layer assignments, ready for editing.

## Remaining limitations

- Authenticated browser Save remains unverified until real SMS delivery or an explicitly approved isolated browser-auth mechanism exists.
- Same-tab drafts and Guided answers are lost on full refresh by design.
- A changed Guided result creates a new saved concept; this flow does not edit an earlier saved concept.
- Recommendation results remain conceptual and do not imply physical scent behavior, safety, manufacturing feasibility, or product availability.
- M1-C.2C does not add Backend endpoints or questionnaire persistence.
