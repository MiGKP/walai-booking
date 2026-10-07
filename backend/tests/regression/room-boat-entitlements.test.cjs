const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let queryHandler;
const database = { query: (...args) => queryHandler(...args), connect: async () => ({ query: (...args) => queryHandler(...args), release() {} }) };
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: database });
stub('services/mail.service.ts', { sendBookingConfirmationEmail: async () => {}, sendBookingStatusEmail: async () => {} });
stub('services/cloudinary.service.ts', {});
const qrModule = require.resolve('qrcode');
require.cache[qrModule] = { id: qrModule, filename: qrModule, loaded: true, exports: { toDataURL: async () => 'data:image/png;base64,test' } };
const rooms = require('../../src/controllers/booking.controller.ts');
const kayaks = require('../../src/controllers/kayak.controller.ts');
const payments = require('../../src/controllers/payment.controller.ts');
const rows = (data = []) => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = (params = {}, body = {}) => ({ params, body, user: { id: 1, role: 'customer' } });
const exhausted = { total_tickets: 3, used_tickets: 3, remaining_tickets: 0, free_tickets: 2, paid_tickets: 1, valid_from: '2099-01-02', valid_to: '2099-01-03' };
function assertSummaryProjection(sql) {
  assert.match(sql, /FROM member_boat_tickets/);
  assert.match(sql, /mbt\.room_booking_id = rb\.room_booking_id/);
  assert.match(sql, /mbt\.room_booking_id = rb\.room_booking_id\s+AND mbt\.booking_room_id IS NOT NULL/);
  for (const field of Object.keys(exhausted)) assert.ok(sql.includes(`'${field}'`), field);
  assert.match(sql, /SUM\(mbt\.total_tickets\)/);
  assert.match(sql, /SUM\(mbt\.used_tickets\)/);
  assert.match(sql, /FILTER \(WHERE mbt\.mode = 'free'\)/);
  assert.match(sql, /FILTER \(WHERE mbt\.mode = 'paid'\)/);
  assert.match(sql, /'valid_from', to_char\(rb\.check_in, 'YYYY-MM-DD'\)/);
  assert.match(sql, /'valid_to', to_char\(rb\.check_out, 'YYYY-MM-DD'\)/);
  const aggregate = sql.slice(sql.indexOf("'total_tickets'"), sql.indexOf(') AS boat_ticket_summary'));
  assert.doesNotMatch(aggregate, /used_tickets\s*<\s*(?:mbt\.)?total_tickets/, 'exhausted grants must remain in the summary');
}
for (const [name, handler, params] of [['list', rooms.getUserRoomBookings, {}], ['detail', rooms.getRoomBookingById, { id: '7' }]]) {
  test(`room ${name} retains exhausted grant summary from authoritative projection`, async () => {
    queryHandler = async sql => {
      if (sql.includes('AS boat_ticket_summary')) {
        assertSummaryProjection(sql);
        return rows([{ id: 7, boat_ticket_summary: exhausted }]);
      }
      if (sql.includes('FROM room_bookings rb')) return rows([{ id: 7 }]);
      return rows();
    };
    const res = response();
    await handler(request(params), res);
    const booking = name === 'list' ? res.body.data[0] : res.body.data;
    assert.deepEqual(booking.boat_ticket_summary, exhausted);
  });
}
test('room history does not advertise legacy wallet grants as room-addon availability', async () => {
  let statement;
  queryHandler = async sql => {
    if (sql.includes('AS has_unused_boat_tickets')) statement = sql;
    return rows();
  };
  await rooms.getUserRoomBookings(request(), response());
  assert.match(statement, /mbt\.booking_room_id IS NOT NULL[\s\S]*?mbt\.used_tickets < mbt\.total_tickets\) AS has_unused_boat_tickets/);
});
for (const scenario of [
  { name: 'paid parent with free tickets redeemed and paid grants remaining', remaining: 1 },
  { name: 'checked-out physical room grant with another room still active', remaining: 2 },
]) {
  test(`room summary separates bookable grants for ${scenario.name}`, async () => {
    queryHandler = async sql => {
      if (sql.includes('AS boat_ticket_summary')) {
        const correctEligibility = sql.includes("'bookable_tickets'") &&
          /JOIN booking_room\s+\w+ ON/.test(sql) &&
          /\w+\.status IN \('pending', 'paid', 'approved'\)/.test(sql) &&
          /rb\.status IN \('pending', 'paid', 'approved'\)/.test(sql) &&
          /mbt\.mode = 'free' OR rb\.status = 'pending'/.test(sql);
        return rows([{ id: 7, boat_ticket_summary: {
          ...exhausted, remaining_tickets: scenario.remaining,
          ...(correctEligibility ? { bookable_tickets: 0 } : {}),
        } }]);
      }
      return rows();
    };
    const res = response();
    await rooms.getUserRoomBookings(request(), res);
    assert.equal(res.body.data[0].boat_ticket_summary.bookable_tickets, 0);
    assert.equal(res.body.data[0].boat_ticket_summary.remaining_tickets, scenario.remaining);
  });
}
for (const [name, handler, params, body] of [
  ['create', payments.createPayment, {}, { booking_type: 'room', booking_id: 7 }],
  ['detail', payments.getPaymentById, { id: 'room_7' }, {}],
]) {
  test(`room payment ${name} excludes legacy wallet grants from addon signal`, async () => {
    queryHandler = async sql => {
      if (sql.includes('FROM room_bookings')) return rows([{
        total_price: 100, payment_status: 'pending', status: 'pending',
        has_boat_tickets: !sql.includes('booking_room_id IS NOT NULL'),
      }]);
      return rows();
    };
    const res = response();
    await handler(request(params, body), res);
    assert.equal(res.code, name === 'create' ? 201 : 200);
    assert.equal(res.body.data.has_boat_tickets, false);
  });
}
test('room create returns persisted grant summary before committing', async () => {
  const statements = [];
  queryHandler = async (sql, values = []) => {
    statements.push(sql);
    if (sql.includes('AS boat_ticket_summary')) { assertSummaryProjection(sql); return rows([{ boat_ticket_summary: { ...exhausted, total_tickets: 0, used_tickets: 0, free_tickets: 0, paid_tickets: 0 } }]); }
    if (sql.includes('infant_max_age_exclusive')) return rows([{ infant_max_age_exclusive: 6 }]);
    if (sql.includes('FROM room_types WHERE id')) return rows([{ id: 1, price: 100, capacity: 2, room_name: 'Room' }]);
    if (sql.includes('FROM rooms')) return rows([{ room_id: 10, room_number: '10' }]);
    if (sql.includes('INSERT INTO room_bookings')) return rows([{ room_booking_id: 7, total_price: 100 }]);
    if (sql.includes('INSERT INTO booking_room')) return rows([{ booking_room_id: 8, room_id: 10 }]);
    return rows();
  };
  const res = response();
  await rooms.createRoomBooking(request({}, { items: [{ room_type_id: 1, quantity: 1 }], check_in_date: '2099-01-01', check_out_date: '2099-01-04', adults: 1, children: 0 }), res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.boat_ticket_summary.total_tickets, 0);
  assert.ok(statements.findIndex(sql => sql.includes('AS boat_ticket_summary')) < statements.indexOf('COMMIT'));
});
test('addon info exposes total and redeemed tickets even at zero balance', async () => {
  queryHandler = async sql => {
    if (sql.includes('FROM booking_room br')) return rows([{ member_id: 1, check_in: '2099-01-01', check_out: '2099-01-04', room_status: 'approved' }]);
    if (sql.includes('FROM member_boat_tickets')) {
      return rows([{ mode: 'free', unit_price: 0, balance: 0, ...(sql.includes('AS total_tickets') ? { total_tickets: 2, used_tickets: 2 } : {}) }]);
    }
    return rows();
  };
  const res = response();
  await kayaks.getBoatAddonInfo(request({ bookingRoomId: '8' }), res);
  assert.equal(res.body.data.total_tickets, 2);
  assert.equal(res.body.data.used_tickets, 2);
  assert.equal(res.body.data.balance, 0);
});
test('one-night addon grant includes both arrival and departure dates', async () => {
  queryHandler = async sql => sql.includes('FROM booking_room br') ? rows([{ member_id: 1, check_in: '2099-01-01', check_out: '2099-01-02', room_status: 'pending' }]) : sql.includes('FROM member_boat_tickets') ? rows([{ mode: 'free', unit_price: 0, balance: 2, total_tickets: 2, used_tickets: 0 }]) : rows();
  const res = response();
  await kayaks.getBoatAddonInfo(request({ bookingRoomId: '8' }), res);
  assert.equal(res.body.data.valid_from, '2099-01-01');
  assert.equal(res.body.data.valid_to, '2099-01-02');
  assert.equal(res.body.data.total_tickets, 2);
});
for (const [name, handler, params] of [['list', kayaks.getUserKayakBookings, {}], ['detail', kayaks.getKayakBookingById, { id: '9' }]]) {
  test(`kayak ${name} exposes owning room and addon mode`, async () => {
    queryHandler = async sql => rows(sql.includes('bb.*') ? [{ boat_booking_id: 9, is_addon: true, room_booking_id: 7, booking_room_id: 8, addon_mode: 'paid' }] : []);
    const res = response();
    await handler(request(params), res);
    const booking = name === 'list' ? res.body.data[0] : res.body.data;
    assert.equal(booking.room_booking_id, 7);
    assert.equal(booking.booking_room_id, 8);
    assert.equal(booking.addon_mode, 'paid');
  });
}
