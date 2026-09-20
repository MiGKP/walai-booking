-- ช่วงเวลาที่อนุญาตให้เช็คอินตามปกติ (ใช้แสดงเตือนที่หน้าเช็คอิน-เช็คเอาต์ ไม่ได้ใช้บล็อกการเช็คอิน)
ALTER TABLE resort_info ADD COLUMN IF NOT EXISTS checkin_time_from VARCHAR(5) DEFAULT '14:00';
ALTER TABLE resort_info ADD COLUMN IF NOT EXISTS checkin_time_to VARCHAR(5) DEFAULT '23:00';

UPDATE resort_info SET checkin_time_from = '14:00', checkin_time_to = '23:00'
WHERE id = 4 AND checkin_time_from IS NULL;
