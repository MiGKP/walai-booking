-- เพิ่มความสามารถให้ 1 การจองห้องพัก (room_bookings) ใช้โปรโมชั่นได้มากกว่า 1 รหัสพร้อมกัน
-- โดยผูกโปรโมชั่นแต่ละอันเข้ากับ "ประเภทห้อง" ที่อยู่ในการจองนั้น (1 ประเภทห้อง = ใช้ได้ 1 โปรโมชั่น)
--
-- เป็น additive migration: ไม่แก้/ลบคอลัมน์เดิมใน room_bookings.promotion_id เพื่อไม่ให้กระทบ
-- โค้ด/รายงานเดิมที่ยังอ้างอิงคอลัมน์นั้นอยู่ (ระบบยังคง set ค่านี้ไว้เป็นโปรโมชั่นตัวแรกที่ใช้ เพื่อ backward-compat)

CREATE TABLE IF NOT EXISTS booking_room_promotions (
  id SERIAL PRIMARY KEY,
  room_booking_id INTEGER NOT NULL REFERENCES room_bookings(room_booking_id) ON DELETE CASCADE,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  promotion_id INTEGER NOT NULL REFERENCES promotions(id),
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_booking_id, room_type_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_room_promotions_room_booking_id
  ON booking_room_promotions (room_booking_id);
