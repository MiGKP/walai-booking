-- เพิ่มคอลัมน์เก็บพนักงานผู้ส่งมอบบัตรเรือ (handed_out_by_staff_id)
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS handed_out_by_staff_id INTEGER NULL REFERENCES staff(staff_id) ON DELETE SET NULL;
