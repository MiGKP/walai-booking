-- Hotfix: room booking INSERT 500 after multi-room migration
-- Root cause: trg_calculate_price → calculate_booking_price() still reads NEW.room_id
-- but room_bookings.room_id was dropped. App now sets header total_price itself.
--
-- Also: ensure every active boat type has matching active rounds for each shared time window
-- (multi-kayak requires per-type boat_rounds at the same start_time/end_time).
--
-- Run in Neon SQL Editor (production) and any other environments.

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_booking_price()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Header pricing is application-owned (multi-room lines + optional promo).
  -- Keep trigger as a no-op so legacy BEFORE INSERT wiring does not crash.
  RETURN NEW;
END;
$function$;

-- Seed missing per-type rounds from any existing round template
-- (typed rounds preferred; null boat_type_id shared rounds also count as templates).
INSERT INTO boat_rounds (
  boat_type_id,
  start_time,
  end_time,
  max_booking,
  is_active,
  total_slots
)
SELECT
  bt.boat_type_id,
  src.start_time,
  src.end_time,
  src.max_booking,
  true,
  src.total_slots
FROM boat_types bt
CROSS JOIN (
  SELECT DISTINCT ON (start_time, end_time)
    start_time,
    end_time,
    max_booking,
    total_slots
  FROM boat_rounds
  WHERE is_active = true
  ORDER BY start_time, end_time,
           CASE WHEN boat_type_id IS NULL THEN 1 ELSE 0 END,
           boat_round_id
) src
WHERE bt.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM boat_rounds br
    WHERE br.boat_type_id = bt.boat_type_id
      AND br.start_time = src.start_time
      AND br.end_time = src.end_time
      AND br.is_active = true
  );

-- Shared/orphan rounds with null boat_type_id cannot be used by multi-kayak create.
-- Deactivate them after typed copies exist (keeps history; stops polluting admin lists).
UPDATE boat_rounds br
SET is_active = false
WHERE br.boat_type_id IS NULL
  AND br.is_active = true
  AND EXISTS (
    SELECT 1
    FROM boat_rounds typed
    WHERE typed.boat_type_id IS NOT NULL
      AND typed.is_active = true
      AND typed.start_time = br.start_time
      AND typed.end_time = br.end_time
  );

COMMIT;
