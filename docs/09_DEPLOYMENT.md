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
| `TABSCANNER_API_KEY` | Yes (for OCR) | — | TabScanner API key |
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

Create a `Dockerfile` for the backend:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci --only=production

COPY server/dist/ ./dist/

# Copy frontend build
COPY build/ ./public/

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

```bash
# Build
docker build -t tabby .

# Run
docker run -p 3001:3001 \
  -v tabby-data:/app/data \
  -e TABSCANNER_API_KEY=your_key \
  -e JWT_ACCESS_SECRET=your_secret \
  -e JWT_REFRESH_SECRET=your_secret \
  tabby
```

> **Important:** SQLite needs persistent storage. Use a Docker volume (`-v tabby-data:/app/data`) to preserve the database across container restarts.

---

## Database Considerations

### SQLite Limitations

SQLite is great for MVP but has limitations for production:

| Concern | SQLite | Postgres (future) |
|---------|--------|-------------------|
| Concurrent writes | Single writer | Multiple writers |
| Scaling | Single server only | Horizontal scaling |
| Backups | File copy | pg_dump, WAL archiving |
| Hosting | Embedded (file) | Managed services |

### Backup Strategy

For SQLite in production:

```bash
# Simple backup
cp data/tabby.db data/tabby.db.backup

# Or use SQLite online backup
sqlite3 data/tabby.db ".backup data/tabby.db.backup"
```

### Migration to Postgres

When ready to scale:
1. Switch `better-sqlite3` to `pg` or an ORM (Drizzle, Prisma)
2. Convert schema DDL to Postgres syntax
3. Migrate data using export/import
4. Update synchronous DB calls to async
5. Use a managed Postgres service (Supabase, Neon, AWS RDS)

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

The server doesn't have a dedicated health check endpoint yet. Add one for production:

```typescript
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Database unavailable' });
  }
});
```
