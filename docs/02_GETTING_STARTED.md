# Getting Started

This guide walks you through setting up Tabby locally from a fresh clone.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 18+ (recommend 20 LTS) | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Git** | 2.30+ | `git -v` |

Optional:
- **TabScanner API key** — Required for receipt OCR. Get one at [tabscanner.com](https://tabscanner.com). Without it, receipt uploads will fail OCR but the rest of the app works.

## Quick Start (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/TabbyApp/Tabby.git
cd Tabby
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

Or use the shortcut:

```bash
npm run server:install
```

### 4. Configure Environment Variables

Create the backend `.env` file:

```bash
cp server/.env.example server/.env
```

If `.env.example` doesn't exist, create `server/.env` manually:

```env
# Required for receipt OCR
TABSCANNER_API_KEY=your_tabscanner_api_key_here

# JWT secrets (defaults work for local dev, MUST change in production)
# JWT_ACCESS_SECRET=your-access-secret
# JWT_REFRESH_SECRET=your-refresh-secret

# Server port (default: 3001)
# PORT=3001

# Frontend URL (for CORS, optional in dev)
# FRONTEND_URL=http://localhost:3000

# Future integrations (not used yet)
# PLAID_CLIENT_ID=
# PLAID_SECRET=
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_VERIFY_SERVICE_SID=
# TWILIO_PHONE_NUMBER=
```

> **Important:** The only required variable is `TABSCANNER_API_KEY` for OCR. Everything else has sensible defaults for local development.

### 5. Seed the Database (Optional)

To populate the database with test data:

```bash
cd server
npm run seed
cd ..
```

This creates:
- **Test account:** `test@tabby.com` / `password123`
- **3 demo groups** with multiple members and virtual cards

### 6. Start the Development Servers

You need **two terminal windows**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
The API server starts at `http://localhost:3001`.

**Terminal 2 — Frontend:**
```bash
npm run dev
```
The frontend starts at `http://localhost:3000` and opens in your browser.

> **How it connects:** Vite's dev server proxies `/api/*` and `/uploads/*` requests to `http://localhost:3001`. You never need to configure CORS locally.

## Verifying Your Setup

### Check the Backend

```bash
curl http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tabby.com","password":"password123"}'
```

You should get a JSON response with `accessToken` and `user`.

### Check the Frontend

Open `http://localhost:3000` in your browser. You should see the Tabby splash screen followed by the login page.

### Check OCR (if TabScanner key is set)

1. Log in with `test@tabby.com` / `password123`
2. Go to a group → Upload Receipt
3. Take a photo of any receipt
4. Items should appear after 5-10 seconds

## Common Issues

### "Cannot reach server" in the frontend

The backend isn't running. Make sure `cd server && npm run dev` is active in another terminal.

### "Module not found" errors

```bash
# Reset dependencies
rm -rf node_modules server/node_modules
npm install
cd server && npm install
```

### SQLite errors on startup

Delete the database and re-seed:

```bash
rm data/tabby.db
cd server && npm run seed
```

### OCR fails / "TabScanner API key missing"

Ensure `TABSCANNER_API_KEY` is set in `server/.env`. The key must be a valid TabScanner API key.

### Port 3000 or 3001 already in use

```bash
# Find what's using the port
lsof -i :3000
lsof -i :3001

# Kill it
kill -9 <PID>
```

## Project Scripts Reference

### Root `package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite` | Start frontend dev server |
| `npm run build` | `vite build` | Production frontend build |
| `npm run server` | `cd server && npm run dev` | Start backend dev server |
| `npm run server:install` | `cd server && npm install` | Install backend deps |

### `server/package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `tsx watch src/index.ts` | Start backend with hot reload |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm run start` | `node dist/index.js` | Run compiled production server |
| `npm run seed` | `tsx src/seed.ts` | Seed database with test data |

## Development Workflow

1. Create a feature branch: `git checkout -b yourname/feature-name`
2. Make changes — both servers hot-reload on save
3. Test manually in the browser
4. Commit with a descriptive message
5. Push and create a PR against `hmachhi/mvp`

## Useful Tools

- **SQLite Browser** — [DB Browser for SQLite](https://sqlitebrowser.org/) to inspect `data/tabby.db`
- **Postman / Insomnia** — Test API endpoints with auth tokens
- **React DevTools** — Chrome extension for component inspection
- **Vite Inspector** — Press `Ctrl+Shift+I` in the dev server for component source mapping
