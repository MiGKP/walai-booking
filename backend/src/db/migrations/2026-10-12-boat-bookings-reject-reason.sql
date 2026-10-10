-- เพิ่มคอลัมน์ reject_reason ให้กับตาราง boat_bookings สำหรับเก็บเหตุผลในการปฏิเสธการจองเรือ
-- Safe to re-run: ใช้ IF NOT EXISTS
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS reject_reason TEXT;
