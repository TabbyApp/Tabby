-- Store per-person breakdown (subtotal, tax, tip) for settled transactions so Payment Complete can show it
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS allocation_breakdown JSONB;
