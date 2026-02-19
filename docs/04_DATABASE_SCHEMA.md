# Database Schema

Tabby uses **PostgreSQL**. The server connects via `DATABASE_URL` (see `server/.env.example`). Schema is applied through **migrations** in `server/migrations/*.sql`; run `cd server && npm run migrate` to apply them. Tables are created by the first migration; later migrations add columns (e.g. `split_mode_preference` on `groups`).

## Entity Relationship Diagram

```
users ──────────┬──── refresh_tokens
                │
                ├──── payment_methods
                │
                ├──── group_members ────── groups ──── virtual_cards
                │                            │
                │                            ├──── transactions ──── transaction_allocations
                │                            │         │
                │                            └──── receipts ──── receipt_items ──── item_claims
                │                                       │
                │                                       └──── receipt_splits
                │
                └──── (item_claims, receipt_splits, transaction_allocations)
```

## Tables

### `users`

Stores registered user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `email` | TEXT | UNIQUE, NOT NULL | User email (lowercase) |
| `password_hash` | TEXT | NOT NULL | bcryptjs hash |
| `name` | TEXT | NOT NULL | Display name |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |
| `bank_linked` | INTEGER | DEFAULT 0 | 0 = not linked, 1 = linked (migration-added) |
| `phone` | TEXT | DEFAULT '' | Phone number (migration-added) |

---

### `refresh_tokens`

Stores hashed refresh tokens for JWT authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | NOT NULL, FK → users.id | Token owner |
| `token_hash` | TEXT | NOT NULL | SHA-256 hash of the refresh token |
| `expires_at` | TEXT | NOT NULL | ISO 8601 expiry (7 days from creation) |

---

### `payment_methods`

Mock payment methods (bank accounts, cards).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | NOT NULL, FK → users.id | Owner |
| `type` | TEXT | NOT NULL | `'bank'` or `'card'` |
| `last_four` | TEXT | NOT NULL | Last 4 digits |
| `brand` | TEXT | | Card brand (Visa, etc.) |
| `masked_data` | TEXT | | Optional masked data |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |

---

### `groups`

Payment session groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `name` | TEXT | NOT NULL | Group name (e.g., "Dinner at Nobu") |
| `created_by` | TEXT | NOT NULL, FK → users.id | Host user ID |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |
| `invite_token` | TEXT | | 24-char hex string for invite links (migration-added) |
| `split_mode_preference` | TEXT | NOT NULL, DEFAULT 'item' | Host's split mode: `'even'` or `'item'` (migration 005) |

---

### `group_members`

Many-to-many: users ↔ groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `group_id` | TEXT | PK, FK → groups.id | Group |
| `user_id` | TEXT | PK, FK → users.id | Member |
| `joined_at` | TEXT | DEFAULT now | ISO 8601 timestamp |

**Primary Key:** Composite (`group_id`, `user_id`)

---

### `virtual_cards`

One virtual card per group (mock).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `group_id` | TEXT | UNIQUE, FK → groups.id | Associated group |
| `card_number_last_four` | TEXT | NOT NULL | 4-digit random number |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |

---

### `transactions`

Core payment transaction record. One active transaction per group at a time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `group_id` | TEXT | NOT NULL, FK → groups.id | Parent group |
| `created_by` | TEXT | NOT NULL, FK → users.id | Transaction creator (host) |
| `status` | TEXT | NOT NULL, DEFAULT 'PENDING_ALLOCATION' | See status enum below |
| `split_mode` | TEXT | NOT NULL | `'EVEN_SPLIT'` or `'FULL_CONTROL'` |
| `tip_amount` | REAL | DEFAULT 0 | Tip in dollars |
| `subtotal` | REAL | | Receipt subtotal |
| `total` | REAL | | subtotal + tip |
| `allocation_deadline_at` | TEXT | | 15 minutes from creation |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |
| `finalized_at` | TEXT | | When confirmed |
| `settled_at` | TEXT | | When settled |
| `archived_at` | TEXT | | When archived |

**Transaction Statuses:**

| Status | Meaning |
|--------|---------|
| `PENDING_ALLOCATION` | Active — waiting for receipt, claims, or confirmation |
| `FINALIZED` | Confirmed but not yet settled (currently unused — goes straight to SETTLED) |
| `SETTLED` | Payment complete, allocations locked |

---

### `transaction_allocations`

How much each member owes for a settled transaction.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `transaction_id` | TEXT | NOT NULL, FK → transactions.id | Parent transaction |
| `user_id` | TEXT | NOT NULL, FK → users.id | Member |
| `amount` | REAL | NOT NULL | Amount this user owes |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |

**Unique Constraint:** (`transaction_id`, `user_id`)

---

### `receipts`

Uploaded receipt images and their processing results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `group_id` | TEXT | NOT NULL, FK → groups.id | Parent group |
| `uploaded_by` | TEXT | NOT NULL, FK → users.id | Uploader |
| `file_path` | TEXT | NOT NULL | Path to image file |
| `total` | REAL | | Total amount (from OCR or manual) |
| `status` | TEXT | DEFAULT 'pending' | `'pending'` or `'completed'` |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |
| `transaction_id` | TEXT | | FK → transactions.id (migration-added) |

---

### `receipt_items`

Individual line items extracted from a receipt.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `receipt_id` | TEXT | NOT NULL, FK → receipts.id | Parent receipt |
| `name` | TEXT | NOT NULL | Item name |
| `price` | REAL | NOT NULL | Item price |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |

---

### `item_claims`

Who is responsible for each receipt item. Multiple users can claim the same item (split).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `receipt_item_id` | TEXT | PK, FK → receipt_items.id | Item |
| `user_id` | TEXT | PK, FK → users.id | Claimer |

**Primary Key:** Composite (`receipt_item_id`, `user_id`)

---

### `receipt_splits`

Final split amounts per user for a completed receipt (non-transaction receipts).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `receipt_id` | TEXT | NOT NULL, FK → receipts.id | Parent receipt |
| `user_id` | TEXT | NOT NULL, FK → users.id | Member |
| `amount` | REAL | NOT NULL | Amount owed |
| `status` | TEXT | DEFAULT 'pending' | Payment status |
| `created_at` | TEXT | DEFAULT now | ISO 8601 timestamp |

## Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_group_members_user   ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group  ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_receipts_group       ON receipts(group_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_item     ON item_claims(receipt_item_id);
CREATE INDEX IF NOT EXISTS idx_receipt_splits_receipt ON receipt_splits(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_splits_user   ON receipt_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
```

## Migrations

Migrations live in `server/migrations/*.sql` and are applied via `npm run migrate` (e.g. `node scripts/migrate.mjs`). Examples:

- **005_split_mode_preference.sql** — Adds `groups.split_mode_preference` (`'even'` \| `'item'`, default `'item'`) so the host's split choice is persisted and visible to all members.
- Earlier migrations add `invite_token`, `support_code`, `last_settled_at`, receipt/transaction links, etc.

## Query Patterns

### Common Joins

**Get group with members:**
```sql
SELECT u.id, u.name, u.email
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = ?
```

**Get transaction with receipt items and claims:**
```sql
SELECT ri.id, ri.name, ri.price
FROM receipt_items ri
JOIN receipts r ON ri.receipt_id = r.id
WHERE r.transaction_id = ?

SELECT ic.receipt_item_id, ic.user_id
FROM item_claims ic
JOIN receipt_items ri ON ic.receipt_item_id = ri.id
JOIN receipts r ON ri.receipt_id = r.id
WHERE r.transaction_id = ?
```

**Get user's activity:**
```sql
SELECT ta.*, t.group_id, t.status, t.created_at, t.settled_at, g.name as group_name
FROM transaction_allocations ta
JOIN transactions t ON ta.transaction_id = t.id
JOIN groups g ON t.group_id = g.id
WHERE ta.user_id = ?
ORDER BY t.created_at DESC
LIMIT 50
```

## Resetting the Database

To start fresh you need an empty Postgres database (drop/recreate the database or use a new one), then:

```bash
cd server && npm run migrate && npm run seed
```

The seed script adds test data. With Docker: `docker compose down -v` removes volumes; then `docker compose up -d` and run migrate + seed inside the API container or against the exposed Postgres port.
