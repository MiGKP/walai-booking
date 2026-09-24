-- Reviews were scoped to the whole room_bookings header ("1 booking = 1 review"), which blocked
-- writing a separate review when one booking contains more than one room type (e.g. 1 Standard +
-- 1 Deluxe room in the same bill). Add room_type_id so a review is scoped per room type within a
-- booking instead of the whole header, allowing one review per (member, booking, room type).

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS room_type_id INTEGER REFERENCES room_types(id);

-- Backfill any existing rows (best-effort: picks the type of the first booking_room line).
UPDATE reviews rv
SET room_type_id = sub.room_type_id
FROM (
  SELECT DISTINCT ON (br.room_booking_id) br.room_booking_id, r.room_type_id
  FROM booking_room br
  JOIN rooms r ON r.room_id = br.room_id
  ORDER BY br.room_booking_id, br.booking_room_id
) sub
WHERE rv.room_booking_id = sub.room_booking_id AND rv.room_type_id IS NULL;

ALTER TABLE reviews ALTER COLUMN room_type_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_member_booking_type ON reviews(member_id, room_booking_id, room_type_id);
