const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
const { validationResult } = require('express-validator');
let state, writes, emails, committed, ticketRestores;
const rows = (data = []) => ({ rows: data, rowCount: data.length });
function stub(file, exports) {
  const id = require.resolve(path.resolve(__dirname, '../../src', file));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const query = async (sql, values = []) => {
  if (sql === 'COMMIT') committed = true;
  if (sql.startsWith('UPDATE') || sql.startsWith('INSERT') || sql.startsWith('DELETE')) writes.push({ sql, values });
  if (sql.startsWith('UPDATE boat_bookings') || sql.startsWith('UPDATE room_bookings')) return rows([{ ...state, status: values[0] }]);
  if (sql.includes('FOR UPDATE') && (sql.includes('FROM boat_bookings') || sql.includes('FROM room_bookings'))) return rows([{ ...state }]);
  if (sql.includes('SELECT 1 FROM booking_room')) return rows(state.roomStarted ? [{}] : []);
  if (sql.includes('FROM cancellation_policies')) return rows([{ full_refund_hours: 48, late_refund_percent: 0 }]);
  if (sql.includes('JOIN members m')) return rows([{ email: 'test@example.test', customer_name: 'TEST', details: 'TEST' }]);
  return rows();
};
stub('config/database.ts', { __esModule: true, default: { query, connect: async () => ({ query, release() {} }) } });
stub('services/mail.service.ts', { sendBookingStatusEmail: async data => { assert(committed); emails.push(data); } });
stub('services/promotion-ledger.ts', { restoreBookingPromotions: async () => {} });
stub('services/boat-booking-lifecycle.ts', { restoreBoatTicketRedemptions: async () => { ticketRestores++; }, approveBoatAddonsForRoomBooking: async () => {}, cancelBoatAddonsForRoomBooking: async () => {} });
const room = require('../../src/controllers/booking.controller.ts');
const boat = require('../../src/controllers/kayak.controller.ts');
const payment = require('../../src/controllers/payment.controller.ts');
const validators = require('../../src/middleware/validators.ts');
function setup(overrides = {}) {
  state = { status: 'approved', total_price: 100, payment_slip: 'https://example.test/slip', is_addon: false, checkin_at: null, handed_out_at: null, room_status: 'approved', room_booking_id: 9, hours_before_start: 72, ...overrides };
  writes = []; emails = []; committed = false; ticketRestores = 0;
}
async function call(fn, body = { status: 'rejected', reject_reason: 'เหตุผลทดสอบ' }, id = '7') {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(data) { this.body = data; } };
  await fn({ params: { id }, body, user: { id: 2, role: 'admin' } }, res);
  await new Promise(setImmediate);
  return res;
}
for (const [kind, fn] of [['room', room.updateRoomBookingStatus], ['kayak', boat.updateKayakBookingStatus]]) {
  test(`${kind} rejects waiting bookings and emails the exact reason after commit`, async () => {
    setup(); assert.equal((await call(fn)).code, 200);
    assert.equal(emails.length, 1); assert.equal(emails[0].rejectReason, 'เหตุผลทดสอบ');
    assert.equal(emails[0].status, 'rejected');
  });
  test(`${kind} cannot reject after check-in or checkout`, async () => {
    for (const overrides of [{ roomStarted: true, checkin_at: new Date() }, { status: 'checked_out' }, { status: 'rejected' }, { status: 'cancelled' }]) {
      setup(overrides); assert.equal((await call(fn)).code, 400);
      assert.equal(writes.length, 0); assert.equal(emails.length, 0);
    }
  });
}
test('staff rejection of a paid room addon preserves refund rules, tickets, reason and rejected status', async () => {
  setup({ is_addon: true }); assert.equal((await call(boat.updateKayakBookingStatus)).code, 200);
  assert(writes.some(w => w.sql.includes('UPDATE boat_bookings') && w.sql.includes("status = 'rejected'") && w.values.includes('เหตุผลทดสอบ')));
  assert(writes.some(w => w.sql.includes('UPDATE booking_boat') && w.sql.includes("status = 'rejected'")));
  const refund = writes.find(w => w.sql.includes('INSERT INTO booking_refunds'));
  assert.equal(refund.values[2], 100); assert.equal(refund.values[5], 'เหตุผลทดสอบ');
  assert.equal(ticketRestores, 1); assert.equal(emails.length, 1); assert.equal(emails[0].rejectReason, 'เหตุผลทดสอบ');
});
test('handed-out room addons cannot be rejected or refunded', async () => {
  setup({ is_addon: true, handed_out_at: new Date() });
  assert.equal((await call(boat.updateKayakBookingStatus)).code, 400);
  assert.equal(writes.length, 0); assert.equal(emails.length, 0);
});
for (const scenario of [
  { hours_before_start: 1, total_price: 100, room_status: 'approved', refund: 0, reduction: 0, ledger: true },
  { total_price: 100, room_status: 'pending', refund: 0, reduction: 100, ledger: false },
  { total_price: 0, room_status: 'approved', refund: 0, reduction: 0, ledger: false },
]) test(`addon rejection preserves late, unpaid and free financial rules ${JSON.stringify(scenario)}`, async () => {
  setup({ is_addon: true, ...scenario }); const res = await call(boat.updateKayakBookingStatus);
  assert.equal(res.code, 200); assert.equal(res.body.data.refund_amount, scenario.refund);
  assert.equal(res.body.data.room_total_reduction, scenario.reduction);
  assert.equal(writes.some(w => w.sql.includes('INSERT INTO booking_refunds')), scenario.ledger);
  assert.equal(ticketRestores, 1);
});
test('both approval endpoints notify the customer after saving', async () => {
  for (const prefix of ['room', 'kayak']) {
    setup({ status: 'paid' }); assert.equal((await call(payment.confirmPayment, {}, `${prefix}_7`)).code, 200);
    assert.equal(emails.length, 1); assert.equal(emails[0].status, 'approved');
  }
});
test('both status validators require a bounded nonempty rejection reason', async () => {
  for (const name of ['updateRoomBookingStatusValidator', 'updateKayakBookingStatusValidator']) {
    for (const reject_reason of [undefined, '   ', 'x'.repeat(501), ['reason']]) {
      const req = { params: { id: '7' }, body: { status: 'rejected', reject_reason } };
      for (const rule of validators[name]) await rule.run(req);
      assert(!validationResult(req).isEmpty(), `${name} accepted an invalid reason`);
    }
  }
});
