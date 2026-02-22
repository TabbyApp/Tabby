-- Add receipt_id to item_claims for Realtime filtering (Supabase postgres_changes filter).
-- Backfill from receipt_items, then set NOT NULL.

ALTER TABLE item_claims ADD COLUMN IF NOT EXISTS receipt_id TEXT REFERENCES receipts(id) ON DELETE CASCADE;

UPDATE item_claims ic
SET receipt_id = ri.receipt_id
FROM receipt_items ri
WHERE ic.receipt_item_id = ri.id AND ic.receipt_id IS NULL;

ALTER TABLE item_claims ALTER COLUMN receipt_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_item_claims_receipt ON item_claims(receipt_id);
