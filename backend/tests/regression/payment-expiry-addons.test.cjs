const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let handler;
let uploads = 0;
const rows = (data = []) => ({ rows: data, rowCount: data.length });
const db = { query: (...args) => handler(...args), connect: async () => ({ query: (...args) => handler(...args), release() {} }) };
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: db });
stub('services/mail.service.ts', { sendPaymentSlipNotificationEmail: async () => {} });
stub('services/cloudinary.service.ts', { uploadImage: async () => { uploads++; return {url:'https://example.test/slip'}; }, deleteCloudinaryImage: async () => {} });
stub('controllers/booking.controller.ts', { approveBoatAddonsForRoomBooking: async () => {} });
stub('services/promotion-ledger.ts', { restoreBookingPromotions: async (client, options) => client.query('RESTORE PROMOTIONS', [options]) });
const payment = require('../../src/controllers/payment.controller.ts');
const { cancelExpiredBookings } = require('../../src/services/auto-cancel.service.ts');
const { approveBoatAddonsForRoomBooking } = require('../../src/services/boat-booking-lifecycle.ts');
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
const user = { id: 1, role: 'customer', email:'test@example.test' };
for (const action of ['create', 'upload']) {
  test(`addon rejects standalone ${action} payment before side effects`, async () => {
    uploads = 0;
    handler = async sql => sql.includes('resort_info')
      ? rows([{ promptpay_id:'0000000000' }])
      : rows([{ ...(sql.includes('is_addon') ? { is_addon:true } : {}), status:'pending', total_price:250 }]);
    const res = response();
    if (action === 'create') await payment.createPayment({ user, body:{ booking_type:'kayak', booking_id:8 } }, res);
    else await payment.uploadPaymentSlip({ user, params:{id:'kayak_8'}, file:{buffer:Buffer.from('slip')} }, res);
    assert.equal(res.code, 400);
    assert.equal(uploads, 0);
  });
}
function expiryScenario({ roomExpired = false, addon = false } = {}) {
  const state = { room:roomExpired?'pending':'paid', boat:'pending', tickets:1, redemptions:1, total:1200, promotions:[] };
  handler = async (sql, values) => {
    if (sql.includes('payment_due_days')) return rows([{payment_due_days:3}]);
    if (sql.startsWith('UPDATE room_bookings') && sql.includes('RETURNING')) {
      if (roomExpired && state.room === 'pending') { state.room='cancelled'; return rows([{room_booking_id:7}]); }
      return rows();
    }
    if (sql.startsWith('UPDATE boat_bookings') && sql.includes('RETURNING')) {
      if (addon && /is_addon\s*=\s*false|NOT is_addon|COALESCE\(is_addon, false\) = false/.test(sql)) return rows();
      if (state.boat === 'pending') { state.boat='cancelled'; return rows([{boat_booking_id:8}]); } return rows();
    }
    if (sql.includes('SELECT') && sql.includes('FROM boat_bookings') && sql.includes('room_booking_id')) return rows(state.boat==='pending'?[{boat_booking_id:8,status:'pending',total_price:200}]:[]);
    if (sql.startsWith('DELETE FROM boat_ticket_redemptions')) { const result=rows(state.redemptions?[{member_boat_ticket_id:9,quantity:1}]:[]); state.redemptions=0; return result; }
    if (sql.startsWith('UPDATE member_boat_tickets')) state.tickets-=values[0];
    if (sql.startsWith('UPDATE boat_bookings')) state.boat='cancelled';
    if (sql.startsWith('UPDATE room_bookings') && sql.includes('total_price')) state.total-=values[0];
    if (sql==='RESTORE PROMOTIONS') state.promotions.push(values[0]);
    return rows();
  };
  return state;
}
test('paid parent protects an old pending addon from standalone expiry', async () => {
  const state = expiryScenario({ addon:true });
  await cancelExpiredBookings();
  assert.equal(state.boat,'pending'); assert.equal(state.total,1200);
});
test('room expiry cascades recent addons and restores tickets, promotions and unpaid cost', async () => {
  const state = expiryScenario({ roomExpired:true, addon:true });
  await cancelExpiredBookings();
  assert.equal(state.room,'cancelled'); assert.equal(state.boat,'cancelled');
  assert.equal(state.tickets,0); assert.equal(state.redemptions,0); assert.equal(state.total,1000);
  assert.ok(state.promotions.some(p => p.boatBookingId===8));
  const restoredCount = state.promotions.length;
  await cancelExpiredBookings();
  assert.equal(state.tickets,0); assert.equal(state.total,1000);
  assert.equal(state.promotions.length, restoredCount);
});
test('standalone boat expiry restores redeemed tickets exactly once', async () => {
  const state = expiryScenario();
  await cancelExpiredBookings(); await cancelExpiredBookings();
  assert.equal(state.boat,'cancelled'); assert.equal(state.tickets,0); assert.equal(state.redemptions,0);
});
test('ticket restoration failure rolls back cancellation instead of committing lost rights', async t => {
  t.mock.method(console, 'error', () => {});
  const calls = [];
  handler = async sql => {
    calls.push(sql);
    if (sql.includes('payment_due_days')) return rows([{payment_due_days:3}]);
    if (sql.startsWith('UPDATE boat_bookings') && sql.includes('RETURNING')) return rows([{boat_booking_id:8}]);
    if (sql.startsWith('DELETE FROM boat_ticket_redemptions')) throw new Error('simulated ticket failure');
    return rows();
  };
  await cancelExpiredBookings();
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.includes('COMMIT'),false);
});
test('parent approval includes legacy addons already marked paid', async () => {
  let status = 'paid';
  handler = async sql => {
    if (sql.includes('SELECT boat_booking_id FROM boat_bookings')) {
      return rows(sql.includes("'paid'") ? [{boat_booking_id:8}] : []);
    }
    if (sql.startsWith('UPDATE boat_bookings')) status='approved';
    return rows();
  };
  await approveBoatAddonsForRoomBooking(db,7);
  assert.equal(status,'approved');
});
