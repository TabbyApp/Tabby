# Tabby — Technical Architecture Overview

A detailed technical explanation of how the Tabby split-payments application works, suitable for understanding the full stack, data flow, and component interactions.

---

## 1. System Architecture

Tabby is a **split-payments web application** with a clear separation between frontend and backend:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│  React SPA (Vite)  │  AuthContext  │  API Client (fetch + JWT)       │
│  Port 3000         │  localStorage │  credentials: include           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    HTTPS /api/*, /uploads/*  (Vite proxy → 3001)
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js)                             │
│  Express  │  JWT Auth  │  SQLite (better-sqlite3)  │  TabScanner OCR │
│  Port 3001│  middleware│  data/tabby.db            │  (external API) │
└─────────────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 18, Vite 6, TypeScript, Tailwind CSS, Radix UI. Single-page app with client-side routing via React state (no URL router).
- **Backend**: Node.js, Express, TypeScript (compiled via `tsx` in dev). All persistence in SQLite.
- **Proxy**: Vite dev server proxies `/api` and `/uploads` to the backend so the frontend uses relative URLs and avoids CORS.

---

## 2. Authentication

### 2.1 Token Strategy (JWT + Refresh)

The app uses **dual JWT tokens**:

| Token        | Storage      | Lifetime | Purpose                          |
|-------------|--------------|----------|-----------------------------------|
| Access      | localStorage | 15 min   | Authorize API requests            |
| Refresh     | httpOnly cookie | 7 days | Obtain new access tokens silently |

**Why two tokens?**  
Access tokens are short-lived to limit exposure if leaked. Refresh tokens are stored in httpOnly cookies (not readable by JS) and used only to get new access tokens. This reduces XSS risk while avoiding frequent logins.

### 2.2 Auth Flow (Signup/Login)

1. **Client** sends `POST /api/auth/signup` or `POST /api/auth/login` with `{ email, password, name? }`.
2. **Server** (`server/src/routes/auth.ts`):
   - Validates input (email format, password length, uniqueness for signup).
   - For signup: hashes password with bcrypt (cost 10), inserts into `users`, generates tokens.
   - For login: looks up user by email, compares password with `bcrypt.compare`.
   - Creates **refresh token** row: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)` with SHA-256 hash of the token.
   - Signs **access token** with `JWT.sign({ userId, email, type: 'access' }, ACCESS_SECRET, { expiresIn: '15m' })`.
   - Signs **refresh token** with `JWT.sign({ userId, email, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' })`.
   - Sets `refreshToken` cookie (httpOnly, sameSite: lax, maxAge 7 days).
   - Returns `{ accessToken, expiresIn, user }` in JSON.
3. **Client** stores `accessToken` in localStorage via `setAccessToken()`, updates `AuthContext` user state.

### 2.3 Refresh Flow

1. **Client** makes an authenticated request; server returns 401 (expired access token).
2. **Client** (`src/lib/api.ts`) catches 401, calls `POST /api/auth/refresh` with `credentials: 'include'` (sends cookie).
3. **Server**:
   - Reads `refreshToken` from `req.cookies`.
   - Verifies JWT with `REFRESH_SECRET`, extracts `userId`, `email`.
   - Hashes token and looks up `refresh_tokens` where `token_hash = ? AND expires_at > now`.
   - If found: issues new access token, returns `{ accessToken, expiresIn }`.
   - If not found: returns 401 (invalid/expired refresh).
4. **Client** updates stored access token and retries the original request.

### 2.4 Protected Routes (requireAuth)

`server/src/middleware/auth.ts` defines `requireAuth`:

- Reads `Authorization: Bearer <token>` header.
- Verifies token with `jwt.verify(token, ACCESS_SECRET)`.
- Checks `decoded.type === 'access'` to avoid refresh-token misuse.
- Attaches `{ userId, email }` to `req.user`.
- Returns 401 if missing or invalid.

All `/api/users`, `/api/groups`, `/api/receipts` routes (except public endpoints) use `requireAuth`.

---

## 3. Database Schema (SQLite)

The database lives at `data/tabby.db` and is created/initialized by `server/src/db.ts` on first import.

### 3.1 Entity-Relationship Overview

```
users ──┬── refresh_tokens (1:N)
        ├── payment_methods (1:N)
        ├── group_members (N:M with groups)
        └── receipts.uploaded_by (1:N)

groups ─┬── group_members (N:M with users)
        ├── virtual_cards (1:1)
        └── receipts (1:N)

receipts ─┬── receipt_items (1:N)
          └── receipt_splits (1:N, per user)

receipt_items ── item_claims (N:M with users)
```

### 3.2 Table Definitions

| Table             | Key Fields                                              | Purpose                                           |
|-------------------|---------------------------------------------------------|---------------------------------------------------|
| **users**         | id (UUID), email (unique), password_hash, name          | User accounts                                     |
| **refresh_tokens**| id, user_id, token_hash, expires_at                     | Stored refresh tokens for validation              |
| **payment_methods**| id, user_id, type (bank/card), last_four, brand        | Mock payment methods (no real billing)            |
| **groups**        | id, name, created_by (FK users)                         | Expense groups                                    |
| **group_members** | group_id, user_id (composite PK)                        | Many-to-many: users in groups                     |
| **virtual_cards** | id, group_id (unique), card_number_last_four            | Simulated group card (last 4 digits only)         |
| **receipts**      | id, group_id, uploaded_by, file_path, total, status     | Receipt metadata and image path                   |
| **receipt_items** | id, receipt_id, name, price, sort_order                 | Line items from OCR or manual entry               |
| **item_claims**   | receipt_item_id, user_id (composite PK)                 | Who owes which item (multi-claim allowed)         |
| **receipt_splits**| id, receipt_id, user_id, amount, status                 | Final per-user share after split computation      |

### 3.3 Indexes

Indexes exist for common lookups: `users.email`, `refresh_tokens.user_id`, `refresh_tokens.token_hash`, `group_members.user_id`, `group_members.group_id`, `receipts.group_id`, `receipt_items.receipt_id`, `item_claims.receipt_item_id`, `receipt_splits.receipt_id`.

### 3.4 Access Pattern

All DB access is **synchronous** via `better-sqlite3`. Prepared statements are used for parameterized queries. Transactions are used for multi-step operations (e.g., group creation with members and virtual card) via `db.transaction(() => { ... })()`.

---

## 4. API Surface

All APIs are REST-style JSON over HTTP. Base path: `/api`.

### 4.1 Auth (`/api/auth`)

| Method | Path          | Auth | Description                         |
|--------|---------------|------|-------------------------------------|
| POST   | /signup       | No   | Create account, return tokens       |
| POST   | /login        | No   | Authenticate, return tokens         |
| POST   | /refresh      | Cookie | Exchange refresh for access token |
| POST   | /logout       | No   | Revoke refresh token, clear cookie  |

### 4.2 Users (`/api/users`)

| Method | Path              | Auth | Description                    |
|--------|-------------------|------|--------------------------------|
| GET    | /me               | Yes  | Current user + payment methods |
| POST   | /payment-methods  | Yes  | Add mock bank/card             |

### 4.3 Groups (`/api/groups`)

| Method | Path                 | Auth | Description                                  |
|--------|----------------------|------|----------------------------------------------|
| GET    | /                    | Yes  | List groups (with member count, card last 4)  |
| POST   | /                    | Yes  | Create group + virtual card + add members     |
| GET    | /:groupId            | Yes  | Group details + members (membership checked)  |
| GET    | /virtual-cards/list  | Yes  | User's groups with card + total spent         |

**Group creation logic** (`POST /`):

1. Insert `groups` row.
2. Insert `group_members` for creator.
3. Insert `virtual_cards` with random 4-digit "last four".
4. For each `memberEmails`: lookup user by email, `INSERT OR IGNORE` into `group_members`.
5. Return created group with `memberCount`, `cardLastFour`.

### 4.4 Receipts (`/api/receipts`)

| Method | Path                        | Auth | Description                                |
|--------|-----------------------------|------|--------------------------------------------|
| POST   | /upload                     | Yes  | Multipart upload, OCR, create receipt      |
| GET    | /?groupId=                  | Yes  | List receipts for group (with splits)      |
| GET    | /:receiptId                 | Yes  | Receipt + items + claims + members         |
| POST   | /:receiptId/items           | Yes  | Add manual line item                       |
| PUT    | /:receiptId/items/:itemId/claims | Yes | Set which users claim an item          |
| POST   | /:receiptId/complete        | Yes  | Compute splits from claims, finalize       |
| GET    | /splits/me                  | Yes  | Current user's splits across all receipts  |

---

## 5. Receipt Upload & OCR Flow

This is the core data-ingestion pipeline.

### 5.1 Request Flow

1. **Client** (`ReceiptScanPage`) captures or selects an image, calls `api.receipts.upload(groupId, file)`.
2. **Client** sends `POST /api/receipts/upload` with:
   - `multipart/form-data`: `file` (image), `groupId`, optional `total`.
3. **Server** (`server/src/routes/receipts.ts`):
   - `requireAuth` validates JWT.
   - `multer` middleware writes file to `server/uploads/<uuid>.<ext>`.
   - Verifies user is a member of the group.
   - Calls `extractReceiptItems(fullPath)` — **OCR**.

### 5.2 OCR Implementation (TabScanner API)

`server/src/ocr.ts` uses the **TabScanner** cloud API (not Tesseract locally):

1. **Process**: `POST https://api.tabscanner.com/api/2/process` with:
   - Header: `apikey: TABSCANNER_API_KEY` (from `process.env`, loaded via `dotenv`).
   - Body: `multipart/form-data` with the image file.
2. **Response**: JSON with `token` (or `duplicateToken` if image was already processed).
3. **Wait**: Sleep ~5.5 seconds (TabScanner processes asynchronously).
4. **Poll**: `GET https://api.tabscanner.com/api/result/{token}` every 1 second, up to ~25 seconds.
5. **Parse**: When `status === 'done'`, extract `result.lineItems` — each has `descClean`, `lineTotal`, etc.
6. **Map**: Convert to `{ name, price }[]`, filtering invalid entries (empty name, bad price).

If OCR fails or times out, the route returns 422 and does **not** create a receipt (the uploaded file is deleted).

### 5.3 After OCR

- Insert `receipts` row: `id`, `group_id`, `uploaded_by`, `file_path` (e.g. `/uploads/xxx.jpg`), `total`, `status: 'pending'`.
- Insert `receipt_items` for each parsed line.
- Return receipt object to client.

---

## 6. Split Computation Algorithm

When the user taps "Save splits" / "Complete" (`POST /receipts/:receiptId/complete`):

### 6.1 Input

- `receipt_items`: list of `{ id, price }`.
- `item_claims`: for each item, which user IDs claim it (from `item_claims` table).

### 6.2 Algorithm

```text
userTotals = {}
for each item:
  claimers = users who claimed this item
  if claimers is empty: skip (no one owes this item)
  share = item.price / claimers.length
  for each claimer:
    userTotals[claimer] += share
```

- **Multi-claim**: If Alice and Bob both claim a $10 item, each gets $5.
- **Unclaimed items**: Items with no claims are skipped (no one is assigned that amount).

### 6.3 Output

- Delete existing `receipt_splits` for this receipt.
- Insert `receipt_splits` rows: one per `(receipt_id, user_id, amount)` where amount > 0.
- Update `receipts.status` to `'completed'`.
- Return splits to client.

---

## 7. Frontend Architecture

### 7.1 Entry Point

`src/main.tsx` renders:

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

`AuthProvider` wraps the app and provides `user`, `login`, `signup`, `logout` via React Context.

### 7.2 Routing (State-Based)

There is **no URL router**. The app uses React state:

- `pageState: { page: PageType, groupId?: string, receiptId?: string, splits?: ... }`
- `PageType`: `'home' | 'groups' | 'groupDetail' | 'receiptScan' | 'receiptItems' | 'processing' | ...`
- `setCurrentPage(pageOrState)` updates state; the correct component is conditionally rendered.

Example: `pageState.page === 'groupDetail' && pageState.groupId` → render `GroupDetailPage` with `groupId`.

### 7.3 AuthContext & Bootstrapping

On mount, `AuthContext`:

1. Reads `localStorage.getItem('tabby_access_token')`.
2. If token exists: calls `GET /api/users/me` with `Authorization: Bearer <token>`.
3. On success: sets `user` state.
4. On 401: clears token, sets `user = null`.
5. On network error: leaves `user` as-is (doesn’t clear token).

`LoginSignup` handles unauthenticated state; authenticated users see the main app.

### 7.4 API Client (`src/lib/api.ts`)

- **Base URL**: `import.meta.env.VITE_API_URL || '/api'` (default `/api` → proxied to backend).
- **Auth**: All requests (except auth) add `Authorization: Bearer <accessToken>`.
- **Credentials**: `credentials: 'include'` so cookies (refresh token) are sent.
- **401 Handling**: On 401, calls `POST /auth/refresh`, retries original request once with new token.
- **Upload**: `api.receipts.upload` uses `fetch` with `FormData`, not the generic `request()` (no JSON body).

### 7.5 Key Page Flows

| Flow              | Pages                 | API Calls                                                                 |
|-------------------|------------------------|---------------------------------------------------------------------------|
| Login             | LoginSignup            | POST /auth/login → setAccessToken, set user                               |
| List groups       | LandingPage, GroupsPage| GET /groups                                                               |
| Create group      | CreateGroupPage        | POST /groups                                                              |
| Group detail      | GroupDetailPage        | GET /groups/:id                                                           |
| Upload receipt    | ReceiptScanPage        | POST /receipts/upload (multipart)                                         |
| Split items       | ReceiptItemsPage       | GET /receipts/:id, PUT claims, POST complete                              |
| Activity          | ActivityPage           | GET /receipts/splits/me                                                   |
| Processing        | ProcessingPaymentPage  | Calls api.transactions.settle(); receives splits from navigation state    |

---

## 8. Static Assets & Uploads

- **Receipt images**: Stored in `server/uploads/`, served at `/uploads` via `express.static`.
- **Vite proxy**: `/uploads` is proxied to the backend, so the frontend requests `/uploads/xxx.jpg` and gets it from the server.
- **Build output**: Frontend builds to `build/` (Vite `build`); `index.html` references bundled JS/CSS.

---

## 9. Environment Variables

| Variable           | Where   | Purpose                                  |
|--------------------|---------|------------------------------------------|
| `TABSCANNER_API_KEY` | server | TabScanner OCR API key                   |
| `JWT_ACCESS_SECRET`  | server | Sign/verify access tokens (default dev)  |
| `JWT_REFRESH_SECRET` | server | Sign/verify refresh tokens (default dev) |
| `PORT`               | server | Server port (default 3001)               |
| `VITE_API_URL`       | client | Override API base (optional)             |

`dotenv` loads `server/.env` at server startup via `import 'dotenv/config'` in `server/src/index.ts`.

---

## 10. Error Handling

- **Server**: Global error middleware catches unhandled errors, returns `{ error: string }`, logs to console.
- **OCR timeout**: 35-second cap via `Promise.race`; on timeout, file is deleted, 422 returned.
- **Client**: API client throws on non-2xx; callers use try/catch and show user-facing messages.
- **Auth failures**: 401 triggers token refresh or logout; network errors show "Cannot reach server" message.

---

## 11. Security Notes

- Passwords hashed with bcrypt (cost 10).
- Refresh tokens hashed (SHA-256) before storage; plain token never stored.
- JWT secrets should be set via env in production.
- `requireAuth` enforces group membership for receipt/group access.
- File uploads: multer validates MIME type (PNG/JPEG), 10MB limit.

---

## 12. File Map

| Path                    | Responsibility                                      |
|-------------------------|-----------------------------------------------------|
| `server/src/index.ts`   | Express app, middleware, route mounting, dotenv     |
| `server/src/db.ts`      | SQLite connection, schema creation                  |
| `server/src/middleware/auth.ts` | JWT sign/verify, requireAuth                |
| `server/src/routes/auth.ts`     | Signup, login, refresh, logout             |
| `server/src/routes/users.ts`    | GET /me, POST payment-methods              |
| `server/src/routes/groups.ts`   | Groups CRUD, virtual cards                 |
| `server/src/routes/transactions.ts` | List, get, upload receipt, tip, claims, finalize, settle |
| `server/src/routes/receipts.ts` | Upload, list, get, items, claims, complete |
| `server/src/ocr.ts`     | TabScanner API integration                          |
| `src/contexts/AuthContext.tsx`  | Auth state, login/signup/logout            |
| `src/lib/api.ts`        | HTTP client, token attach, refresh retry            |
| `src/App.tsx`           | Page state, conditional rendering                   |
| `vite.config.ts`        | Dev server, proxy /api and /uploads                 |

---

## 13. Summary

Tabby is a vertically integrated split-payments app: React frontend with state-based routing, Express backend with JWT auth, SQLite persistence, and TabScanner for receipt OCR. The receipt flow—upload → OCR → itemization → claims → split computation—is the central business logic, with groups and virtual cards providing the social and payment context. All monetary operations are simulated; no real payment processing occurs.
