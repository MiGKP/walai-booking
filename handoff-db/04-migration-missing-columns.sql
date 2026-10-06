-- ขั้นที่ 4: เพิ่มคอลัมน์ที่โค้ดใช้งานแต่ยังไม่มีใน migration (ALTER)
-- ใช้ IF NOT EXISTS ทั้งหมด รันซ้ำได้ ถ้ามีคอลัมน์อยู่แล้วจะไม่ทำอะไร
-- ก่อนรัน: ตรวจ branch ให้แน่ใจว่าถูกต้อง และสร้าง branch สำรองแล้ว

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS boat_ticket_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_type_id INTEGER,
  ADD COLUMN IF NOT EXISTS room_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS reject_reason TEXT;

ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS checkout_time TEXT,
  ADD COLUMN IF NOT EXISTS important_info TEXT,
  ADD COLUMN IF NOT EXISTS kids_policy TEXT,
  ADD COLUMN IF NOT EXISTS parking_info TEXT;

-- ตรวจผล (ควรได้ 8 แถว: promotions 3 + room_bookings 1 + resort_info 4):
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE (table_name='promotions' AND column_name IN ('boat_ticket_count','room_type_id','room_count'))
--    OR (table_name='room_bookings' AND column_name='reject_reason')
--    OR (table_name='resort_info' AND column_name IN ('checkout_time','important_info','kids_policy','parking_info'));

-- ย้อนกลับ (จะลบข้อมูลในคอลัมน์เหล่านี้ทั้งหมด ใช้เฉพาะเมื่อจำเป็นและยังไม่มีข้อมูลใช้งาน):
-- ALTER TABLE promotions DROP COLUMN IF EXISTS boat_ticket_count, DROP COLUMN IF EXISTS room_type_id, DROP COLUMN IF EXISTS room_count;
-- ALTER TABLE room_bookings DROP COLUMN IF EXISTS reject_reason;
-- ALTER TABLE resort_info DROP COLUMN IF EXISTS checkout_time, DROP COLUMN IF EXISTS important_info, DROP COLUMN IF EXISTS kids_policy, DROP COLUMN IF EXISTS parking_info;
