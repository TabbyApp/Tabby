-- Add UNIQUE constraint on invite_token so joins by token return at most one group
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_token ON groups(invite_token) WHERE invite_token IS NOT NULL;
