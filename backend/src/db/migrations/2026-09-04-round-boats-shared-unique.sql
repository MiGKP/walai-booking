-- Production cleanup: one shared round per time window + unique membership.
-- Safe to re-run. Maps typed duplicate rounds onto shared M2M rounds.

BEGIN;

-- 15:00–15:30 already has shared membership on round 25; other windows use 26–29.
UPDATE booking_boat SET boat_round_id = 25 WHERE boat_round_id = 30;
UPDATE booking_boat SET boat_round_id = 26 WHERE boat_round_id IN (31, 32);
UPDATE booking_boat SET boat_round_id = 27 WHERE boat_round_id IN (33, 34);
UPDATE booking_boat SET boat_round_id = 28 WHERE boat_round_id IN (35, 36);
UPDATE booking_boat SET boat_round_id = 29 WHERE boat_round_id IN (37, 38);

UPDATE boat_rounds
SET boat_type_id = NULL, is_active = true
WHERE boat_round_id IN (25, 26, 27, 28, 29);

UPDATE boat_rounds
SET is_active = false
WHERE boat_round_id IN (30, 31, 32, 33, 34, 35, 36, 37, 38);

CREATE UNIQUE INDEX IF NOT EXISTS round_boats_round_type_unique
  ON round_boats (boat_round_id, boat_type_id);

CREATE INDEX IF NOT EXISTS idx_round_boats_type ON round_boats (boat_type_id);
CREATE INDEX IF NOT EXISTS idx_round_boats_round ON round_boats (boat_round_id);

COMMIT;
