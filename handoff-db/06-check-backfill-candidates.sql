-- ขั้นที่ 6: หาบุ๊กกิ้งเก่าที่ต้อง backfill (SELECT อย่างเดียว)
-- บุ๊กกิ้งห้องที่ระบุโปรใน booking_room_promotions แต่ยังไม่มีแถวใน booking_promotions (ledger)
-- บุ๊กกิ้งเหล่านี้ยังไม่ถูกคืนโควตาเมื่อยกเลิก
-- ผลที่คาดหวัง: รายการบุ๊กกิ้งที่ต้องแก้ไขต่อ ถ้าไม่มีแถวเลยแปลว่าไม่ต้อง backfill

SELECT brp.room_booking_id,
       brp.promotion_id,
       brp.discount_amount,
       rb.status,
       rb.created_at
FROM booking_room_promotions brp
JOIN room_bookings rb ON rb.room_booking_id = brp.room_booking_id
WHERE NOT EXISTS (
  SELECT 1 FROM booking_promotions bp
  WHERE bp.room_booking_id = brp.room_booking_id AND bp.promotion_id = brp.promotion_id
)
ORDER BY rb.created_at;

-- การ backfill จริงต้องให้ผู้พัฒนาเขียนสคริปต์ เพราะต้องคำนวณ usage_count และสถานะ wallet ของสมาชิกให้ถูกต้อง
-- ห้ามรันการ INSERT หรือ UPDATE ใด ๆ โดยไม่มีการตรวจผลจากคำสั่งนี้ก่อน
