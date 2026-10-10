-- เพิ่มคอลัมน์สำหรับการเช็คอินท่าเรือ / ปล่อยเรือลงน้ำ (boat check-in) และคืนเรือ (check-out)
-- Safe to re-run: ใช้ IF NOT EXISTS
ALTER TABLE boat_bookings
  ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS checkin_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMP NULL;
