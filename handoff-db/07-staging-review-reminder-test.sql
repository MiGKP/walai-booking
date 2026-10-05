-- ขั้นที่ 7: เตรียมข้อมูลทดสอบ "แจ้งเตือนรีวิว" บน STAGING เท่านั้น
-- ห้ามรันบน production เด็ดขาด
-- ก่อนรันทุกบรรทัด ตรวจว่าเชื่อมต่อ staging อยู่ (ดูชื่อ branch / host ใน Neon)

-- 7.1 หาบุ๊กกิ้งทดสอบ (SELECT) และตรวจว่าอีเมลลูกค้าคืออีเมลของคุณ
SELECT rb.room_booking_id, rb.status, rb.check_out, rb.review_reminder_sent, m.email
FROM room_bookings rb
JOIN members m ON m.member_id = rb.member_id
WHERE m.email = 'อีเมลของคุณ'
ORDER BY rb.created_at DESC
LIMIT 5;

-- 7.2 วันที่ของฐานข้อมูล (SELECT)
SELECT CURRENT_DATE AS db_today;

-- 7.3 ตั้งค่าบุ๊กกิ้งให้เข้าเงื่อนไขการเตือน
-- ใส่ <room_booking_id> จากขั้น 7.1 แทนค่า และตรวจว่าเป็นบุ๊กกิ้งทดสอบจริง
UPDATE room_bookings
SET status = 'checked_out', check_out = CURRENT_DATE, review_reminder_sent = false
WHERE room_booking_id = <room_booking_id>;

UPDATE booking_room
SET status = 'checked_out'
WHERE room_booking_id = <room_booking_id> AND status NOT IN ('cancelled', 'rejected');

-- 7.4 ตรวจผลหลังรีสตาร์ต backend (SELECT)
-- ก่อนรีสตาร์ต ควรได้ review_reminder_sent = false
-- หลังรีสตาร์ต และ log ขึ้นว่า "Sent to ..." ควรได้ review_reminder_sent = true
SELECT room_booking_id, review_reminder_sent FROM room_bookings WHERE room_booking_id = <room_booking_id>;

-- ย้อนกลับ (เพื่อทดสอบซ้ำ): ตั้งค่ากลับให้เตือนได้อีกครั้ง
-- UPDATE room_bookings SET review_reminder_sent = false WHERE room_booking_id = <room_booking_id>;
