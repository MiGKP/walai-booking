-- ขั้นที่ 1: ตรวจคอลัมน์ที่โค้ดใช้งาน (SELECT อย่างเดียว ไม่แก้ข้อมูล)
-- ผลที่คาดหวัง:
--   promotions: boat_ticket_count, room_type_id, room_count  (ต้องมีครบทั้ง 3)
--   room_bookings: reject_reason  (ต้องมี)
--   resort_info: checkout_time, important_info, kids_policy, parking_info  (ถ้าไม่มี ต้องรันไฟล์ 04)
--   members: password_changed_at, reset_attempts  (ถ้าไม่มี ต้องรันไฟล์ 05)
--   staff: password_changed_at  (ถ้าไม่มี ต้องรันไฟล์ 05)
--   booking_room: checkin_at  (ต้องมี)
-- แถวที่คืนมาคือคอลัมน์ที่มีอยู่แล้ว ถ้าไม่มีแถวใดเลยใน group นั้น แปลว่าขาด

SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'promotions' AND column_name IN ('boat_ticket_count', 'room_type_id', 'room_count'))
   OR (table_name = 'room_bookings' AND column_name IN ('reject_reason', 'approved_by_staff_id'))
   OR (table_name = 'resort_info' AND column_name IN ('checkout_time', 'important_info', 'kids_policy', 'parking_info', 'bank_account_no', 'promptpay_id'))
   OR (table_name = 'members' AND column_name IN ('password_changed_at', 'reset_attempts', 'is_active'))
   OR (table_name = 'staff' AND column_name IN ('password_changed_at', 'status', 'role'))
   OR (table_name = 'booking_room' AND column_name = 'checkin_at')
ORDER BY table_name, column_name;
