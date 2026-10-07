-- เวลาที่ลูกค้าคาดว่าจะมาถึง แยกออกจาก special_request (เดิมฝังเป็นข้อความ "[Arrival: HH:MM] ...")
-- ทำให้หน้าเช็คอินอ่านค่าตรง ๆ ได้ ไม่ต้องแกะข้อความ ไม่กระทบข้อมูลเดิม (แถวเก่ายังอ่านจาก special_request ได้ตามปกติ)
-- Safe to re-run.

ALTER TABLE room_bookings
  ADD COLUMN IF NOT EXISTS arrival_time TIME NULL;
