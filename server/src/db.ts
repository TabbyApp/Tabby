import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'tabby.db');

export const db = new Database(dbPath);

// Init schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('bank', 'card')),
    last_four TEXT NOT NULL,
    brand TEXT,
    masked_data TEXT,
    plaid_account_id TEXT,
    plaid_item_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plaid_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    item_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS group_invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    inviter_id TEXT NOT NULL REFERENCES users(id),
    invitee_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS virtual_cards (
    id TEXT PRIMARY KEY,
    group_id TEXT UNIQUE NOT NULL REFERENCES groups(id),
    card_number_last_four TEXT NOT NULL,
    -- Full card details stored encrypted in production
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    file_path TEXT,
    total REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    name TEXT NOT NULL,
    price REAL NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS item_claims (
    receipt_item_id TEXT NOT NULL REFERENCES receipt_items(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (receipt_item_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS receipt_splits (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
  CREATE INDEX IF NOT EXISTS idx_item_claims_item ON item_claims(receipt_item_id);
  CREATE INDEX IF NOT EXISTS idx_receipt_splits_receipt ON receipt_splits(receipt_id);

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
  CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_receipts_group ON receipts(group_id);

  CREATE INDEX IF NOT EXISTS idx_group_invites_token ON group_invites(token);
  CREATE INDEX IF NOT EXISTS idx_group_invites_invitee_email ON group_invites(invitee_email);
  CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);
  CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items(user_id);

  CREATE TABLE IF NOT EXISTS phone_otps (
    phone TEXT NOT NULL PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS phone_invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    inviter_id TEXT NOT NULL REFERENCES users(id),
    invitee_phone TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_phone_invites_phone ON phone_invites(invitee_phone);
  CREATE INDEX IF NOT EXISTS idx_phone_invites_group ON phone_invites(group_id);
  CREATE INDEX IF NOT EXISTS idx_phone_invites_token ON phone_invites(token);
`);

// Migration: add phone to users (nullable, unique)
const hasPhone = db.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'phone'").get();
if (!hasPhone) {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL');
}

// Migration: add Plaid columns to payment_methods if missing (existing DBs)
const pmInfo = db.prepare("SELECT name FROM pragma_table_info('payment_methods') WHERE name = 'plaid_account_id'").get();
if (!pmInfo) {
  db.exec('ALTER TABLE payment_methods ADD COLUMN plaid_account_id TEXT');
  db.exec('ALTER TABLE payment_methods ADD COLUMN plaid_item_id TEXT');
}
