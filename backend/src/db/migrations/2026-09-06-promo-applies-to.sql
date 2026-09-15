-- Promo may apply to room bookings, kayak bookings, or both.
-- Existing rows default to both so current codes keep working.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS applies_to VARCHAR(10) NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_applies_to_check'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_applies_to_check
      CHECK (applies_to IN ('room', 'kayak', 'both'));
  END IF;
END $$;
