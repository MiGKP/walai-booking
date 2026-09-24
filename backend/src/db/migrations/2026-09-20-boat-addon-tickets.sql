-- เปลี่ยนบัตรพายเรือฟรีให้เป็น "โปรโมชั่นเสริม" ที่ผูกกับห้องพักจริงแต่ละห้อง (ไม่ใช่กระเป๋ารวมของสมาชิก)
-- โปรโมชั่นเลือกได้ว่าจะแจกฟรี (free) หรือขายเป็นแพ็คเสริม (paid) ต่อการใช้งาน

-- โปรโมชั่น: โหมดของบัตรเสริม (ฟรี/ขาย) + ราคาต่อการใช้ (เฉพาะโหมด paid)
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS boat_addon_mode VARCHAR(10) NOT NULL DEFAULT 'free'
  CHECK (boat_addon_mode IN ('free', 'paid'));
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS boat_addon_price NUMERIC(10, 2) NULL;

-- กระเป๋าบัตร: ผูกกับห้องพักจริง (booking_room) แทนที่จะเป็นกระเป๋ารวมของสมาชิก
ALTER TABLE member_boat_tickets ADD COLUMN IF NOT EXISTS booking_room_id INTEGER NULL
  REFERENCES booking_room(booking_room_id) ON DELETE CASCADE;
ALTER TABLE member_boat_tickets ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'free'
  CHECK (mode IN ('free', 'paid'));
ALTER TABLE member_boat_tickets ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_member_boat_tickets_booking_room ON member_boat_tickets(booking_room_id);

-- จองเรือที่เป็น "บัตรเสริม" ผูกกับห้องพัก/บิลจอง เพื่อยกเลิกพร้อมกันถ้าห้องถูกยกเลิก/ปฏิเสธ
-- และให้พนักงานพิมพ์/มอบบัตรตอนเช็คอินได้
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS room_booking_id INTEGER NULL
  REFERENCES room_bookings(room_booking_id) ON DELETE SET NULL;
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS booking_room_id INTEGER NULL
  REFERENCES booking_room(booking_room_id) ON DELETE SET NULL;
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS is_addon BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS addon_mode VARCHAR(10) NULL
  CHECK (addon_mode IN ('free', 'paid'));
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP NULL;
ALTER TABLE boat_bookings ADD COLUMN IF NOT EXISTS handed_out_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_boat_bookings_room_booking ON boat_bookings(room_booking_id) WHERE room_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boat_bookings_booking_room ON boat_bookings(booking_room_id) WHERE booking_room_id IS NOT NULL;
