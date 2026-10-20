# M1-B architecture

Next.js 16 App Router uses Server Components for public home, catalog, detail, and informational routes. The catalog control form, Creative Studio, account, and authentication flows are focused Client Components. `src/lib/api/client.ts` is the only HTTP transport and exposes generated OpenAPI schema types from `generated.ts`. UI composition models live separately in `src/lib/studio`.

Routes: `/`, `/shop`, `/shop/[id]`, `/studio/creative`, `/studio/guided`, `/login`, `/account`, `/cart`, `/checkout`. Commerce routes are honest placeholders until backend endpoints exist. The backend is authoritative for catalog, session, and concepts. The browser calls it directly using credentialed CORS requests. Server Components call the public catalog only.

The account and Studio do not use React server caching for private state. Authentication context restores `/auth/session`, then rotates CSRF with `/auth/csrf`; the CSRF value lives only in module memory. A Studio composition remains mounted under the login dialog, so an unauthenticated save can be completed after login. No token is stored in browser storage.
