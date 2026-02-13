# Tabby Documentation Index

Welcome to the Tabby engineering documentation. This is your single source of truth for understanding the codebase, architecture, and development workflows.

## For New Joiners: Start Here

Read these in order:

| # | Document | What You'll Learn | Time |
|---|----------|-------------------|------|
| 1 | [Project Overview](./01_PROJECT_OVERVIEW.md) | What Tabby is, tech stack, repo structure | 5 min |
| 2 | [Getting Started](./02_GETTING_STARTED.md) | Local setup, running the app, common issues | 10 min |
| 3 | [Architecture](./03_ARCHITECTURE.md) | System design, how frontend/backend communicate | 10 min |
| 4 | [Core Flows](./08_CORE_FLOWS.md) | End-to-end user journeys (group → split → pay) | 15 min |
| 5 | [Authentication](./07_AUTHENTICATION_FLOW.md) | Login, tokens, security | 10 min |

## Deep Dives

| Document | Purpose |
|----------|---------|
| [Database Schema](./04_DATABASE_SCHEMA.md) | All tables, columns, relationships, migrations |
| [API Reference](./05_API_REFERENCE.md) | Every endpoint with request/response examples |
| [Frontend Guide](./06_FRONTEND_GUIDE.md) | Components, navigation, state management, patterns |
| [Deployment](./09_DEPLOYMENT.md) | Building, deploying, Docker, environment config |
| [Conventions](./10_CONVENTIONS.md) | Code style, naming, Git workflow, testing plans |
| [Glossary](./11_GLOSSARY.md) | Terms, acronyms, and concepts used in the project |

## Quick Reference

### Run Locally
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
npm run dev
```

### Test Account
- Email: `test@tabby.com`
- Password: `password123`

### Key URLs (Local)
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Uploads: http://localhost:3001/uploads

### Important Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Frontend router and page manager |
| `src/components/GroupDetailPage.tsx` | Core group session UI |
| `src/lib/api.ts` | All API calls |
| `src/contexts/AuthContext.tsx` | Auth state |
| `server/src/index.ts` | Server entry point |
| `server/src/db.ts` | Database schema |
| `server/src/routes/transactions.ts` | Transaction lifecycle |
| `server/src/routes/groups.ts` | Group management |
