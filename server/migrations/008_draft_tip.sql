-- Pending item-split tip: host sets draft tip % and receipt id when they confirm selections;
-- all members see the same summary and tip (read-only for members) until host completes payment.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_tip_percentage INTEGER;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_receipt_id TEXT REFERENCES receipts(id) ON DELETE SET NULL;
