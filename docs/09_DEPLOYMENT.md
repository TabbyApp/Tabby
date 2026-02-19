# Deployment Guide

## Overview

Tabby consists of two services:

1. **Frontend** — Static React SPA (built with Vite)
2. **Backend** — Node.js Express API server

In development, they run as separate processes. In production, they can be deployed together or separately.

---

## Development Setup

See [02_GETTING_STARTED.md](./02_GETTING_STARTED.md) for full local setup instructions.

**Quick start:**
```bash
# Terminal 1: Backend
cd server && npm run dev    # → http://localhost:3001

# Terminal 2: Frontend
npm run dev                 # → http://localhost:3000
```

Vite proxies `/api/*` and `/uploads/*` to `localhost:3001`.

---

## Production Build

### Frontend Build

```bash
npm run build
```

Output: `build/` directory containing static files (HTML, JS, CSS, assets).

### Backend Build

```bash
cd server
npm run build
```

Output: `server/dist/` directory containing compiled JavaScript.

### Run Production Backend

```bash
cd server
npm start
# or
node dist/index.js
```

---

## Environment Variables

### Backend (`server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `MINDEE_API_KEY` | Yes (for OCR) | — | Mindee API key |
| `JWT_ACCESS_SECRET` | Production | `'tabby-access-secret-dev'` | JWT signing secret |
| `JWT_REFRESH_SECRET` | Production | `'tabby-refresh-secret-dev'` | JWT refresh secret |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `FRONTEND_URL` | No | — | Frontend URL for CORS |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | API base URL (only needed if not using proxy) |

> **Note:** Frontend env vars must be prefixed with `VITE_` to be available at build time.

---

## Deployment Options

### Option 1: Single Server (Recommended for MVP)

Serve both frontend static files and the API from one Express server.

**Steps:**

1. Build the frontend: `npm run build`
2. Copy `build/` to `server/public/` or configure Express to serve it
3. Add static file serving to `server/src/index.ts`:

```typescript
// After all API routes:
app.use(express.static(path.join(__dirname, '../../build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build/index.html'));
});
```

4. Build the backend: `cd server && npm run build`
5. Run: `cd server && npm start`

### Option 2: Separate Frontend/Backend

**Frontend:** Deploy `build/` to any static host:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

**Backend:** Deploy `server/` to:
- Railway
- Render
- Fly.io
- AWS EC2/ECS
- DigitalOcean App Platform

**Configuration needed:**
- Set `VITE_API_URL` to the backend URL during frontend build
- Set `FRONTEND_URL` in backend `.env` for CORS
- Update CORS config in `server/src/index.ts`

### Option 3: Docker

The repo includes **Docker Compose** and a **server Dockerfile**:

- **`docker-compose.yaml`** (repo root): Defines `db` (PostgreSQL 16) and `api` (Node server). The API runs migrations on startup and connects to Postgres via `DATABASE_URL`.
- **`server/Dockerfile`**: Multi-stage build; runs migrations then starts the app.

```bash
# Run Postgres + API
docker compose up

# Or build and run in background
docker compose up -d
```

Set `DATABASE_URL` (and other env) in `.env` or in the `api` service in `docker-compose.yaml`. Use a persistent volume for the `db` service so data survives restarts (the default compose file already mounts a volume for Postgres data).

---

## Database Considerations

Tabby uses **PostgreSQL**. In production:

- Use a managed Postgres service (Supabase, Neon, AWS RDS, etc.) or run Postgres in a container with a persistent volume.
- Run migrations before or on app startup (`npm run migrate` or the Docker entrypoint).

### Backup Strategy

For PostgreSQL:

```bash
# Full dump
pg_dump "$DATABASE_URL" -Fc -f tabby-backup.dump

# Restore
pg_restore -d "$DATABASE_URL" tabby-backup.dump
```

Use scheduled backups and WAL archiving where your provider supports it.

---

## Uploads Directory

Receipt images are stored in `server/uploads/`. In production:

- Use cloud storage (AWS S3, GCS) instead of local filesystem
- Set up proper file cleanup (delete files after OCR processing if not needed)
- Current max file size: 10MB
- Accepted formats: PNG, JPEG

---

## SSL/HTTPS

In production:
- Set refresh token cookie `secure: true` in `server/src/routes/auth.ts`
- Use a reverse proxy (nginx, Caddy) for HTTPS termination
- Or deploy behind a load balancer that handles SSL

---

## Monitoring (Future)

Areas to add monitoring:

| What | Tool Suggestions |
|------|-----------------|
| API response times | DataDog, New Relic |
| Error tracking | Sentry |
| Uptime | Better Uptime, Pingdom |
| Logs | Logtail, CloudWatch |
| Database size | Custom cron job |

---

## Health Check

The server doesn't have a dedicated health check endpoint yet. Add one for production (using the existing `query` helper from `db.ts`):

```typescript
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Database unavailable' });
  }
});
```
