const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Pool } = require('pg');
require('ts-node/register/transpile-only');

// Explicit opt-in: this suite creates fixtures only on a local scratch server.
const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Concurrency fixtures require a local TEST_DATABASE_URL');
}
let pool;
let afterQuery = async () => {};
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', {
  __esModule: true,
  default: {
    query: (...args) => pool.query(...args),
    connect: async () => {
      const client = await pool.connect();
      return {
        query: async (...args) => {
          const result = await client.query(...args);
          await afterQuery(args[0], result);
          return result;
        },
        release: () => client.release(),
      };
    },
  },
});
stub('services/mail.service.ts', { sendBookingConfirmationEmail: async () => {}, sendBookingStatusEmail: async () => {} });
const booking = require('../../src/controllers/booking.controller.ts');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function request(id, body = {}) {
  return { params: { bookingRoomId: String(id), id: '1' }, body, user: { id: 1, role: 'admin' } };
}

test('room status transactions serialize on PostgreSQL', { skip: !url }, async t => {
  const admin = new Pool({ connectionString: url });
  const schema = `review_${require('node:crypto').randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  await pool.query(`
    CREATE TABLE room_bookings (room_booking_id int PRIMARY KEY, status text, updated_at timestamptz, approved_by_staff_id int, reject_reason text, total_price numeric DEFAULT 100, payment_slip text);
    CREATE TABLE rooms (room_id int PRIMARY KEY, status text);
    CREATE TABLE booking_room (booking_room_id int PRIMARY KEY, room_booking_id int REFERENCES room_bookings, room_id int REFERENCES rooms, status text, checkin_at timestamptz, checkout_at timestamptz, updated_at timestamptz);
    CREATE TABLE boat_bookings (boat_booking_id int PRIMARY KEY, room_booking_id int, is_addon boolean, status text, updated_at timestamptz);
    CREATE TABLE member_boat_tickets (id int PRIMARY KEY, room_booking_id int, used_tickets int);
  `);
  async function reset(status) {
    await pool.query('TRUNCATE booking_room, rooms, room_bookings CASCADE');
    await pool.query("INSERT INTO room_bookings (room_booking_id, status, updated_at) VALUES (1, 'approved', NOW())");
    await pool.query("INSERT INTO rooms VALUES (1, 'occupied'), (2, 'occupied')");
    await pool.query('INSERT INTO booking_room (booking_room_id, room_booking_id, room_id, status) VALUES (1,1,1,$1), (2,1,2,$1)', [status]);
  }
  await t.test('cancellation cannot overwrite a concurrently successful check-in', async () => {
    await reset('approved');
    let signal;
    const readingLine = new Promise(resolve => { signal = resolve; });
    afterQuery = async sql => {
      if (sql.includes('AS line_status')) { signal(); await delay(100); }
    };
    const checkedIn = response();
    const cancelled = response();
    const checkin = booking.checkinBookingRoom(request(1), checkedIn);
    await readingLine;
    await Promise.all([checkin, booking.updateRoomBookingStatus(request(1, { status: 'cancelled' }), cancelled)]);
    assert.equal(checkedIn.code, 200);
    assert.equal(cancelled.code, 400);
    const state = await pool.query('SELECT rb.status AS header, br.status AS line FROM room_bookings rb JOIN booking_room br USING (room_booking_id) WHERE booking_room_id=1');
    assert.deepEqual(state.rows[0], { header: 'approved', line: 'checked_in' });
  });
  await t.test('concurrent checkout of the last two rooms completes the header', async () => {
    await reset('checked_in');
    afterQuery = async sql => {
      if (sql.includes('AS line_status') || sql.includes('COUNT(*)::int AS cnt')) await delay(100);
    };
    const responses = [response(), response()];
    await Promise.all(responses.map((res, i) => booking.checkoutBookingRoom(request(i + 1), res)));
    assert.deepEqual(responses.map(res => res.code), [200, 200]);
    assert.equal((await pool.query('SELECT status FROM room_bookings WHERE room_booking_id=1')).rows[0].status, 'checked_out');
    assert.deepEqual((await pool.query('SELECT status FROM booking_room ORDER BY booking_room_id')).rows.map(row => row.status), ['checked_out', 'checked_out']);
  });
});
