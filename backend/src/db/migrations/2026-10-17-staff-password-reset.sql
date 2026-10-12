-- Add staff OTP recovery with the same expiry / attempt protections as members.
-- Additive and safe to re-run; apply before deploying the auth controller.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reset_attempts INTEGER NOT NULL DEFAULT 0;
