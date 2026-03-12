ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Do not interrupt existing users with the new setup flow.
UPDATE users
SET onboarding_completed = TRUE
WHERE onboarding_completed = FALSE
  AND created_at < now();
