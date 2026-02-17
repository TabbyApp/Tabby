-- Composite index for virtual-cards list query: receipts by group + status
CREATE INDEX IF NOT EXISTS idx_receipts_group_status ON receipts(group_id, status);
