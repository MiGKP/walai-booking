-- นโยบายการคืนเงินเมื่อยกเลิกบัตรเสริม (boat add-on) ที่ชำระแล้ว
-- admin และพนักงานแก้ค่าได้ที่หน้าตั้งค่า; ค่าเริ่มต้น: ยกเลิกก่อนเข้าพัก 48 ชม. คืนเต็ม, หลังจากนั้นคืน 0%
-- Run in Neon SQL Editor (or psql) against the target database before deploying the matching backend.

CREATE TABLE IF NOT EXISTS cancellation_policies (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_refund_hours INTEGER NOT NULL DEFAULT 48 CHECK (full_refund_hours >= 0),
  late_refund_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (late_refund_percent >= 0 AND late_refund_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cancellation_policies (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- รายการคืนเงินแยกจากยอดห้อง (ไม่แก้ยอดชำระเดิมโดยตรง)
CREATE TABLE IF NOT EXISTS booking_refunds (
  refund_id SERIAL PRIMARY KEY,
  room_booking_id INTEGER NOT NULL REFERENCES room_bookings(room_booking_id) ON DELETE CASCADE,
  boat_booking_id INTEGER REFERENCES boat_bookings(boat_booking_id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  percent_applied NUMERIC(5, 2) NOT NULL CHECK (percent_applied >= 0 AND percent_applied <= 100),
  hours_before_start NUMERIC(10, 2),
  reason TEXT,
  cancelled_by_user_id INTEGER NOT NULL,
  cancelled_by_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_refunds_room ON booking_refunds(room_booking_id);
