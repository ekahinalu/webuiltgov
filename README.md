# WeBuiltGov

Search government opportunities that a connector has verified. Phase 1 is a modular TypeScript app: a React interface, Next.js server routes, PostgreSQL, SQL migrations, and Drizzle.

Sign-in comes from the host. The app then stores organizations, memberships, and roles. Pipeline status is per organization. A preview environment stores its rows apart from production.

## Catalog

- **Grants.gov** works without an API key. Sync stores the latest 100 posted funding opportunities and fetches descriptions for the first five. These are grant opportunities, not contract solicitations.
- **SAM.gov** is implemented against `https://api.sam.gov/opportunities/v2/search`. Set `SAM_GOV_API_KEY` on the server. Until that variable is present, sync pauses and does not invent notices. Award notices are labeled as awards.

Empty fields stay empty. The app does not ship sample opportunities.

Search can filter text, government level, agency, location, NAICS, deadline, and source. Each record shows its source, source id, source URL, and last verified time.

## AI

Server-side xAI calls use base URL `https://api.x.ai/v1`. The key is `XAI_API_KEY`. The model defaults to `grok-4.7` and an organization admin can save another model name. Optional `XAI_MODEL` is used only when no model has been saved. If the key is missing, the rest of the app still runs and the AI page says so.

## Local development

```bash
npm install
npm test
npm run dev
```

`npm run dev` ignores `DATABASE_URL` and uses an in-memory database. The dev server shows a simulated viewer, not a real sign-in. Published builds apply `migrations/` when `DATABASE_URL` is set.

## Environment

| Variable | Purpose |
| --- | --- |
| `SAM_GOV_API_KEY` | SAM.gov Get Opportunities API key. Server only. |
| `XAI_API_KEY` | xAI API key. Server only. |
| `XAI_MODEL` | Optional model name when an admin has not saved one. |
| `DATABASE_URL` | Postgres connection for a published app. The host sets this. |
