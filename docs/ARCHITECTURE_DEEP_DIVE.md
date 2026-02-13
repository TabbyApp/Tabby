# Tabby MVP — Deep Technical Architecture

A comprehensive, start-to-finish technical explanation of how every piece of the Tabby split-payments application works. Intended for developers and technical reviewers who need to understand the full system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Request Flow: From User Action to Database](#2-request-flow-from-user-action-to-database)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Database Schema & Data Model](#4-database-schema--data-model)
5. [API Layer — Every Endpoint](#5-api-layer--every-endpoint)
6. [Business Logic: Split Calculation](#6-business-logic-split-calculation)
7. [OCR & Receipt Processing](#7-ocr--receipt-processing)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Page Flow & State Transitions](#9-page-flow--state-transitions)
10. [Timer & Auto-Finalization](#10-timer--auto-finalization)
11. [Environment & Deployment](#11-environment--deployment)
12. [File Map & Responsibilities](#12-file-map--responsibilities)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser, Port 3000)                        │
│                                                                             │
│  React 18 + Vite 6 + TypeScript                                              │
│  └── State-based routing (no URL router)                                     │
│  └── AuthContext (user, login, signup, logout)                               │
│  └── api.ts: fetch() with JWT + auto-refresh on 401                          │
│  └── Tailwind CSS, Radix UI, motion/react                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    Vite proxy: /api → 3001, /uploads → 3001
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Node.js, Port 3001)                        │
│                                                                             │
│  Express 4.x + TypeScript (tsx watch)                                        │
│  └── cors, cookie-parser, express.json                                       │
│  └── requireAuth middleware (JWT verification)                               │
│  └── requireBankLinked middleware (group/create/transaction gating)          │
│                                                                             │
│  SQLite (better-sqlite3)                                                     │
│  └── data/tabby.db (file-based, single writer)                               │
│  └── Synchronous prepared statements                                         │
│                                                                             │
│  TabScanner API (external)                                                   │
│  └── Receipt OCR: POST process → poll result → extract line items            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Tabby Does (One Sentence)

After a group "pays" with a simulated Tabby card, Tabby forces a 15-minute split decision: either **even split** (total ÷ members + tip) or **full control** (item claiming + proportional tax/tip), then simulates settlement and records allocations in the database.

### 1.3 Key Invariants

- **Total integrity**: `sum(transaction_allocations.amount) == transactions.total` (after rounding)
- **No real money**: All monetary operations are simulated; no ACH, no card network
- **Single active transaction per group**: At most one `PENDING_ALLOCATION` transaction at a time

---

## 2. Request Flow: From User Action to Database

### 2.1 Example: User Confirms Even Split

1. **User** taps "Confirm & Pay" on `GroupDetailPage` (Even tab, creator, tip set)
2. **React** calls `handleEvenConfirm()` which:
   - `api.transactions.setTip(evenTx.id, tipAmount)` → `PUT /api/transactions/:id/tip`
   - `api.transactions.finalize(evenTx.id)` → `POST /api/transactions/:id/finalize`
   - `onNavigate({ page: 'processing', groupId, transactionId, splits })`
3. **API client** (`api.ts`):
   - Adds `Authorization: Bearer <accessToken>`
   - `credentials: 'include'` (sends refresh cookie)
   - `fetch('/api/transactions/...')` → Vite proxies to `http://localhost:3001`
4. **Server**:
   - `requireAuth` extracts JWT, verifies with `JWT_ACCESS_SECRET`, sets `req.user`
   - Route handler loads transaction, checks creator, computes allocations
   - Updates `transactions` (status=SETTLED), `transaction_allocations`, `receipts`
   - Returns `{ ok: true, allocations: [...] }`
5. **Client** navigates to `ProcessingPaymentPage` with `splits` in state
6. **ProcessingPaymentPage** shows "Processing" (2.5s), then "Success" (2s), then redirects to `groupDetail`

### 2.2 401 Refresh Flow

When access token expires:

1. Server returns 401
2. `api.ts` catches 401, calls `POST /api/auth/refresh` with `credentials: 'include'` (cookie)
3. Server reads `refreshToken` from cookie, verifies JWT, checks `refresh_tokens` table
4. Server returns new `accessToken`
5. Client stores it, retries original request

---

## 3. Authentication & Authorization

### 3.1 Token Model

| Token   | Storage           | Lifetime | Purpose                          |
|--------|-------------------|----------|----------------------------------|
| Access | localStorage      | 15 min   | `Authorization: Bearer <token>`  |
| Refresh| httpOnly cookie   | 7 days   | Silent refresh when access expires |

Access is short-lived to limit XSS exposure; refresh is httpOnly so JavaScript cannot read it.

### 3.2 Auth Endpoints

| Method | Path      | Body                    | Response                    |
|--------|-----------|-------------------------|-----------------------------|
| POST   | /signup   | email, password, name   | accessToken, user           |
| POST   | /login    | email, password         | accessToken, user           |
| POST   | /refresh  | (cookie)                | accessToken                 |
| POST   | /logout   | —                       | ok (clears cookie)          |

### 3.3 Middleware

- **requireAuth**: Reads `Authorization` header, verifies JWT, sets `req.user = { userId, email }`. Returns 401 if missing/invalid.
- **requireBankLinked**: Must run after requireAuth. Queries `users.bank_linked`; returns 403 if false. Used for `POST /groups`, `POST /groups/:id/transactions`.

### 3.4 Database: Auth Tables

- **users**: id, email (unique), password_hash (bcrypt), name, bank_linked (0/1)
- **refresh_tokens**: id, user_id, token_hash (SHA-256 of token), expires_at

---

## 4. Database Schema & Data Model

### 4.1 Entity Relationship Diagram

```
users
  ├── refresh_tokens (1:N)
  ├── payment_methods (1:N, mock)
  └── group_members (N:M with groups)

groups
  ├── group_members (N:M with users)
  ├── virtual_cards (1:1, simulated card)
  └── transactions (1:N)

transactions
  ├── transaction_allocations (1:N, final per-user amounts)
  └── receipts (0..1 via transaction_id)

receipts
  ├── receipt_items (1:N, line items from OCR)
  ├── item_claims (N:M receipt_items ↔ users)
  └── receipt_splits (1:N, legacy; transaction flow uses transaction_allocations)
```

### 4.2 Table Definitions (Exact Schema)

**users**
- id (TEXT PK, UUID)
- email (TEXT UNIQUE)
- password_hash (TEXT, bcrypt)
- name (TEXT)
- bank_linked (INTEGER DEFAULT 0)
- created_at (TEXT, datetime)

**groups**
- id (TEXT PK)
- name (TEXT)
- created_by (FK users)
- created_at (TEXT)

**group_members**
- (group_id, user_id) composite PK
- joined_at (TEXT)

**virtual_cards**
- id (TEXT PK)
- group_id (TEXT UNIQUE FK)
- card_number_last_four (TEXT, e.g. "3666")
- created_at (TEXT)

**transactions**
- id (TEXT PK)
- group_id (FK)
- created_by (FK users)
- status: `PENDING_ALLOCATION` | `SETTLED` | (FINALIZED, SETTLEMENT_PENDING, SETTLEMENT_FAILED, CANCELLED in spec but currently shortcut to SETTLED)
- split_mode: `EVEN_SPLIT` | `FULL_CONTROL`
- tip_amount (REAL)
- subtotal (REAL, from receipt OCR for EVEN; from items for FULL)
- total (REAL, subtotal + tip)
- allocation_deadline_at (TEXT, created_at + 15 min)
- created_at, finalized_at, settled_at, archived_at (TEXT)

**transaction_allocations**
- id (TEXT PK)
- transaction_id (FK)
- user_id (FK)
- amount (REAL)
- created_at (TEXT)
- UNIQUE(transaction_id, user_id)

**receipts**
- id (TEXT PK)
- group_id (FK)
- uploaded_by (FK users)
- file_path (TEXT, e.g. /uploads/uuid.jpg)
- total (REAL)
- status (TEXT: pending | completed)
- transaction_id (TEXT, nullable, FK transactions)
- created_at (TEXT)

**receipt_items**
- id (TEXT PK)
- receipt_id (FK)
- name (TEXT)
- price (REAL)
- sort_order (INTEGER)

**item_claims**
- (receipt_item_id, user_id) composite PK
- Multi-claim allowed: multiple users can claim the same item

**receipt_splits** (legacy, used for non-transaction receipts)
- id, receipt_id, user_id, amount, status, created_at

### 4.3 Access Patterns

- **Find active transaction**: `SELECT * FROM transactions WHERE group_id = ? AND status = 'PENDING_ALLOCATION' ORDER BY created_at DESC LIMIT 1`
- **Expired transactions**: `WHERE status = 'PENDING_ALLOCATION' AND datetime(allocation_deadline_at) <= datetime('now')`
- **User's allocations**: `JOIN transaction_allocations ON ... WHERE ta.user_id = ?`
- **Receipt splits for transaction**: If `receipt.transaction_id` is set, splits come from `transaction_allocations`; else from `receipt_splits`

---

## 5. API Layer — Every Endpoint

### 5.1 Auth (`/api/auth`)

| Method | Path    | Auth | Description |
|--------|---------|------|-------------|
| POST   | /signup | No   | Create user, bcrypt hash, insert users + refresh_tokens, set cookie, return accessToken |
| POST   | /login  | No   | Lookup user, bcrypt.compare, same as signup |
| POST   | /refresh| Cookie | Verify refresh JWT, lookup refresh_tokens by hash, return new accessToken |
| POST   | /logout | No   | Delete refresh_tokens by hash, clear cookie |

### 5.2 Users (`/api/users`)

| Method | Path             | Auth | Description |
|--------|------------------|------|-------------|
| GET    | /me              | Yes  | Return user + payment_methods (mock) |
| POST   | /link-bank       | Yes  | Stub: SET bank_linked=1 |
| POST   | /payment-methods | Yes  | Add mock payment method |

### 5.3 Groups (`/api/groups`)

| Method | Path                    | Auth | Description |
|--------|-------------------------|------|-------------|
| GET    | /                       | Yes  | List groups user is in (with member count, card last4) |
| POST   | /                       | Yes, BankLinked | Create group, members, virtual_card in transaction |
| GET    | /:groupId               | Yes  | Group details + members (membership checked) |
| GET    | /virtual-cards/list     | Yes  | User's groups with card + total spent |
| POST   | /:groupId/transactions  | Yes, BankLinked | Create transaction, set 15-min deadline (creator only) |

**POST /:groupId/transactions** body: `{ splitMode: 'EVEN_SPLIT' | 'FULL_CONTROL' }`

### 5.4 Transactions (`/api/transactions`)

| Method | Path                      | Auth | Description |
|--------|---------------------------|------|-------------|
| GET    | /?groupId=                | Yes  | List transactions for group |
| GET    | /activity/me              | Yes  | User's allocations across transactions (for History) |
| GET    | /:id                      | Yes  | Full transaction + items, claims, members, allocations |
| POST   | /:id/receipt              | Yes  | Multipart upload, OCR, create receipt + items, link to transaction |
| PUT    | /:id/tip                  | Yes  | Set tip_amount (creator only) |
| PUT    | /:id/items/:itemId/claims | Yes  | Set claimers for item (FULL_CONTROL) |
| POST   | /:id/finalize             | Yes  | Compute allocations, write to DB, set SETTLED |
| POST   | /:id/fallback-even        | Yes  | If expired, run even-split fallback |
| POST   | /:id/settle               | Yes  | Mark SETTLED (used when flow goes FINALIZED→SETTLED; current finalize does both) |

### 5.5 Receipts (`/api/receipts`)

| Method | Path                          | Auth | Description |
|--------|-------------------------------|------|-------------|
| POST   | /upload                       | Yes  | Legacy: multipart + OCR, create receipt (no transaction) |
| GET    | /?groupId=                    | Yes  | List receipts for group (with splits from transaction_allocations or receipt_splits) |
| GET    | /:receiptId                   | Yes  | Receipt + items + claims + members |
| POST   | /:receiptId/items             | Yes  | Add manual line item |
| PUT    | /:receiptId/items/:itemId/claims | Yes | Set claims (legacy) |
| POST   | /:receiptId/complete          | Yes  | Legacy: compute receipt_splits from claims |
| GET    | /splits/me                    | Yes  | User's receipt_splits (legacy) |

**Note**: The transaction-centric flow uses `POST /transactions/:id/receipt` and `PUT /transactions/:id/items/:itemId/claims`, not the legacy receipts endpoints.

---

## 6. Business Logic: Split Calculation

### 6.1 EVEN_SPLIT

```
subtotal = transaction.subtotal  (from receipt OCR)
total = subtotal + tip_amount
perPerson = total / memberCount
rounded[i] = round(perPerson, 2)
diff = total - sum(rounded)  // rounding remainder
rounded[0] += diff           // give pennies to first member
allocations = memberIds.map((uid, i) => ({ user_id: uid, amount: rounded[i] }))
```

### 6.2 FULL_CONTROL

1. **Item subtotals per user**:
   - For each item: claimers = users in item_claims for that item
   - If claimers empty: add item.price to unclaimedTotal
   - Else: share = item.price / claimers.length; add share to each claimer's userTotal
2. **Unclaimed items**: Split unclaimedTotal evenly among all members
3. **Proportional tip**: tipRatio = tip / sum(userTotals); for each user: userTotal += userTotal * tipRatio
4. **Rounding**: Adjust first user by diff so sum(allocations) == total

### 6.3 Fallback (Timer Expired)

When `allocation_deadline_at <= now` and status is PENDING_ALLOCATION:

- tip = 0
- total = subtotal (or 0 if no receipt; then perPerson = 0)
- Same even-split rounding as above
- Status → SETTLED, allocations written

---

## 7. OCR & Receipt Processing

### 7.1 TabScanner Flow

1. **Process**: `POST https://api.tabscanner.com/api/2/process` with `apikey` header and multipart image
2. **Response**: `{ token }` (or duplicateToken)
3. **Wait**: 5.5 seconds
4. **Poll**: `GET https://api.tabscanner.com/api/result/{token}` every 1s, up to 25s
5. **Parse**: When status=done, extract `result.lineItems` → `{ descClean, lineTotal }` → `{ name, price }[]`
6. **Filter**: Skip empty names, invalid prices, names > 120 chars

### 7.2 Transaction Receipt Upload

`POST /transactions/:id/receipt`:

1. Verify transaction exists, user is member, status is PENDING_ALLOCATION
2. Multer saves file to `server/uploads/<uuid>.<ext>`
3. Call `extractReceiptItems(fullPath)` (OCR)
4. Insert receipts row (with transaction_id)
5. Insert receipt_items for each parsed line
6. Update transactions: subtotal = sum(items.price), total = subtotal (tip added later)

### 7.3 Environment

- `TABSCANNER_API_KEY` must be set in `server/.env` or OCR will throw

---

## 8. Frontend Architecture

### 8.1 Entry & Auth Gating

```
main.tsx → AuthProvider → App
App:
  showSplash? → SplashScreen
  !isAuthenticated → LoginSignup
  !user.bank_linked → LinkBankPage
  else → Main app (pages)
```

### 8.2 State-Based Routing

- `pageState: { page: PageType, groupId?, transactionId?, receiptId?, splits? }`
- `setCurrentPage(pageOrState)` updates state
- No URL; all navigation is via state
- Conditional render: `pageState.page === 'groupDetail' && pageState.groupId` → `<GroupDetailPage groupId={...} />`

### 8.3 API Client Behavior

- Base: `import.meta.env.VITE_API_URL || '/api'`
- All requests: `Authorization: Bearer <token>`, `credentials: 'include'`
- 401 → refresh → retry once
- Uploads use `fetch` + FormData, not the generic `request()`

---

## 9. Page Flow & State Transitions

### 9.1 Main Flow Map

```
LoginSignup ──login──► LandingPage
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         GroupsPage   CreateGroupPage   ActivityPage
              │             │
              │ create ─────┘
              ▼
         GroupDetailPage (groupId)
              │
              │ splitMode: EVEN_SPLIT | FULL_CONTROL (toggle)
              │
              ├── EVEN: Upload Receipt → (OCR) → Tip slider → Confirm & Pay
              │         └── api.transactions.create(EVEN_SPLIT) if no activeTx
              │         └── api.transactions.uploadReceipt
              │         └── api.transactions.setTip + finalize
              │         └── onNavigate(processing, splits)
              │
              └── FULL: Upload Receipt → (OCR) → receiptItems
                        └── api.transactions.create(FULL_CONTROL) if no activeTx
                        └── api.transactions.uploadReceipt
                        └── onNavigate(receiptItems, receiptId, transactionId)
                             │
                             └── Claim items → Confirm (creator)
                                    └── api.transactions.finalize
                                    └── onNavigate(processing, splits)

ProcessingPaymentPage
  └── 2.5s "Processing" → 2s "Success" → onNavigate(groupDetail)
```

### 9.2 PageState Schema

```ts
type PageState = {
  page: 'home' | 'groups' | 'groupDetail' | 'activity' | 'create' | 'account' | 'settings' |
        'wallet' | 'cardDetails' | 'createGroup' | 'linkBank' | 'receiptScan' | 'receiptItems' |
        'processing' | 'transactionAllocation';
  groupId?: string;
  transactionId?: string;
  receiptId?: string;
  splits?: { user_id: string; amount: number; name: string }[];
};
```

### 9.3 Key Page Responsibilities

| Page                | Loads                           | Actions                                               |
|---------------------|----------------------------------|-------------------------------------------------------|
| GroupDetailPage     | group, receipts, transactions    | Toggle Even/Item, upload receipt, set tip, confirm    |
| ReceiptItemsPage    | transaction or receipt           | Toggle claims, confirm (creator)                      |
| ProcessingPaymentPage | splits from nav state          | Animate, redirect to groupDetail                      |
| ActivityPage        | transactions.activity/me         | History of user's allocations                         |

---

## 10. Timer & Auto-Finalization

### 10.1 Implementation

- **On transaction create**: `allocation_deadline_at = now + 15 minutes`
- **Background job**: `setInterval` every 30 seconds in `server/src/index.ts`
- **Query**: `SELECT id FROM transactions WHERE status = 'PENDING_ALLOCATION' AND datetime(allocation_deadline_at) <= datetime('now')`
- **Action**: For each row, call `runFallbackForTransaction(id)` → even split with tip=0, SETTLED

### 10.2 Fallback Logic

- If no receipt (subtotal=0): total=0, everyone gets 0
- If receipt exists: total=subtotal, split evenly, rounding to first user

---

## 11. Environment & Deployment

### 11.1 Server (`.env`)

| Variable            | Purpose                          |
|---------------------|-----------------------------------|
| TABSCANNER_API_KEY  | TabScanner OCR                    |
| JWT_ACCESS_SECRET   | Sign/verify access tokens         |
| JWT_REFRESH_SECRET  | Sign/verify refresh tokens        |
| PORT                | Server port (default 3001)        |

### 11.2 Client

| Variable      | Purpose                    |
|---------------|----------------------------|
| VITE_API_URL  | Override API base (optional) |

### 11.3 Proxy (Vite Dev)

- `/api` → `http://localhost:3001`
- `/uploads` → `http://localhost:3001`

---

## 12. File Map & Responsibilities

| Path | Responsibility |
|------|----------------|
| `server/src/index.ts` | Express app, middleware, routes, timer job, dotenv |
| `server/src/db.ts` | SQLite connection, schema (CREATE TABLE, ALTER) |
| `server/src/middleware/auth.ts` | JWT sign/verify, requireAuth, requireBankLinked |
| `server/src/routes/auth.ts` | Signup, login, refresh, logout |
| `server/src/routes/users.ts` | GET /me, link-bank, payment-methods |
| `server/src/routes/groups.ts` | Groups CRUD, virtual cards, create transaction |
| `server/src/routes/transactions.ts` | List, get, upload receipt, tip, claims, finalize, fallback, settle |
| `server/src/routes/receipts.ts` | Legacy upload, list, get, items, claims, complete; receipts list includes transaction-linked |
| `server/src/ocr.ts` | TabScanner process + poll, map to { name, price }[] |
| `src/contexts/AuthContext.tsx` | user state, login, signup, logout, bootstrap from token |
| `src/lib/api.ts` | request(), refresh on 401, all API methods |
| `src/App.tsx` | pageState, conditional page render, auth gating |
| `src/components/GroupDetailPage.tsx` | Group detail, Even/Item toggle, receipt upload, tip, confirm |
| `src/components/ReceiptItemsPage.tsx` | Item list, claim toggles, confirm |
| `src/components/ProcessingPaymentPage.tsx` | Processing + success animation, redirect |
| `vite.config.ts` | Proxy, build config |

---

## Summary

Tabby is a **transaction-centric split-payments MVP**. The canonical flow is: create group → creator starts transaction (EVEN or FULL) → 15-minute window → receipt upload (OCR) → tip (EVEN) or item claims (FULL) → creator confirms → allocations computed → simulated settlement → SETTLED. The database stores users, groups, transactions, receipts, items, claims, and allocations. All monetary operations are simulated. The frontend uses state-based routing and JWT + refresh for auth.
