-- Additive only. Records each child's age at check-in (0-17), one entry per child, matching the
-- new international-standard age brackets (adult 18+, child 0-17). Children under 2 (infants) are
-- excluded from room-capacity checks (see assertGuestsFitCapacity in booking-room.math.ts); room
-- pricing itself is already flat per night regardless of guest count, so no separate "free" pricing
-- rule is needed for infants.

ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS child_ages INTEGER[] NOT NULL DEFAULT '{}';
