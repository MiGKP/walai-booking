-- เพิ่มฟิลด์จำนวนนาทีที่ต้องจองล่วงหน้าก่อนรอบเริ่ม
-- default 60 นาที — admin ปรับได้ที่ /admin/boat-hours
ALTER TABLE boat_operating_hours
  ADD COLUMN IF NOT EXISTS advance_booking_minutes INTEGER NOT NULL DEFAULT 60;
