-- Multi-kayak booking: header boat_bookings + line table booking_boat
-- Run in Neon SQL Editor (or psql) against the production/dev database.
-- Spec: docs/superpowers/specs/2026-08-09-multi-kayak-booking-design.md

BEGIN;

CREATE TABLE IF NOT EXISTS booking_boat (
  booking_boat_id SERIAL PRIMARY KEY,
  boat_booking_id INTEGER NOT NULL REFERENCES boat_bookings(boat_booking_id) ON DELETE CASCADE,
  boat_type_id INTEGER NOT NULL REFERENCES boat_types(boat_type_id),
  boat_round_id INTEGER NOT NULL REFERENCES boat_rounds(boat_round_id),
  num_passengers INTEGER NOT NULL CHECK (num_passengers >= 1),
  boat_count INTEGER NOT NULL CHECK (boat_count >= 1),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_boat_booking ON booking_boat(boat_booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_boat_round_status ON booking_boat(boat_round_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_boat_type_status ON booking_boat(boat_type_id, status);

ALTER TABLE boat_bookings
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- Backfill header times from legacy round FK
UPDATE boat_bookings bb
SET
  start_time = br.start_time,
  end_time = br.end_time
FROM boat_rounds br
WHERE bb.boat_round_id = br.boat_round_id
  AND (bb.start_time IS NULL OR bb.end_time IS NULL);

-- Backfill one line per legacy header
INSERT INTO booking_boat (
  boat_booking_id,
  boat_type_id,
  boat_round_id,
  num_passengers,
  boat_count,
  unit_price,
  subtotal,
  status
)
SELECT
  bb.boat_booking_id,
  bb.boat_type_id,
  bb.boat_round_id,
  GREATEST(COALESCE(bb.num_passengers, 1), 1),
  GREATEST(
    CEIL(
      GREATEST(COALESCE(bb.num_passengers, 1), 1)::numeric
      / NULLIF(GREATEST(COALESCE(bt.seat_count, 1), 1), 0)
    )::integer,
    1
  ),
  COALESCE(bt.price, bb.total_price, 0),
  COALESCE(
    bb.total_price,
    bt.price * GREATEST(
      CEIL(
        GREATEST(COALESCE(bb.num_passengers, 1), 1)::numeric
        / NULLIF(GREATEST(COALESCE(bt.seat_count, 1), 1), 0)
      )::integer,
      1
    ),
    0
  ),
  CASE
    WHEN bb.status IN ('pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out')
      THEN bb.status
    ELSE 'pending'
  END
FROM boat_bookings bb
JOIN boat_types bt ON bt.boat_type_id = bb.boat_type_id
WHERE bb.boat_type_id IS NOT NULL
  AND bb.boat_round_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM booking_boat bn WHERE bn.boat_booking_id = bb.boat_booking_id
  );

-- Drop header type/round after lines exist (keep times + passengers + total on header)
ALTER TABLE boat_bookings DROP COLUMN IF EXISTS boat_type_id;
ALTER TABLE boat_bookings DROP COLUMN IF EXISTS boat_round_id;

COMMIT;
