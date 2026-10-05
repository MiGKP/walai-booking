-- ค่าจองเรือล่วงหน้าขั้นต่ำ (นาที) เป็นค่าเดียวของทั้งระบบ เก็บในแถวเรือของ resort_info (id = 5)
-- คอลัมน์ boat_operating_hours.advance_booking_minutes รายวันเดิมจะไม่ถูกใช้แล้ว แต่ไม่ลบข้อมูลทิ้ง
-- Safe to re-run.

ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS boat_advance_booking_minutes INTEGER NOT NULL DEFAULT 60
  CHECK (boat_advance_booking_minutes >= 0 AND boat_advance_booking_minutes <= 10080);
