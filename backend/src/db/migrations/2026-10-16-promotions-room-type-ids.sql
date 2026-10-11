-- Migration: Add room_type_ids array to promotions for multi-room-type support
-- Safe to re-run.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS room_type_ids INTEGER[] NOT NULL DEFAULT '{}';

-- Backfill existing rows that have room_type_id set
UPDATE promotions
SET room_type_ids = ARRAY[room_type_id]
WHERE room_type_id IS NOT NULL AND (room_type_ids IS NULL OR cardinality(room_type_ids) = 0);
