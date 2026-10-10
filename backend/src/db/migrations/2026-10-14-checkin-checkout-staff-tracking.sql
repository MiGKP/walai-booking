-- เพิ่มคอลัมน์เก็บพนักงานผู้กดเช็คอิน และผู้กดเช็คเอาท์
-- Safe to re-run: ใช้ IF NOT EXISTS

-- 1. booking_room: เก็บพนักงานที่กดเช็คอินห้อง และพนักงานที่กดเช็คเอาท์ห้อง
ALTER TABLE booking_room
  ADD COLUMN IF NOT EXISTS checkin_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL;

-- 2. room_bookings: เก็บพนักงานที่กดเช็คเอาท์ระดับภาพรวม/หัวการจอง (เผื่ออ้างอิง)
ALTER TABLE room_bookings
  ADD COLUMN IF NOT EXISTS checkout_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL;

-- 3. boat_bookings: เก็บพนักงานที่กดเช็คเอาท์ (คืนเรือ) (ส่วน checkin_by_staff_id มีอยู่แล้ว)
ALTER TABLE boat_bookings
  ADD COLUMN IF NOT EXISTS checkout_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL;
