-- Apply on a production snapshot branch first, before deploying code using these fields.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE resort_info ADD COLUMN IF NOT EXISTS infant_max_age_exclusive INTEGER NOT NULL DEFAULT 6;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resort_info_infant_age_range'
                 AND conrelid = 'resort_info'::regclass) THEN
    ALTER TABLE resort_info ADD CONSTRAINT resort_info_infant_age_range
      CHECK (infant_max_age_exclusive BETWEEN 0 AND 18);
  END IF;
END $$;
-- Nullable snapshots: older bookings continue to display the member's contact details.
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS guest_email TEXT;
COMMIT;
