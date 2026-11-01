# AROMAN Frontend · M1-B

Persian-first Next.js App Router foundation for the AROMAN main website. This milestone connects to the adjacent FastAPI M1-A catalog, authentication, and fragrance-concept API.

See [development setup](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), [design system](docs/DESIGN_SYSTEM.md), [API integration](docs/API_INTEGRATION.md), and [handoff](docs/M1B_HANDOFF.md).

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The backend must run at `http://localhost:8000`. The seed catalog is demonstration data. Product media, prices, stock, cart persistence, checkout, and orders are outside M1-B. Login requires backend SMS delivery; the default backend configuration returns 503 and does not expose an OTP through HTTP.
