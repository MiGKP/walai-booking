-- เพิ่มนโยบายการยกเลิกและคืนเงินสำหรับห้องพักในตาราง cancellation_policies
-- ใช้งานร่วมกับนโยบายของเรือ/บัตรเสริมเดิม (full_refund_hours, late_refund_percent)

ALTER TABLE cancellation_policies
  ADD COLUMN IF NOT EXISTS room_full_refund_days INTEGER NOT NULL DEFAULT 3 CHECK (room_full_refund_days >= 0),
  ADD COLUMN IF NOT EXISTS room_late_refund_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (room_late_refund_percent >= 0 AND room_late_refund_percent <= 100);
