-- Complete round_boats as source of truth for which types a round offers
-- and how many boats of each type that round can sell.
-- Safe to re-run. Does not drop boat_rounds.boat_type_id (legacy membership fallback).

BEGIN;

ALTER TABLE boat_rounds
  ALTER COLUMN boat_type_id DROP NOT NULL;

INSERT INTO round_boats (boat_round_id, boat_type_id, quantity)
SELECT br.boat_round_id, br.boat_type_id, GREATEST(COALESCE(bt.quantity, 1), 1)
FROM boat_rounds br
JOIN boat_types bt ON bt.boat_type_id = br.boat_type_id
WHERE br.boat_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM round_boats rb
    WHERE rb.boat_round_id = br.boat_round_id
      AND rb.boat_type_id = br.boat_type_id
  );

-- Legacy 1:1 backfill used quantity=1; restore fleet size for typed rounds only.
UPDATE round_boats rb
SET quantity = GREATEST(rb.quantity, COALESCE(bt.quantity, 1))
FROM boat_types bt, boat_rounds br
WHERE rb.boat_type_id = bt.boat_type_id
  AND rb.boat_round_id = br.boat_round_id
  AND br.boat_type_id IS NOT NULL
  AND rb.quantity = 1
  AND COALESCE(bt.quantity, 1) > 1;

UPDATE round_boats
SET quantity = 1
WHERE quantity IS NULL OR quantity < 1;

ALTER TABLE round_boats
  DROP CONSTRAINT IF EXISTS round_boats_quantity_positive;

ALTER TABLE round_boats
  ADD CONSTRAINT round_boats_quantity_positive CHECK (quantity >= 1);

COMMIT;
