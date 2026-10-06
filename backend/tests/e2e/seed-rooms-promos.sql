DELETE FROM booking_room_promotions;
DELETE FROM booking_promotions;
DELETE FROM reviews;
DELETE FROM booking_room;
DELETE FROM room_bookings WHERE room_booking_id <> 101;
DELETE FROM promotions;
DELETE FROM rooms;
DELETE FROM room_types;

INSERT INTO room_types (id, room_name, type_name, price, capacity, description, status)
VALUES (1, 'ห้องทดสอบ', 'Test Type', 1000, 2, 'test', true);

INSERT INTO rooms (room_id, room_type_id, room_number, status) VALUES
  (1, 1, '101', 'available'),
  (2, 1, '102', 'available');

INSERT INTO promotions (id, code, name, discount_type, discount_value, is_active, start_date, end_date,
                        usage_limit, usage_count, usage_limit_per_member, is_collectible, stackable, applies_to, boat_ticket_count)
VALUES
  (1, 'TEST10', 'ลด 10%', 'percent', 10, true, NULL, '2099-12-31', 5, 0, NULL, false, false, 'room', 0),
  (2, 'EXPIRED', 'หมดอายุ', 'percent', 10, true, '2020-01-01', '2020-12-31', NULL, 0, NULL, false, false, 'room', 0),
  (3, 'FULL', 'เต็มโควตา', 'percent', 10, true, NULL, '2099-12-31', 1, 1, NULL, false, false, 'room', 0),
  (4, 'KAYAKONLY', 'เรือเท่านั้น', 'percent', 10, true, NULL, '2099-12-31', NULL, 0, NULL, false, false, 'kayak', 0);

SELECT setval(pg_get_serial_sequence('room_types','id'), 10);
