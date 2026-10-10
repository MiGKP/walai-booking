-- ตรวจบัตรเสริมพายเรือ (SELECT อย่างเดียว ปลอดภัยรันซ้ำได้)
-- ใช้ตรวจว่าห้องพักเดียวมีบัตรทั้งโหมดฟรี (free) และโหมดขาย (paid) ปนกันหรือไม่
-- ควรรันบน branch สำรองก่อนเสมอ

-- 1) ห้องพักจริงที่มีบัตรมากกว่า 1 โหมด (ควรได้ 0 แถว)
SELECT mbt.booking_room_id,
       COUNT(DISTINCT mbt.mode) AS mode_count,
       ARRAY_AGG(DISTINCT mbt.mode) AS modes,
       ARRAY_AGG(DISTINCT mbt.unit_price) AS unit_prices
FROM member_boat_tickets mbt
WHERE mbt.booking_room_id IS NOT NULL
GROUP BY mbt.booking_room_id
HAVING COUNT(DISTINCT mbt.mode) > 1
    OR COUNT(DISTINCT mbt.unit_price) > 1;

-- 2) ห้องพักที่มีบัตรมากกว่า 1 แถว (ปกติสร้างแถวเดียวต่อห้องจากโปรโมชั่นเดียว)
SELECT mbt.booking_room_id, COUNT(*) AS grant_rows
FROM member_boat_tickets mbt
WHERE mbt.booking_room_id IS NOT NULL
GROUP BY mbt.booking_room_id
HAVING COUNT(*) > 1;

-- 3) ยอดคงเหลือต่อห้อง ตรวจว่า used_tickets ไม่เกิน total_tickets และไม่ติดลบ (ควรได้ 0 แถว)
SELECT id, booking_room_id, total_tickets, used_tickets
FROM member_boat_tickets
WHERE used_tickets < 0 OR used_tickets > total_tickets;

-- 4) บัญชีบัตรเสริมที่ใช้แล้ว ต้องตรงกับผลรวมใน boat_ticket_redemptions (ควรได้ 0 แถว)
SELECT mbt.id, mbt.used_tickets, COALESCE(SUM(r.quantity), 0) AS redeemed
FROM member_boat_tickets mbt
LEFT JOIN boat_ticket_redemptions r ON r.member_boat_ticket_id = mbt.id
GROUP BY mbt.id, mbt.used_tickets
HAVING mbt.used_tickets <> COALESCE(SUM(r.quantity), 0);

-- 5) บรรทัดเรือเสริมที่ unit_price ไม่ตรงกับ subtotal ในโหมดขาย (หลังแก้ข้อ 2 ควรได้ 0 แถวสำหรับรายการใหม่)
SELECT bb.boat_booking_id, bnb.booking_boat_id, bnb.unit_price, bnb.boat_count, bnb.subtotal, bb.addon_mode
FROM boat_bookings bb
JOIN booking_boat bnb ON bnb.boat_booking_id = bb.boat_booking_id
WHERE bb.is_addon = true
  AND bb.addon_mode = 'paid'
  AND bnb.subtotal <> bnb.unit_price * bnb.boat_count;

-- ------------------------------------------------------------
-- รายการทดสอบด้วยมือ (API) สำหรับหลังแก้ createBoatAddon / createKayakBooking
-- 1. จองห้องที่โปรโมชั่นให้บัตรเสริมโหมด free -> เพิ่มบัตรเสริม 1 ลำ -> ตรวจ subtotal = 0 และ unit_price = ราคาเรือปกติ
-- 2. จองห้องที่โปรโมชั่นให้บัตรเสริมโหมด paid ที่ boat_addon_price = X -> เพิ่มบัตร 2 ลำ -> ตรวจ subtotal = 2X และ unit_price = X
-- 3. ส่ง boat_count = 2.5 -> ต้องได้ 400 "จำนวนเรือต้องเป็นจำนวนเต็ม"
-- 4. จองวันนี้โดยเลือกรอบที่เริ่มไปแล้ว -> ต้องได้ 400 "ต้องจองล่วงหน้าอย่างน้อย N นาทีก่อนเวลาเริ่มรอบ"
-- 5. จองวันนี้โดยเลือกรอบที่อีกไม่ถึง N นาที (N = boat_advance_booking_minutes ใน resort_info id 5) -> ต้องได้ 400 เช่นเดียวกัน
-- 6. จองวันพรุ่งนี้ในรอบเดียวกัน -> ต้องผ่าน
