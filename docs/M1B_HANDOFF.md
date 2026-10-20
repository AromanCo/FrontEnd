# M1-B handoff

The application foundation includes a Persian RTL shell, editorial homepage, backend catalog and filters, Creative Studio with six-note composition, cookie-based login, private concept persistence, account concept controls, and route boundaries for Guided Studio and commerce. Concept art is a local placeholder. No purchase flow, recommendation engine, chemical formula, or manufacturing claim is included.

Review the interface at 320, 390, 768, and 1440 pixels with the API running. The supplied Figma screenshots were unavailable, so compare manually when provided. Local fake SMS is test-only and cannot log in through public HTTP without a separate delivery channel. A production SMS provider and backend commerce endpoints are needed for subsequent milestones.

The adjacent Backend checkout is clean on `develop` at M1-A merge commit `0dfbb8d` (PR #12). The frontend contract is based on that implementation and its exported OpenAPI schema.

Verification artifacts are in `artifacts/screenshots/`: home, shop, and Studio at 320, 390, 768, and 1440 pixels. Browser checks found RTL, no horizontal overflow, and no page errors at those sizes. The frontend unit tests and the isolated FastAPI contract test pass. The real SMS provider remains unavailable, so a public browser login and authenticated UI save cannot be verified against a delivered OTP yet.

## M1-B.1 browser verification

The original Studio screenshots were taken while the client was still fetching notes: the capture script waited for the server-rendered heading, not for the note request and rendered library. A live Chrome trace confirmed `GET /api/v1/fragrance-notes?limit=50&offset=0` returned HTTP 200 and all 24 seeded notes. The corrected script waits for that response and 24 rendered note controls, then fails clearly if the expected state never appears. It checks unexpected HTTP, network, console, and page errors, plus RTL and horizontal overflow. The four original `studio-*.png` files now show the loaded library; `studio-selected-*`, `studio-layers-*`, `studio-six-*`, and `studio-result-*` show the subsequent states at each width.

The Studio now distinguishes a request in progress, request failure, successful empty response, and loaded notes. Failed requests provide a retry action. A 15-second API timeout prevents an indefinite request. Selected notes and the concept name remain in memory during transient note-fetch failures; unsaved work resets on page reload, as the current implementation promises no local persistence. On mobile the note list follows page scrolling, making its final item reachable without a nested scroll area.

The real-browser mobile journey passed against seeded FastAPI for note loading, search and family filters, top/heart/base composition, removal, replacement, six-note limit, seventh-note explanation, all three tabs, renaming, live preview, refresh behavior, unauthenticated save preservation, protected request 401, and SMS-unavailable 503. The isolated FastAPI TestClient contract test passed save/reopen/edit/duplicate/delete with a private in-process OTP fixture. Authenticated browser save remains unverified because no real SMS delivery service is connected; no OTP fixture or bypass is exposed through the running application. Visual approval against the unavailable Figma screenshots remains pending.

Recommended M1-C: implement the Guided Studio questionnaire with approved product logic, then add real cart/order endpoints and demonstration checkout in a separate commerce milestone. Replace bottle art and wordmark only with approved brand assets.

## Exact file inventory

Tracked edits and removals (Git status):

- `M` `.gitignore`
- `M` `README.md`
- `D` `components/cart/CartItem.tsx`
- `D` `components/cart/CartSummary.tsx`
- `D` `components/layout/Footer.tsx`
- `D` `components/layout/Header.tsx`
- `D` `components/layout/Navbar.tsx`
- `D` `components/products/ProductCard.tsx`
- `D` `components/products/ProductDetails.tsx`
- `D` `components/products/ProductList.tsx`
- `D` `components/ui/Button.tsx`
- `D` `components/ui/Input.tsx`
- `D` `components/ui/Modal.tsx`
- `M` `next.config.mjs`
- `M` `package-lock.json`
- `M` `package.json`
- `D` `pages/_app.tsx`
- `D` `pages/_document.tsx`
- `D` `pages/api/cart.ts`
- `D` `pages/api/products.ts`
- `D` `pages/cart.tsx`
- `D` `pages/checkout.tsx`
- `D` `pages/index.tsx`
- `D` `pages/login.tsx`
- `D` `pages/product.tsx`
- `D` `pages/signup.tsx`
- `D` `postcss.config.js`
- `M` `postcss.config.mjs`
- `D` `styles/globals.css`
- `D` `styles/tailwind.css`
- `D` `tailwind.config.js`
- `D` `tailwind.config.ts`
- `M` `tsconfig.json`
- `D` `types/index.tsx`
- `D` `utils/api.ts`
- `D` `utils/auth.ts`
- `D` `utils/helpers.ts`

New files:

- `.env.example`
- `artifacts/screenshots/home-1440.png`
- `artifacts/screenshots/home-320.png`
- `artifacts/screenshots/home-390.png`
- `artifacts/screenshots/home-768.png`
- `artifacts/screenshots/shop-1440.png`
- `artifacts/screenshots/shop-320.png`
- `artifacts/screenshots/shop-390.png`
- `artifacts/screenshots/shop-768.png`
- `artifacts/screenshots/studio-1440.png`
- `artifacts/screenshots/studio-320.png`
- `artifacts/screenshots/studio-390.png`
- `artifacts/screenshots/studio-768.png`
- `docs/API_INTEGRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/DEVELOPMENT.md`
- `docs/M1B_HANDOFF.md`
- `docs/openapi.m1a.json`
- `eslint.config.mjs`
- `public/fonts/LICENSE.txt`
- `public/fonts/vazirmatn-arabic.woff2`
- `scripts/capture.mjs`
- `src/app/account/page.tsx`
- `src/app/cart/page.tsx`
- `src/app/checkout/page.tsx`
- `src/app/error.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/loading.tsx`
- `src/app/login/page.tsx`
- `src/app/not-found.tsx`
- `src/app/page.tsx`
- `src/app/shop/[id]/page.tsx`
- `src/app/shop/page.tsx`
- `src/app/studio/creative/page.tsx`
- `src/app/studio/guided/page.tsx`
- `src/components/auth/AccountContent.tsx`
- `src/components/auth/AuthProvider.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/catalog/CatalogControls.tsx`
- `src/components/catalog/ProductCard.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Header.tsx`
- `src/components/studio/CreativeStudio.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Dialog.tsx`
- `src/components/ui/Input.tsx`
- `src/lib/api/client.ts`
- `src/lib/api/generated.ts`
- `src/lib/studio/composition.ts`
- `src/tests/auth-provider.test.tsx`
- `src/tests/catalog-controls.test.tsx`
- `src/tests/client.test.ts`
- `src/tests/composition.test.ts`
- `src/tests/dialog.test.tsx`
- `src/tests/login.test.ts`
- `src/tests/product-card.test.tsx`
- `tests/integration/test_contract.py`
- `vitest.config.ts`
