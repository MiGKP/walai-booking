-- Multi-room booking: header room_bookings + line table booking_room
-- Run in Neon SQL Editor (or psql) against the production/dev database.
-- Spec: docs/superpowers/specs/2026-08-09-multi-room-booking-design.md

BEGIN;

CREATE TABLE IF NOT EXISTS booking_room (
  booking_room_id SERIAL PRIMARY KEY,
  room_booking_id INTEGER NOT NULL REFERENCES room_bookings(room_booking_id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(room_id),
  price_per_night NUMERIC(10, 2) NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  subtotal NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out')),
  checkout_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_room_booking ON booking_room(room_booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_room_room_status ON booking_room(room_id, status);

ALTER TABLE room_bookings
  ADD COLUMN IF NOT EXISTS adults INTEGER,
  ADD COLUMN IF NOT EXISTS children INTEGER NOT NULL DEFAULT 0;

UPDATE room_bookings
SET adults = GREATEST(COALESCE(guest_count, 1), 1)
WHERE adults IS NULL;

ALTER TABLE room_bookings
  ALTER COLUMN adults SET DEFAULT 1,
  ALTER COLUMN adults SET NOT NULL;

-- Backfill one line per legacy header that still has room_id
INSERT INTO booking_room (
  room_booking_id, room_id, price_per_night, nights, subtotal, status, checkout_at
)
SELECT
  rb.room_booking_id,
  rb.room_id,
  COALESCE(rt.price, rb.total_price, 0),
  GREATEST((rb.check_out - rb.check_in), 1),
  COALESCE(rb.total_price, 0),
  CASE
    WHEN rb.status = 'checked_out' THEN 'checked_out'
    ELSE COALESCE(rb.status, 'pending')
  END,
  rb.checkout_at
FROM room_bookings rb
JOIN rooms r ON r.room_id = rb.room_id
JOIN room_types rt ON rt.id = r.room_type_id
WHERE rb.room_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM booking_room br WHERE br.room_booking_id = rb.room_booking_id
  );

-- Header no longer uses checked_out (line-level only)
UPDATE room_bookings
SET status = 'approved'
WHERE status = 'checked_out';

-- Price trigger: skip when room_id is null (multi-room header; app sets total_price)
CREATE OR REPLACE FUNCTION public.calculate_booking_price()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  room_price_per_night NUMERIC(10,2);
  stay_days INTEGER;
  promo_discount_type VARCHAR(20);
  promo_discount_value NUMERIC(10,2);
  promo_max_discount NUMERIC(10,2);
  promo_min_nights INTEGER;
  promo_min_price NUMERIC(10,2);
  base_price NUMERIC(10,2);
  discount_amount NUMERIC(10,2) DEFAULT 0;
BEGIN
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT price INTO room_price_per_night
  FROM public.room_types
  WHERE id = (SELECT room_type_id FROM public.rooms WHERE room_id = NEW.room_id);

  stay_days := NEW.check_out - NEW.check_in;
  IF stay_days <= 0 THEN stay_days := 1; END IF;

  base_price := room_price_per_night * stay_days;

  IF NEW.promotion_id IS NOT NULL THEN
    SELECT discount_type, discount_value, max_discount, min_nights, min_price
    INTO promo_discount_type, promo_discount_value, promo_max_discount, promo_min_nights, promo_min_price
    FROM public.promotions
    WHERE id = NEW.promotion_id AND is_active = true;

    IF FOUND THEN
      IF (promo_min_nights IS NULL OR stay_days >= promo_min_nights) AND
         (promo_min_price IS NULL OR base_price >= promo_min_price) THEN
        IF promo_discount_type = 'percent' THEN
          discount_amount := (base_price * promo_discount_value) / 100;
          IF promo_max_discount IS NOT NULL THEN
            discount_amount := LEAST(discount_amount, promo_max_discount);
          END IF;
        ELSE
          discount_amount := LEAST(promo_discount_value, base_price);
        END IF;
      END IF;
    END IF;
  END IF;

  NEW.total_price := GREATEST(0, base_price - discount_amount);
  RETURN NEW;
END;
$function$;

-- Occupancy follows booking_room lines
CREATE OR REPLACE FUNCTION public.update_room_status_on_booking_room()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.rooms
      SET status = 'occupied'
      WHERE room_id = NEW.room_id AND status <> 'maintenance';
    ELSIF NEW.status IN ('cancelled', 'rejected', 'checked_out') THEN
      UPDATE public.rooms
      SET status = 'available'
      WHERE room_id = NEW.room_id AND status <> 'maintenance';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booking_room_status ON booking_room;
CREATE TRIGGER trg_booking_room_status
  AFTER INSERT OR UPDATE OF status ON booking_room
  FOR EACH ROW
  EXECUTE FUNCTION update_room_status_on_booking_room();

-- Old header occupancy trigger depends on room_id
DROP TRIGGER IF EXISTS trg_room_booking_status ON room_bookings;

ALTER TABLE room_bookings DROP CONSTRAINT IF EXISTS room_bookings_room_id_fkey;
ALTER TABLE room_bookings DROP COLUMN IF EXISTS room_id;

COMMIT;
