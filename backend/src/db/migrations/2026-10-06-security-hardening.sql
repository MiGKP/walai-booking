-- Security hardening
-- 1) password_changed_at: token ที่ออกก่อนเวลานี้ถูกปฏิเสธ (ยกเลิก session เดิมเมื่อเปลี่ยน/รีเซ็ตรหัสผ่าน)
-- 2) reset_attempts: นับการกรอก OTP ผิดต่อบัญชี (ครบเกณฑ์แล้ว OTP นั้นใช้ไม่ได้)
-- Safe to re-run.

ALTER TABLE members ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS reset_attempts INTEGER NOT NULL DEFAULT 0;
