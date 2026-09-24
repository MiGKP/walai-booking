-- Additive only. Structured, categorized facilities & amenities list for the resort's room-related
-- info row (resort_info.id = 4, name = 'ห้องพัก'), shown on the room detail page. Stored as JSONB so
-- the frontend can render it dynamically without a schema change per category/item.
-- Shape: [{ "category": string, "icon": string (lucide-react icon name), "items": string[] }]

ALTER TABLE resort_info ADD COLUMN IF NOT EXISTS facilities JSONB;
