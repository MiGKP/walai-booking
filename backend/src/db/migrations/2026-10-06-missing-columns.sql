-- คอลัมน์ที่โค้ดใช้งานแต่ยังไม่มี migration ใน repo สร้างไว้ (ตรวจพบจากการทดสอบกับฐานที่สร้างจาก repo)
-- Safe to re-run: ใช้ IF NOT EXISTS ทั้งหมด ถ้า production มีคอลัมน์เหล่านี้อยู่แล้วจะไม่มีผลใด ๆ

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS boat_ticket_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_type_id INTEGER,
  ADD COLUMN IF NOT EXISTS room_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- คอลัมน์ของ resort_info ที่หน้าบ้านและ API ใช้งาน (ตรวจพบว่าไม่มี migration สร้าง)
ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS checkout_time TEXT,
  ADD COLUMN IF NOT EXISTS important_info TEXT,
  ADD COLUMN IF NOT EXISTS kids_policy TEXT,
  ADD COLUMN IF NOT EXISTS parking_info TEXT;
