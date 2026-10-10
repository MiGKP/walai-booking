-- เวลาเช็คอิน/รายงานตัวก่อนรอบเวลาออกเรือ (นาที) เก็บในแถวเรือของ resort_info (id = 5)
-- Safe to re-run.

ALTER TABLE resort_info
  ADD COLUMN IF NOT EXISTS boat_checkin_advance_minutes INTEGER NOT NULL DEFAULT 15
  CHECK (boat_checkin_advance_minutes >= 0 AND boat_checkin_advance_minutes <= 1440);
