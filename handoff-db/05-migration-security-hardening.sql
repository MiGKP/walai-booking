-- ขั้นที่ 5: เพิ่มคอลัมน์ความปลอดภัย (ALTER)
-- password_changed_at: ใช้ยกเลิก session เดิมเมื่อเปลี่ยนรหัสผ่าน
-- reset_attempts: นับ OTP ที่กรอกผิดต่อบัญชี
-- ใช้ IF NOT EXISTS ทั้งหมด รันซ้ำได้

ALTER TABLE members ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS reset_attempts INTEGER NOT NULL DEFAULT 0;

-- ตรวจผล (ควรได้ 3 แถว):
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE column_name IN ('password_changed_at', 'reset_attempts') ORDER BY table_name;

-- ย้อนกลับ (จะลบค่าที่บันทึกไว้ทั้งหมด):
-- ALTER TABLE members DROP COLUMN IF EXISTS password_changed_at, DROP COLUMN IF EXISTS reset_attempts;
-- ALTER TABLE staff DROP COLUMN IF EXISTS password_changed_at;
--
-- หมายเหตุ: หลังรันไฟล์นี้บน production แล้ว ควร deploy backend ใหม่ทันที
-- ถ้า deploy ก่อนรัน middleware จะตอบ 500 กับ request ที่มี token
