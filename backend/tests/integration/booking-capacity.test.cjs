const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Pool } = require('pg');
require('ts-node/register/transpile-only');
const url = process.env.TEST_DATABASE_URL;
if (url && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Capacity tests require local PostgreSQL');
let pool;
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: { query: (...args) => pool.query(...args), connect: () => pool.connect() } });
stub('services/mail.service.ts', { sendBookingConfirmationEmail: async () => {}, sendBookingStatusEmail: async () => {} });
const room = require('../../src/controllers/booking.controller.ts');
const boat = require('../../src/controllers/kayak.controller.ts');
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(body) { return { body, params: {}, query: {}, user: { id: 1, role: 'customer' } }; }

test('real PostgreSQL serializes concurrent room and boat reservations without overselling', { skip: !url }, async t => {
  const admin = new Pool({ connectionString: url });
  const schema = `capacity_${require('node:crypto').randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 8 });
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  await pool.query(`
    CREATE TABLE members (member_id int, email text, first_name text, last_name text);
    CREATE TABLE resort_info (id int, infant_max_age_exclusive int, boat_advance_booking_minutes int);
    INSERT INTO resort_info VALUES (3,6,60),(5,6,60);
    CREATE TABLE room_types (id int, room_name text, type_name text, price numeric, capacity int, status boolean);
    INSERT INTO room_types VALUES (1,'TEST Room','TEST',1000,3,true);
    CREATE TABLE rooms (room_id int PRIMARY KEY, room_type_id int, room_number text, status text);
    INSERT INTO rooms VALUES (1,1,'TEST-W1','available');
    CREATE TABLE room_bookings (room_booking_id serial PRIMARY KEY, member_id int, check_in date, check_out date, guest_count int, adults int, children int, child_ages int[], special_request text, promotion_id int, status text, total_price numeric, guest_name text, guest_phone text, guest_email text);
    CREATE TABLE booking_room (booking_room_id serial PRIMARY KEY, room_booking_id int, room_id int, price_per_night numeric, nights int, subtotal numeric, status text);
    CREATE TABLE member_boat_tickets (id serial, room_booking_id int, booking_room_id int, member_id int, total_tickets int, used_tickets int DEFAULT 0, mode text, unit_price numeric);
    CREATE TABLE boat_operating_hours (day_of_week int, is_open boolean, open_time time, close_time time);
    INSERT INTO boat_operating_hours SELECT n,true,'08:00','18:00' FROM generate_series(0,6) n;
    CREATE TABLE boat_types (boat_type_id int PRIMARY KEY, type_name text, price numeric, quantity int, seat_count int);
    INSERT INTO boat_types VALUES (1,'TEST Boat',100,1,3);
    CREATE TABLE boat_rounds (boat_round_id int PRIMARY KEY, boat_type_id int, start_time time, end_time time, total_slots int, max_booking int, is_active boolean);
    INSERT INTO boat_rounds VALUES (1,1,'15:00','15:30',1,3,true);
    CREATE TABLE round_boats (boat_round_id int, boat_type_id int, quantity int);
    CREATE TABLE boat_bookings (boat_booking_id serial PRIMARY KEY, member_id int, booking_date date, start_time time, end_time time, num_passengers int, total_price numeric, status text);
    CREATE TABLE booking_boat (booking_boat_id serial PRIMARY KEY, boat_booking_id int, boat_type_id int, boat_round_id int, num_passengers int, boat_count int, unit_price numeric, subtotal numeric, status text);
  `);
  await t.test('five simultaneous requests keep the selected physical room and write one header and line', async () => {
    const responses = Array.from({ length: 5 }, response);
    await Promise.all(responses.map(res => room.createRoomBooking(request({ items: [{ room_type_id: 1, room_id: 1, quantity: 1 }], check_in_date: '2099-01-10', check_out_date: '2099-01-12', adults: 1, children: 0, child_ages: [] }), res)));
    assert.deepEqual(responses.map(res => res.code).sort(), [201,409,409,409,409]);
    assert.deepEqual((await pool.query('SELECT room_id, subtotal FROM booking_room')).rows, [{ room_id: 1, subtotal: '2000' }]);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM room_bookings')).rows[0].n, 1);
  });
  await t.test('five simultaneous requests for the last boat write exactly one boat', async () => {
    const responses = Array.from({ length: 5 }, response);
    await Promise.all(responses.map(res => boat.createKayakBooking(request({ items: [{ boat_type_id: 1, num_passengers: 3 }], booking_date: '2099-01-10', start_time: '15:00', end_time: '15:30' }), res)));
    assert.deepEqual(responses.map(res => res.code).sort(), [201,409,409,409,409]);
    assert.deepEqual((await pool.query('SELECT boat_count, num_passengers, subtotal FROM booking_boat')).rows, [{ boat_count: 1, num_passengers: 3, subtotal: '100' }]);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM boat_bookings')).rows[0].n, 1);
  });
});
