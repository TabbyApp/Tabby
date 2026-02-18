-- Support code for groups (lookup by short code for support tickets)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS support_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_groups_support_code ON groups(support_code);

-- Populate support_code for existing groups (6-char alphanumeric)
-- Run in app: UPDATE groups SET support_code = ... WHERE support_code IS NULL

-- Avatar for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Last settled timestamp for "active vs recent" logic
ALTER TABLE groups ADD COLUMN IF NOT EXISTS last_settled_at TIMESTAMPTZ;
