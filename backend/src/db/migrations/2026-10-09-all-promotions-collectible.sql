-- ทุกโปรโมชั่นต้องเก็บเข้ากระเป๋าก่อนใช้ (ตั้งค่า is_collectible เป็น true ทั้งหมด)
-- Safe to re-run.

UPDATE promotions SET is_collectible = TRUE WHERE is_collectible IS NOT TRUE;
