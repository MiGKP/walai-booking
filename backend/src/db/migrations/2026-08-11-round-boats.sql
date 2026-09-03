-- Ensure round_boats junction exists (friend M2M: boat_rounds <-> boat_types).
-- Safe to re-run. Does not drop boat_rounds.boat_type_id (legacy still supported).

BEGIN;

CREATE TABLE IF NOT EXISTS round_boats (
  round_boat_id SERIAL PRIMARY KEY,
  boat_round_id INTEGER NOT NULL REFERENCES boat_rounds(boat_round_id) ON DELETE CASCADE,
  boat_type_id INTEGER NOT NULL REFERENCES boat_types(boat_type_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT round_boats_round_type_unique UNIQUE (boat_round_id, boat_type_id)
);

CREATE INDEX IF NOT EXISTS idx_round_boats_type ON round_boats(boat_type_id);
CREATE INDEX IF NOT EXISTS idx_round_boats_round ON round_boats(boat_round_id);

-- Backfill from legacy per-type rounds
INSERT INTO round_boats (boat_round_id, boat_type_id, quantity)
SELECT br.boat_round_id, br.boat_type_id, 1
FROM boat_rounds br
WHERE br.boat_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM round_boats rb
    WHERE rb.boat_round_id = br.boat_round_id
      AND rb.boat_type_id = br.boat_type_id
  );

COMMIT;
