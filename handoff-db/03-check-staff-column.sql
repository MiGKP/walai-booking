-- ขั้นที่ 3: ตรวจว่าตาราง room_bookings มีคอลัมน์ผู้ยืนยันการชำระเงินชื่อใด (SELECT อย่างเดียว)
-- โค้ดยืนยันการชำระห้อง (payment.controller.ts) ใช้ approved_by_staff_id ตรงกับ schema
-- verify_by_staff_id เป็นชื่อเก่าที่ไม่ควรนำกลับมาใช้
-- ผลที่คาดหวัง: ได้แถว approved_by_staff_id (และไม่ควรมี verify_by_staff_id)
-- คอลัมน์นี้ถูกเขียนตอนปฏิเสธด้วย จึงใช้ค่าที่ไม่เป็น NULL พิสูจน์ว่าเคยอนุมัติไม่ได้

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'room_bookings'
  AND column_name IN ('verify_by_staff_id', 'approved_by_staff_id')
ORDER BY column_name;
