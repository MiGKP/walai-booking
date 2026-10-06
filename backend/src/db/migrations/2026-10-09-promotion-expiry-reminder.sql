-- แจ้งเตือนโปรใกล้หมดอายุ 2 รอบ (ก่อน 3 วัน และก่อน 1 วัน) + ปิดรับอีเมลได้
-- expiry_reminder_stage: 0 = ยังไม่ส่ง, 1 = ส่งรอบ 3 วันแล้ว, 2 = ส่งรอบ 1 วันแล้ว
-- expiry_reminder_end: วันสิ้นสุดที่ใช้ตอนส่ง ถ้าแอดมินเปลี่ยนวันสิ้นสุด รอบจะเริ่มใหม่
-- Safe to re-run.

ALTER TABLE member_promotions
  ADD COLUMN IF NOT EXISTS expiry_reminder_stage SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiry_reminder_end DATE NULL;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS promo_email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_member_promotions_expiry_reminder
  ON member_promotions (status, expiry_reminder_stage);
