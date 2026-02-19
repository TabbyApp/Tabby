# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ React UI │──│ API Client│──│ Auth Context   │   │
│  │ (Vite)   │  │ (api.ts)  │  │ (JWT tokens)   │   │
│  └──────────┘  └─────┬─────┘  └────────────────┘   │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       │ HTTP (JSON + multipart)
                       │ /api/* proxied in dev
                       ▼
┌──────────────────────────────────────────────────────┐
│                  Express Server (:3001)               │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Auth     │  │ Route        │  │ Background    │ │
│  │Middleware│──│ Handlers     │  │ Timer (30s)   │ │
│  └──────────┘  └──────┬───────┘  └───────────────┘ │
│                       │                              │
│  ┌────────────────────┼──────────────────────────┐  │
│  │                    ▼                           │  │
│  │          PostgreSQL (pg)                      │  │
│  │          DATABASE_URL                         │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│  ┌────────────────────┼──────────────────────────┐  │
│  │              Mindee API                        │  │
│  │          (External OCR service)                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Page Management (No React Router)

Tabby uses a **custom page state manager** instead of React Router. All navigation is controlled by `App.tsx` through a `pageState` object:

```typescript
type PageState = {
  page: PageType;
  groupId?: string;
  transactionId?: string;
  receiptId?: string;
  splits?: { user_id: string; amount: number; name: string }[];
};
```

Navigation happens by calling `onNavigate(target)` which is passed as a prop to every page component.

### Persistent Tabs

Three core tabs are kept **permanently mounted** and shown/hidden with CSS (`display: contents` vs `display: none`):

- **Home** (`LandingPage`)
- **Groups** (`GroupsPage`)
- **Activity** (`ActivityPage`)

This prevents expensive remounts when switching between main tabs.

### Non-Persistent Pages

All other pages mount/unmount when navigated to/from:

- `GroupDetailPage`, `CreateGroupPage`
- `ReceiptScanPage`, `ReceiptItemsPage`, `ProcessingPaymentPage`
- `AccountPage`, `SettingsPage`, `VirtualWalletPage`, etc.

### Auth Flow

```
App Mount
    │
    ├── Show SplashScreen (3s)
    │
    ├── Check localStorage for token
    │   ├── Token exists → api.users.me() → Set user
    │   └── No token → Show LoginSignup
    │
    ├── After login/signup:
    │   ├── bank_linked? → Show Home
    │   └── !bank_linked → Users can link their bank from the Account page
    │
    └── After bank linked → Check for invite token → Join group or go Home
```

### State Management

Tabby uses **React's built-in state** (no Redux, Zustand, etc.):

| Scope | Mechanism | Example |
|-------|-----------|---------|
| Global auth | `AuthContext` (React Context) | `user`, `login()`, `logout()` |
| Page-level | `useState` + `useEffect` | Groups list, transaction data |
| Cross-page | Props via `App.tsx` | `groupId`, `theme` |
| Persistent | `localStorage` | JWT access token |
| Session | `sessionStorage` | Invite token during auth redirect |

### API Client

All HTTP calls go through `src/lib/api.ts`. The client:

1. Attaches JWT `Authorization: Bearer <token>` header
2. On 401, attempts token refresh via `/api/auth/refresh`
3. Retries the original request with the new token
4. Provides user-friendly error messages

## Backend Architecture

### Server Entry Point

`server/src/index.ts` creates an Express app with:

1. **Middleware:** CORS, cookie-parser, JSON body parser, static files
2. **Routes:** Mounted at `/api/auth`, `/api/users`, `/api/groups`, `/api/receipts`, `/api/transactions`
3. **Background Timer:** Every 30 seconds, checks for expired `PENDING_ALLOCATION` transactions and applies fallback even-split
4. **Error Handler:** Global catch-all for unhandled errors

### Route Organization

```
/api
├── /auth
│   ├── POST /signup
│   ├── POST /login
│   ├── POST /refresh
│   └── POST /logout
│
├── /users
│   ├── GET  /me
│   ├── PATCH /me
│   ├── POST /link-bank
│   └── POST /payment-methods
│
├── /groups
│   ├── GET  /                      (list groups)
│   ├── POST /                      (create group)
│   ├── GET  /:groupId              (get group)
│   ├── DELETE /:groupId            (delete group)
│   ├── POST /:groupId/leave       (leave group)
│   ├── DELETE /:groupId/members/:id (remove member)
│   ├── POST /join/:token           (join via invite)
│   ├── GET  /virtual-cards/list   (list cards)
│   └── POST /:groupId/transactions (create transaction)
│
├── /receipts
│   ├── POST /upload                (upload receipt image)
│   ├── GET  /                      (list receipts)
│   ├── GET  /splits/me             (my splits)
│   ├── GET  /:receiptId            (get receipt)
│   ├── POST /:receiptId/items      (add item)
│   ├── PUT  /:receiptId/items/:id/claims (update claims)
│   └── POST /:receiptId/complete   (complete receipt)
│
└── /transactions
    ├── GET  /                      (list transactions)
    ├── GET  /activity/me           (my activity)
    ├── GET  /:id                   (get transaction)
    ├── POST /:id/receipt           (upload receipt to tx)
    ├── PUT  /:id/subtotal          (set subtotal)
    ├── PUT  /:id/tip               (set tip)
    ├── PUT  /:id/items/:itemId/claims (update claims)
    ├── POST /:id/finalize          (finalize transaction)
    ├── POST /:id/fallback-even     (manual fallback)
    └── POST /:id/settle            (settle transaction)
```

### Authentication Middleware

Two middleware functions gate routes:

1. **`requireAuth`** — Validates JWT access token, attaches `req.user = { userId, email }`
2. **`requireBankLinked`** — Checks `users.bank_linked = 1` (used for group creation, joining)

### Database Access Pattern

PostgreSQL is accessed via the **pg** driver. There is no ORM — all queries are raw SQL using the shared `query()` helper and parameterized values (`$1`, `$2`, …). Multi-step writes use `withTransaction()` for atomicity. Connection string is in `DATABASE_URL`; migrations live in `server/migrations/*.sql`.

### OCR Pipeline

```
Upload image (multer) → Save to disk
    │
    ▼
POST image to Mindee /enqueue
    │
    ▼
Wait 5.5 seconds
    │
    ▼
Poll GET /result every 1s (max 25s)
    │
    ▼
Extract lineItems → Filter (price > 0, ≤ 99999)
    │
    ▼
Return [{name, price}] array
    │
    ▼
Create receipt_items rows in DB
```

### Background Job: Fallback Timer

Every 30 seconds, the server queries for transactions where:
- Status is `PENDING_ALLOCATION`
- `allocation_deadline_at` has passed

For each expired transaction, it:
1. Even-splits the total among all group members
2. Sets tip to $0
3. Creates allocation records
4. Updates status to `SETTLED`

## Data Flow: Complete Payment Lifecycle

```
1. User creates group
   └── POST /api/groups → creates group + virtual_card + group_member

2. Members join
   └── POST /api/groups/join/:token → adds group_member

3. Host starts transaction (via receipt upload)
   └── POST /api/groups/:id/transactions → creates transaction (PENDING_ALLOCATION)
   └── POST /api/transactions/:id/receipt → OCR → receipt + receipt_items

4a. Even Split path:
   └── Host sets tip: PUT /api/transactions/:id/tip
   └── Host confirms: POST /api/transactions/:id/finalize
       └── Creates transaction_allocations (total / members)
       └── Sets status = SETTLED

4b. Item Split path:
   └── Members claim items: PUT /api/transactions/:id/items/:itemId/claims
   └── Host reviews breakdown on group page
   └── Host sets tip: PUT /api/transactions/:id/tip
   └── Host confirms: POST /api/transactions/:id/finalize
       └── Creates transaction_allocations (per-item + proportional tip)
       └── Sets status = SETTLED

5. Settlement animation plays → Transaction archived
```

## Communication Protocol

All API communication uses:
- **JSON** for request/response bodies
- **Multipart form data** for file uploads (receipts)
- **Bearer tokens** in `Authorization` header
- **HTTP-only cookies** for refresh tokens
- **Standard HTTP status codes** (200, 400, 401, 404, 500)

Error responses follow the format:
```json
{ "error": "Human-readable error message" }
```

## Security Model

| Concern | Implementation |
|---------|---------------|
| Passwords | bcryptjs hash (10 rounds) |
| Auth tokens | JWT (15min access, 7d refresh) |
| Refresh tokens | SHA-256 hashed in DB |
| Route protection | `requireAuth` middleware |
| Bank requirement | `requireBankLinked` middleware |
| Group access | Membership check on every group operation |
| Creator permissions | `ensureCreator()` check for destructive actions |
| File uploads | Type validation (PNG/JPEG), 10MB limit |
