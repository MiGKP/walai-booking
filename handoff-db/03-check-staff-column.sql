-- ขั้นที่ 3: ตรวจว่าตาราง room_bookings มีคอลัมน์ผู้ยืนยันการชำระเงินชื่อใด (SELECT อย่างเดียว)
-- โค้ดยืนยันการชำระห้อง (payment.controller.ts) เขียนคอลัมน์ verify_by_staff_id
-- ถ้าผลลัพธ์ไม่มี verify_by_staff_id แต่มี approved_by_staff_id ให้แจ้งผู้พัฒนา เพื่อเปลี่ยนชื่อในโค้ด
-- ผลที่คาดหวัง: ได้แถว approved_by_staff_id (และไม่ควรมี verify_by_staff_id)

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'room_bookings'
  AND column_name IN ('verify_by_staff_id', 'approved_by_staff_id')
ORDER BY column_name;
