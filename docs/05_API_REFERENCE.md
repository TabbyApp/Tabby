# API Reference

Base URL: `http://localhost:3001/api` (dev) or `/api` (proxied via Vite)

## Authentication

Most endpoints require a JWT access token:

```
Authorization: Bearer <access_token>
```

Tokens expire after **15 minutes**. Use the refresh endpoint to get a new one.

---

## Auth Endpoints

### POST `/auth/signup`

Create a new account.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "Jane Doe"
}
```

**Validation:**
- `email` — required, normalized to lowercase
- `password` — required, minimum 6 characters
- `name` — required

**Response (200):**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}
```

**Cookies Set:** `refreshToken` (httpOnly, 7 day expiry)

**Errors:**
- `400` — Missing fields, password too short
- `409` — Email already registered

---

### POST `/auth/login`

Log in to an existing account.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):** Same as signup

**Errors:**
- `400` — Missing fields
- `401` — Invalid email or password

---

### POST `/auth/refresh`

Get a new access token using the refresh token.

**Auth Required:** No (uses cookie)

**Request:** Reads `refreshToken` from cookie, or from body:
```json
{ "refreshToken": "token_string" }
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 900
}
```

**Errors:**
- `401` — Missing, expired, or invalid refresh token

---

### POST `/auth/logout`

Invalidate the current refresh token.

**Auth Required:** No (uses cookie)

**Response (200):**
```json
{ "ok": true }
```

**Cookies Cleared:** `refreshToken`

---

## User Endpoints

### GET `/users/me`

Get the current user's profile.

**Auth Required:** Yes

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "phone": "555-1234",
  "created_at": "2026-01-15T10:30:00.000Z",
  "bank_linked": true,
  "paymentMethods": [
    {
      "id": "uuid",
      "type": "bank",
      "last_four": "4567",
      "brand": null,
      "created_at": "2026-01-15T10:31:00.000Z"
    }
  ]
}
```

---

### PATCH `/users/me`

Update the current user's profile.

**Auth Required:** Yes

**Request Body** (all fields optional):
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-9876"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "jane@example.com",
  "name": "Jane Smith",
  "phone": "555-9876"
}
```

**Errors:**
- `409` — Email already taken by another user

---

### POST `/users/link-bank`

Simulate linking a bank account. Sets `bank_linked = true` and creates a mock payment method.

**Auth Required:** Yes

**Response (200):**
```json
{
  "ok": true,
  "bank_linked": true
}
```

---

### POST `/users/payment-methods`

Add a payment method.

**Auth Required:** Yes

**Request Body:**
```json
{
  "type": "card",
  "lastFour": "4242",
  "brand": "Visa"
}
```

**Validation:**
- `type` — `'bank'` or `'card'`
- `lastFour` — exactly 4 digits
- `brand` — required for cards

**Response (200):**
```json
{
  "id": "uuid",
  "type": "card",
  "last_four": "4242",
  "brand": "Visa"
}
```

---

## Group Endpoints

### GET `/groups`

List the current user's groups.

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Dinner Squad",
    "memberCount": 4,
    "cardLastFour": "7823",
    "createdAt": "2026-02-01T18:00:00.000Z"
  }
]
```

---

### POST `/groups`

Create a new group.

**Auth Required:** Yes (+ bank linked)

**Request Body:**
```json
{
  "name": "Dinner Squad",
  "memberEmails": ["friend@example.com"]
}
```

`memberEmails` is optional. Listed users are auto-added if they exist in the system.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Dinner Squad",
  "memberCount": 2,
  "cardLastFour": "7823"
}
```

**Side Effects:**
- Creates a `virtual_cards` record
- Generates an `invite_token`
- Adds creator to `group_members`
- Adds any found `memberEmails` to `group_members`

---

### GET `/groups/:groupId`

Get group details with members.

**Auth Required:** Yes (must be a member)

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Dinner Squad",
  "created_by": "user-uuid",
  "created_at": "2026-02-01T18:00:00.000Z",
  "cardLastFour": "7823",
  "inviteToken": "a1b2c3d4e5f6...",
  "supportCode": "494VQD",
  "lastSettledAt": null,
  "lastSettledAllocations": [],
  "splitModePreference": "item",
  "members": [
    { "id": "user-uuid", "name": "Jane Doe", "email": "jane@example.com", "avatarUrl": "/uploads/avatars/..." }
  ]
}
```

`splitModePreference` is the host's chosen split mode for the group: `"even"` or `"item"`. All members see this value; it is synced when the host changes the toggle. Batch endpoint `GET /groups/batch?ids=...` also returns `splitModePreference` per group.

---

### PATCH `/groups/:groupId` or PUT `/groups/:groupId`

Update group settings (host only). Used to sync the host's split mode so all members see the same option.

**Auth Required:** Yes (must be the group host/creator)

**Request Body:**
```json
{
  "splitModePreference": "even"
}
```

- `splitModePreference` — optional; `"even"` or `"item"`

**Response (200):**
```json
{ "ok": true }
```

**Errors:**
- `403` — Not the group host
- `404` — Group not found
- `400` — Invalid `splitModePreference` (must be `"even"` or `"item"`)

PUT is supported as well as PATCH for proxy compatibility.

---

### POST `/groups/join/:token`

Join a group via invite token.

**Auth Required:** Yes (+ bank linked)

**Response (200):**
```json
{
  "groupId": "uuid",
  "groupName": "Dinner Squad",
  "joined": true
}
```

**Errors:**
- `404` — Invalid invite token
- `200` with `joined: false` — Already a member

---

### DELETE `/groups/:groupId`

Delete a group and all associated data.

**Auth Required:** Yes (must be the host/creator)

**Cascade Deletes:** receipts → items → claims → splits, transactions → allocations, virtual cards, members

**Response (200):**
```json
{ "ok": true }
```

---

### POST `/groups/:groupId/leave`

Leave a group.

**Auth Required:** Yes (must be a member, cannot be the host)

**Response (200):**
```json
{ "ok": true }
```

---

### DELETE `/groups/:groupId/members/:memberId`

Remove a member from a group.

**Auth Required:** Yes (must be the host)

**Response (200):**
```json
{ "ok": true }
```

---

### GET `/groups/virtual-cards/list`

List all virtual cards for the user's groups.

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "groupId": "uuid",
    "groupName": "Dinner Squad",
    "cardLastFour": "7823",
    "groupTotal": 156.50,
    "active": true
  }
]
```

---

### POST `/groups/:groupId/transactions`

Create a new transaction for a group.

**Auth Required:** Yes (+ bank linked, must be the group creator)

**Request Body:**
```json
{
  "splitMode": "EVEN_SPLIT"
}
```

Values: `"EVEN_SPLIT"` or `"FULL_CONTROL"`

**Response (200):**
```json
{
  "id": "uuid",
  "group_id": "group-uuid",
  "status": "PENDING_ALLOCATION",
  "split_mode": "EVEN_SPLIT",
  "tip_amount": 0,
  "allocation_deadline_at": "2026-02-01T18:15:00.000Z"
}
```

---

## Receipt Endpoints

### POST `/receipts/upload`

Upload a receipt image for OCR processing.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` — Image file (PNG/JPEG, max 10MB)
- `groupId` — Group ID

Receipt total is taken from OCR (or item sum); manual total override is not allowed to avoid fraud.

**Response (200):**
```json
{
  "id": "receipt-uuid",
  "group_id": "group-uuid",
  "status": "pending",
  "total": 45.67,
  "items": [
    { "id": "item-uuid", "name": "Burger", "price": 15.99 },
    { "id": "item-uuid", "name": "Fries", "price": 5.99 }
  ]
}
```

**Note:** OCR has a 35-second timeout. The image is deleted on failure.

---

### GET `/receipts?groupId=<id>`

List receipts for a group with splits.

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "id": "receipt-uuid",
    "group_id": "group-uuid",
    "status": "completed",
    "total": 45.67,
    "created_at": "2026-02-01T18:05:00.000Z",
    "transaction_id": "tx-uuid",
    "splits": [
      { "user_id": "uuid", "amount": 22.83, "status": "settled", "name": "Jane" }
    ]
  }
]
```

---

### GET `/receipts/:receiptId`

Get receipt with items, claims, and group members.

**Auth Required:** Yes

**Response (200):**
```json
{
  "id": "receipt-uuid",
  "group_id": "group-uuid",
  "items": [
    { "id": "item-uuid", "name": "Burger", "price": 15.99, "sort_order": 0 }
  ],
  "claims": {
    "item-uuid": ["user-uuid-1", "user-uuid-2"]
  },
  "members": [
    { "id": "user-uuid-1", "name": "Jane", "email": "jane@example.com" }
  ]
}
```

---

### POST `/receipts/:receiptId/items`

Add an item to a receipt manually.

**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "Extra sauce",
  "price": 1.50
}
```

**Response (200):**
```json
{ "id": "item-uuid", "name": "Extra sauce", "price": 1.50 }
```

---

### PUT `/receipts/:receiptId/items/:itemId/claims`

Update who claimed an item.

**Auth Required:** Yes

**Request Body:**
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"]
}
```

**Response (200):**
```json
{ "userIds": ["user-uuid-1", "user-uuid-2"] }
```

---

### POST `/receipts/:receiptId/complete`

Complete receipt splitting and calculate final amounts.

**Auth Required:** Yes

**Response (200):**
```json
{
  "ok": true,
  "splits": [
    { "user_id": "uuid", "amount": 22.83, "name": "Jane" }
  ]
}
```

---

### GET `/receipts/splits/me`

Get the current user's receipt splits (last 50).

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "id": "split-uuid",
    "receipt_id": "receipt-uuid",
    "amount": 22.83,
    "status": "pending",
    "created_at": "2026-02-01T18:10:00.000Z",
    "group_id": "group-uuid",
    "group_name": "Dinner Squad"
  }
]
```

---

## Transaction Endpoints

### GET `/transactions?groupId=<id>`

List transactions for a group.

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "id": "tx-uuid",
    "status": "PENDING_ALLOCATION",
    "split_mode": "EVEN_SPLIT",
    "tip_amount": 5.00,
    "subtotal": 45.67,
    "allocation_deadline_at": "2026-02-01T18:15:00.000Z",
    "created_at": "2026-02-01T18:00:00.000Z",
    "receipt_id": "receipt-uuid"
  }
]
```

---

### GET `/transactions/:id`

Get full transaction details including items, claims, members, and allocations.

**Auth Required:** Yes

**Response (200):**
```json
{
  "id": "tx-uuid",
  "group_id": "group-uuid",
  "created_by": "user-uuid",
  "status": "PENDING_ALLOCATION",
  "split_mode": "FULL_CONTROL",
  "tip_amount": 5.00,
  "subtotal": 45.67,
  "total": 50.67,
  "allocation_deadline_at": "2026-02-01T18:15:00.000Z",
  "receipt_id": "receipt-uuid",
  "items": [
    { "id": "item-uuid", "name": "Burger", "price": 15.99 }
  ],
  "claims": {
    "item-uuid": ["user-uuid-1"]
  },
  "members": [
    { "id": "user-uuid-1", "name": "Jane", "email": "jane@example.com" }
  ],
  "allocations": [
    { "user_id": "user-uuid-1", "amount": 25.33 }
  ]
}
```

---

### POST `/transactions/:id/receipt`

Upload a receipt to a transaction.

**Auth Required:** Yes (must be group member)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` — Image file (PNG/JPEG, max 10MB)

**Response (200):**
```json
{
  "receipt_id": "receipt-uuid",
  "items": [
    { "id": "item-uuid", "name": "Burger", "price": 15.99 }
  ],
  "subtotal": 45.67
}
```

---

### PUT `/transactions/:id/subtotal`

Manually set the transaction subtotal (EVEN_SPLIT only, no receipt).

**Auth Required:** Yes (creator only)

**Request Body:**
```json
{ "subtotal": 45.67 }
```

**Response (200):**
```json
{ "subtotal": 45.67, "total": 50.67 }
```

---

### PUT `/transactions/:id/tip`

Set the tip amount.

**Auth Required:** Yes (creator only)

**Request Body:**
```json
{ "tipAmount": 8.50 }
```

**Response (200):**
```json
{ "tip_amount": 8.50, "subtotal": 45.67, "total": 54.17 }
```

---

### PUT `/transactions/:id/items/:itemId/claims`

Update who claimed a specific item (for FULL_CONTROL mode).

**Auth Required:** Yes (must be group member)

**Request Body:**
```json
{ "userIds": ["user-uuid-1", "user-uuid-2"] }
```

**Response (200):**
```json
{ "userIds": ["user-uuid-1", "user-uuid-2"] }
```

---

### POST `/transactions/:id/finalize`

Finalize the transaction — calculate allocations and settle.

**Auth Required:** Yes (creator only)

**Split Calculation:**
- **EVEN_SPLIT:** `(subtotal + tip) / memberCount`, penny-rounded
- **FULL_CONTROL:** Per-item shares based on claims + proportional tip. Unclaimed items are auto-split evenly among all members.

**Response (200):**
```json
{
  "ok": true,
  "allocations": [
    { "user_id": "uuid", "amount": 25.33, "name": "Jane" },
    { "user_id": "uuid", "amount": 25.34, "name": "John" }
  ],
  "status": "SETTLED"
}
```

**Side Effects:**
- Creates `transaction_allocations` records
- Sets `status = 'SETTLED'`
- Sets `finalized_at`, `settled_at`, `archived_at` timestamps
- Updates receipt status to `'completed'`

---

### POST `/transactions/:id/fallback-even`

Manually trigger the fallback even-split for an expired transaction.

**Auth Required:** Yes

**Response (200):**
```json
{ "ok": true }
```

---

### POST `/transactions/:id/settle`

Settle a finalized transaction (if status is `FINALIZED`).

**Auth Required:** Yes

**Response (200):**
```json
{
  "ok": true,
  "status": "SETTLED",
  "allocations": [
    { "user_id": "uuid", "amount": 25.33, "name": "Jane" }
  ]
}
```

---

### GET `/transactions/activity/me`

Get the current user's transaction activity (last 50).

**Auth Required:** Yes

**Response (200):**
```json
[
  {
    "id": "allocation-uuid",
    "transaction_id": "tx-uuid",
    "amount": 25.33,
    "group_id": "group-uuid",
    "status": "SETTLED",
    "created_at": "2026-02-01T18:00:00.000Z",
    "settled_at": "2026-02-01T18:12:00.000Z",
    "group_name": "Dinner Squad"
  }
]
```
