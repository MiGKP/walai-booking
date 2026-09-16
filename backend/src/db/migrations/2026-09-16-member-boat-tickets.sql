-- Additive only: new table to track free kayak/boat tickets granted by a room-booking promotion
-- (e.g. promotions.boat_ticket_count) so they can be redeemed later against a kayak booking.
-- Does not modify any existing table/column.

CREATE TABLE IF NOT EXISTS member_boat_tickets (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  promotion_id INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
  room_booking_id INTEGER REFERENCES room_bookings(room_booking_id) ON DELETE SET NULL,
  total_tickets INTEGER NOT NULL CHECK (total_tickets > 0),
  used_tickets INTEGER NOT NULL DEFAULT 0 CHECK (used_tickets >= 0 AND used_tickets <= total_tickets),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_boat_tickets_member_id ON member_boat_tickets(member_id);

-- บันทึกว่าบัตรฟรีถูกใช้กับการจองเรือรายการไหน จำนวนเท่าไหร่ — ใช้คืนบัตรได้ถูกต้องเมื่อยกเลิก/ปฏิเสธการจองนั้น
CREATE TABLE IF NOT EXISTS boat_ticket_redemptions (
  id SERIAL PRIMARY KEY,
  member_boat_ticket_id INTEGER NOT NULL REFERENCES member_boat_tickets(id) ON DELETE CASCADE,
  boat_booking_id INTEGER NOT NULL REFERENCES boat_bookings(boat_booking_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boat_ticket_redemptions_boat_booking_id ON boat_ticket_redemptions(boat_booking_id);
