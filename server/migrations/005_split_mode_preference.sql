-- Add host's split mode preference so all members see the same mode
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS split_mode_preference TEXT NOT NULL DEFAULT 'item'
CHECK (split_mode_preference IN ('even', 'item'));
