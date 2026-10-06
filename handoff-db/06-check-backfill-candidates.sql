-- ขั้นที่ 6: หาบุ๊กกิ้งเก่าที่ต้อง backfill (SELECT อย่างเดียว)
-- บุ๊กกิ้งห้องที่ระบุโปรใน booking_room_promotions แต่ยังไม่มีแถวใน booking_promotions (ledger)
-- ledger ที่หายอาจเป็นข้อมูลเก่าหรือเคยถูกคืนโควตาถูกต้องแล้ว ต้องพิจารณาสถานะ/ประวัติ
-- แสดงหนึ่งแถวต่อ booking + promotion โดยรวมส่วนลดจากหลายประเภทห้อง
-- ถ้าไม่มีแถว ยังต้องตรวจ header-only และ usage_count ด้วยไฟล์ 08

SELECT brp.room_booking_id,
       brp.promotion_id,
       SUM(brp.discount_amount) AS discount_amount,
       COUNT(*) AS source_lines,
       rb.status,
       rb.created_at
FROM booking_room_promotions brp
JOIN room_bookings rb ON rb.room_booking_id = brp.room_booking_id
WHERE NOT EXISTS (
  SELECT 1 FROM booking_promotions bp
  WHERE bp.room_booking_id = brp.room_booking_id AND bp.promotion_id = brp.promotion_id
)
GROUP BY brp.room_booking_id, brp.promotion_id, rb.status, rb.created_at
ORDER BY rb.created_at, brp.room_booking_id, brp.promotion_id;

-- ใช้ไฟล์ 08 ตรวจแผนแบบ SELECT-only; ไฟล์ 09 ทำงานใน transaction พร้อม marker กันรันซ้ำ
-- ต้องทดสอบ 08 -> 09 -> 10 บน branch สำรองก่อน แล้วตรวจ 08 บน production ใหม่ก่อนใช้ 09
