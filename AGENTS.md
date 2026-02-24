# Tabby – Agent Instructions

## Cursor Cloud specific instructions

### Overview

Tabby is a real-time group bill-splitting mobile web app. It has two main services:

| Service | Port | Command |
|---------|------|---------|
| **Frontend** (React + Vite + TypeScript) | 3000 | `npm run dev` (from repo root) |
| **Backend** (Express + TypeScript) | 3001 | `npm run dev` (from `server/`) |
| **PostgreSQL 16** | 5433 | `docker compose up -d db` |

See `docs/02_GETTING_STARTED.md` for the full setup guide, scripts reference, and common issues.

### Starting services

1. **PostgreSQL**: `docker compose up -d db` — starts Postgres on port 5433 (maps to container port 5432). Credentials: `tabby`/`tabby`, database: `tabby`.
2. **Migrations**: `cd server && npm run migrate` — applies `server/migrations/*.sql` files.
3. **Seed** (optional): `cd server && npm run seed` — creates test accounts (`test@tabby.com` / `password123`, `test2@tabby.com` / `password123`) and demo groups.
4. **Backend**: `cd server && npm run dev` — runs `tsx watch src/index.ts` with hot-reload.
5. **Frontend**: `npm run dev` — runs Vite on port 3000; proxies `/api/*` and `/uploads/*` to `localhost:3001`.

### Critical: VITE_API_URL in cloud environments

The Cursor Cloud VM injects a `VITE_API_URL` environment variable that overrides the Vite proxy and breaks local API calls. Before starting the frontend, **unset it**:

```bash
unset VITE_API_URL
npm run dev
```

Or start it in one command: `VITE_API_URL= npm run dev`

### Critical: RECEIPT_OCR_PROVIDER in cloud environments

The Cursor Cloud VM also injects `RECEIPT_OCR_PROVIDER=mindee` which overrides the `server/.env` setting. The Mindee API key injected may not be valid, causing empty OCR results. When starting the backend, **explicitly override it**:

```bash
RECEIPT_OCR_PROVIDER=mock npm run dev
```

The mock provider returns deterministic sample data (4 coffee shop items totaling $27.22). See `server/.env.example` for all OCR provider options.

### Bank linking

The app uses a stub endpoint (`POST /api/users/link-bank`) that works without Plaid API keys. The Plaid routes (`/api/plaid/*`) exist but are not integrated into the frontend. Call the stub endpoint to enable group creation and payment flows.

### Lint / Build / Test

- **Frontend build**: `npm run build` (Vite production build to `build/`)
- **Backend type-check**: `cd server && npx tsc --noEmit`
- No dedicated lint or test scripts are configured yet; TypeScript compilation is the primary check.

### Environment file

`server/.env` is required. Copy from `server/.env.example` and configure:
- `DATABASE_URL` — set to the Docker Compose Postgres connection (see `docker-compose.yaml` for credentials and port)
- `RECEIPT_OCR_PROVIDER=mock` — use mock OCR for local dev without API keys
