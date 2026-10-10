-- เพิ่มคอลัมน์ deleted_at ใน members เพื่อรองรับ Soft Delete / Anonymize ตาม PDPA
-- Safe to re-run: ใช้ IF NOT EXISTS
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
