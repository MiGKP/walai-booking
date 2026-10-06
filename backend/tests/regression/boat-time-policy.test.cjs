const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');

// Replace service boundaries before importing controllers: these tests never load
// .env, connect to PostgreSQL, send email, or contact Cloudinary.
let queryHandler;
let connectHandler;
let uploadHandler;
let deleteHandler;
const database = {
  query: (...args) => queryHandler(...args),
  connect: (...args) => connectHandler(...args),
};
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: database });
stub('services/mail.service.ts', {
  sendBookingConfirmationEmail: async () => {},
  sendBookingStatusEmail: async () => {},
  sendPaymentSlipNotificationEmail: async () => {},
});
stub('services/cloudinary.service.ts', {
  uploadImage: (...args) => uploadHandler(...args),
  deleteCloudinaryImage: (...args) => deleteHandler(...args),
});
const payment = require('../../src/controllers/payment.controller.ts');
const booking = require('../../src/controllers/booking.controller.ts');
const kayak = require('../../src/controllers/kayak.controller.ts');

function rows(data = []) { return { rows: data, rowCount: data.length }; }
function response() {
  return {
    code: 200,
    body: undefined,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function request(body = {}, params = {}) {
  return { body, params, query: {}, user: { id: 1, role: 'customer', email: 'member@example.test' } };
}
function client(handler) { return { query: handler, release() {} }; }
function barrier(count) {
  let arrivals = 0;
  let resolve;
  const ready = new Promise(r => { resolve = r; });
  return async () => { if (++arrivals === count) resolve(); await ready; };
}

function addonScenario() {
  const queries = [];
  const rounds = [
    { boat_round_id: 1, boat_type_id: 1, member_type_ids: [1], start_time: '09:00:00', end_time: '10:00:00', total_slots: 1, is_active: true },
    { boat_round_id: 2, boat_type_id: 2, member_type_ids: [2], start_time: '09:00:00', end_time: '10:00:00', total_slots: 1, is_active: true },
  ];
  connectHandler = async () => client(async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('FROM room_bookings rb') && sql.includes('FOR UPDATE OF rb')) return rows([{ room_booking_id: 7 }]);
    if (sql.includes('FROM booking_room br')) return rows([{ booking_room_id: 8, room_booking_id: 7, member_id: 1, check_in: '2099-01-01', check_out: '2099-01-04', room_status: 'pending' }]);
    if (sql.includes('SUM(total_tickets')) return rows([{ mode: 'free', unit_price: 0, balance: 1 }]);
    if (sql.includes('FROM boat_rounds br') && sql.includes('start_time =')) return rows(rounds);
    if (sql.includes('FROM boat_rounds br') && sql.includes('br.start_time = selected')) return rows(rounds);
    if (sql.includes('FROM boat_rounds br') && sql.includes('SELECT 1')) return rows([{ '?column?': 1 }]);
    if (sql.includes('FROM boat_rounds br')) return rows(rounds.filter(r => r.boat_round_id === values[0]));
    if (sql.includes('FROM boat_types')) return rows([{ boat_type_id: values[0], type_name: 'Boat', seat_count: 1, quantity: 4, price: 100 }]);
    if (sql.includes('FROM round_boats')) return rows([{ quantity: 4 }]);
    if (sql.includes('SUM(bnb.boat_count)')) return rows([{ booked_boats: 0, total_passengers: 0, total_booked: 0 }]);
    if (sql.includes('INSERT INTO boat_bookings')) return rows([{ boat_booking_id: 9 }]);
    if (sql.includes('FROM member_boat_tickets') && sql.includes('FOR UPDATE')) return rows([{ id: 1, total_tickets: 1, used_tickets: 0 }]);
    return rows();
  });
  queryHandler = async () => rows();
  return queries;
}


function withPolicy(policy, { advance = 60 } = {}) {
  addonScenario();
  const previous = connectHandler;
  connectHandler = async () => {
    const old = await previous();
    return client(async (sql, values) => {
      if (sql.includes('boat_operating_hours')) return rows(policy ? [policy] : []);
      if (sql.includes('boat_advance_booking_minutes')) return rows([{ boat_advance_booking_minutes: advance }]);
      return old.query(sql, values);
    });
  };
}
const body = date => ({ items: [{ boat_type_id: 1, num_passengers: 1 }], start_time: '09:00', end_time: '10:00', booking_date: date });
test('API rejects active rounds on a closed operating day', async () => {
  withPolicy({ is_open: false, open_time: '08:00', close_time: '18:00' });
  const res = response();
  await kayak.createKayakBooking(request(body('2099-01-02')), res);
  assert.equal(res.code, 400);
});
test('API rejects active rounds outside operating hours', async () => {
  withPolicy({ is_open: true, open_time: '10:00', close_time: '18:00' });
  const res = response();
  await kayak.createKayakBooking(request(body('2099-01-02')), res);
  assert.equal(res.code, 400);
});
test('API enforces advance booking even for tomorrow', async () => {
  withPolicy(null, { advance: 10080 });
  const today = require('../../src/utils/bangkok-date.ts').bangkokToday();
  const tomorrow = new Date(`${today}T12:00:00+07:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const res = response();
  await kayak.createKayakBooking(request(body(require('../../src/utils/bangkok-date.ts').bangkokToday(tomorrow))), res);
  assert.equal(res.code, 400);
});
test('room addons also reject closed operating days', async () => {
  withPolicy({ is_open: false, open_time: '08:00', close_time: '18:00' });
  const res = response();
  await kayak.createBoatAddon(request({ boat_type_id: 1, boat_round_id: 1, booking_date: '2099-01-02', num_passengers: 1 }, { bookingRoomId: '8' }), res);
  assert.equal(res.code, 400);
});
test('valid future rounds retain normal booking behavior', async () => {
  withPolicy({ is_open: true, open_time: '08:00', close_time: '18:00' });
  const res = response();
  await kayak.createKayakBooking(request(body('2099-01-02')), res);
  assert.equal(res.code, 201);
});

test('elapsed same-day round is rejected even with zero advance booking', async () => {
  const { validateBoatBookingTime } = require('../../src/services/boat-booking-time.ts');
  const db = client(async sql => sql.includes('boat_operating_hours') ? rows() : rows([{ boat_advance_booking_minutes: 0 }]));
  assert.match(await validateBoatBookingTime(db, '2026-10-06', '09:00', '10:00', new Date('2026-10-06T09:01:00+07:00')), /ล่วงหน้า/);
});

test('advance cutoff uses Bangkok timestamps across midnight and includes its exact boundary', async () => {
  const { validateBoatBookingTime } = require('../../src/services/boat-booking-time.ts');
  const db = client(async sql => sql.includes('boat_operating_hours') ? rows() : rows([{ boat_advance_booking_minutes: 60 }]));
  assert.match(await validateBoatBookingTime(db, '2026-10-07', '00:30', '01:30', new Date('2026-10-06T23:31:00+07:00')), /ล่วงหน้า/);
  assert.equal(await validateBoatBookingTime(db, '2026-10-07', '00:30', '01:30', new Date('2026-10-06T23:30:00+07:00')), null);
});

test('invalid dates and backwards windows never reach inventory queries', async () => {
  const { validateBoatBookingTime } = require('../../src/services/boat-booking-time.ts');
  const db = client(async () => { throw new Error('invalid window must be rejected before queries'); });
  assert.match(await validateBoatBookingTime(db, '2026-02-30', '09:00', '10:00'), /ไม่ถูกต้อง/);
  assert.match(await validateBoatBookingTime(db, '2099-01-01', '10:00', '09:00'), /ไม่ถูกต้อง/);
});
