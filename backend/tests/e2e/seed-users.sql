DELETE FROM room_bookings WHERE room_booking_id=101;
DELETE FROM staff WHERE staff_id IN (1,2,3);
DELETE FROM members WHERE member_id=1;
INSERT INTO members (member_id,first_name,last_name,email,password,is_active,auth_provider) VALUES (1,'ทดสอบ','ลูกค้า','member@example.test','$2a$10$EK7XjDTlaDoKjWXd1DHMXO9si4IvgAw8zdWRUXNuLn4I9nsiGcoXm',true,'email');
INSERT INTO staff (staff_id,first_name,last_name,email,password,status,role) VALUES
 (1,'ผู้ดูแล','ระบบ','admin@example.test','$2a$10$EK7XjDTlaDoKjWXd1DHMXO9si4IvgAw8zdWRUXNuLn4I9nsiGcoXm',true,'admin'),
 (2,'เรือ','พนักงาน','boat@example.test','$2a$10$EK7XjDTlaDoKjWXd1DHMXO9si4IvgAw8zdWRUXNuLn4I9nsiGcoXm',true,'boat_staff'),
 (3,'ห้อง','พนักงาน','room@example.test','$2a$10$EK7XjDTlaDoKjWXd1DHMXO9si4IvgAw8zdWRUXNuLn4I9nsiGcoXm',true,'room_staff');
INSERT INTO room_bookings (room_booking_id,member_id,check_in,check_out,guest_count,total_price,status,adults,children) VALUES (101,1,'2099-01-10','2099-01-11',1,1000,'cancelled',1,0);
