-- Max advance booking window, configurable from the admin policies page.
--   resort_info id = 4 (rooms): room_max_advance_days (default 365 days = 1 year)
--   resort_info id = 5 (boats): boat_max_advance_days (default 60 days ≈ 2 months)
-- Safe to re-run. Run on every environment BEFORE deploying the matching backend.

ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS room_max_advance_days INTEGER NOT NULL DEFAULT 365
  CHECK (room_max_advance_days >= 1 AND room_max_advance_days <= 730);

ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS boat_max_advance_days INTEGER NOT NULL DEFAULT 60
  CHECK (boat_max_advance_days >= 1 AND boat_max_advance_days <= 365);
