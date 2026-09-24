-- เพิ่มสถานะ checked_in ให้ booking_room (เช็คอินทีละห้องจริงที่หน้าเคาน์เตอร์)
-- และเปลี่ยนจุดที่ทำให้ rooms.status = 'occupied' จากตอน "อนุมัติ" เป็นตอน "เช็คอินจริง" แทน

ALTER TABLE booking_room DROP CONSTRAINT booking_room_status_check;
ALTER TABLE booking_room ADD CONSTRAINT booking_room_status_check
  CHECK (status IN ('pending', 'paid', 'approved', 'checked_in', 'rejected', 'cancelled', 'checked_out'));

ALTER TABLE booking_room ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMP NULL;

CREATE OR REPLACE FUNCTION public.update_room_status_on_booking_room()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.status = 'checked_in' THEN
      UPDATE public.rooms
      SET status = 'occupied'
      WHERE room_id = NEW.room_id AND status <> 'maintenance';
    ELSIF NEW.status IN ('cancelled', 'rejected', 'checked_out') THEN
      UPDATE public.rooms
      SET status = 'available'
      WHERE room_id = NEW.room_id AND status <> 'maintenance';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
