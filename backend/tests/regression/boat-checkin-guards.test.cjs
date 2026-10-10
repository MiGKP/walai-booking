const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let row, calls, advanceMinutes;
const rows = (data = []) => ({ rows: data, rowCount: data.length });
function stub(file, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', file));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const query = async (sql, values) => {
  calls.push({ sql, values });
  if (sql.includes('FROM resort_info')) return rows([{ boat_checkin_advance_minutes: advanceMinutes }]);
  if (sql.includes('FROM boat_bookings') && sql.includes('FOR UPDATE')) return rows([{ ...row }]);
  if (sql.includes('SET checkin_at = NOW()')) { row.checkin_at = row.current_time; row.checkin_by_staff_id = values[1]; }
  if (sql.includes("SET status = 'cancelled'")) row.status = 'cancelled';
  return rows();
};
stub('config/database.ts', { __esModule: true, default: { query, connect: async () => ({ query, release() {} }) } });
stub('services/mail.service.ts', { sendBookingConfirmationEmail: async () => {}, sendBookingStatusEmail: async () => {} });
stub('services/cloudinary.service.ts', { deleteCloudinaryImage: async () => {} });
stub('services/promotion-ledger.ts', { restoreBookingPromotions: async () => {} });
const kayak = require('../../src/controllers/kayak.controller.ts');
const lifecycle = require('../../src/services/boat-booking-lifecycle.ts');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
function setup(overrides = {}) {
  calls = []; advanceMinutes = 15;
  row = { boat_booking_id: 7, member_id: 46, room_booking_id: 12, status: 'approved', room_status: 'approved',
    total_price: 0, booking_date: '2026-10-10', start_time: '12:00:00', end_time: '13:00:00',
    checkin_at: null, handed_out_at: null, current_time: new Date('2026-10-10T05:00:00Z'), ...overrides };
}
async function checkin(staffId = 2) {
  const res = response();
  await kayak.checkinKayakBooking({ params: { id: '7' }, user: { id: staffId, role: 'boat_staff' } }, res);
  return res;
}
test('owner cannot cancel a checked-in addon or restore its tickets', async () => {
  setup(); assert.equal((await checkin()).code, 200);
  const res = response();
  await kayak.cancelBoatAddon({ params: { boatBookingId: '7' }, body: {}, user: { id: 46, role: 'customer' } }, res);
  assert.equal(res.code, 400); assert.equal(row.status, 'approved');
  assert.equal(calls.some(c => c.sql.includes('DELETE FROM boat_ticket_redemptions')), false);
});
test('parent cancellation preserves addons already checked in or handed out', async () => {
  setup({ checkin_at: new Date('2026-10-10T05:00:00Z') });
  await lifecycle.cancelBoatAddonsForRoomBooking({ query }, 12, 'pending');
  assert.equal(row.status, 'approved');
  assert.equal(calls.some(c => c.sql.includes('DELETE FROM boat_ticket_redemptions')), false);
});
for (const date of ['2099-01-01', '2026-10-09']) test(`check-in rejects a session outside its day: ${date}`, async () => {
  setup({ booking_date: date }); assert.equal((await checkin()).code, 400); assert.equal(row.checkin_at, null);
});
test('repeated check-in preserves original staff and time', async () => {
  setup(); assert.equal((await checkin(2)).code, 200);
  const original = row.checkin_at;
  assert.equal((await checkin(3)).code, 409);
  assert.equal(row.checkin_at, original); assert.equal(row.checkin_by_staff_id, 2);
  assert.equal(calls.filter(c => c.sql.includes('SET checkin_at = NOW()')).length, 1);
});
test('waiting addons can still be cancelled and return unused tickets', async () => {
  setup(); const res = response();
  await kayak.cancelBoatAddon({ params: { boatBookingId: '7' }, body: {}, user: { id: 46, role: 'customer' } }, res);
  assert.equal(res.code, 200); assert.equal(row.status, 'cancelled');
  assert.equal(calls.some(c => c.sql.includes('DELETE FROM boat_ticket_redemptions')), true);
});
for (const [now, allowed] of [
  ['2026-10-10T04:44:59.999Z', false],
  ['2026-10-10T04:45:00Z', true],
  ['2026-10-10T05:59:59.999Z', true],
  ['2026-10-10T06:00:00Z', false],
]) test(`check-in uses the inclusive opening and exclusive closing boundary ${now}`, async () => {
  setup({ current_time: new Date(now) });
  assert.equal((await checkin()).code, allowed ? 200 : 400);
  assert.equal(Boolean(row.checkin_at), allowed);
});
test('configured advance time overrides the default without changing the closing time', async () => {
  setup({ current_time: new Date('2026-10-10T04:30:00Z') }); advanceMinutes = 30;
  assert.equal((await checkin()).code, 200);
});
test('zero advance permits check-in at the start but not before it', async () => {
  setup({ current_time: new Date('2026-10-10T04:59:59Z') }); advanceMinutes = 0;
  assert.equal((await checkin()).code, 400);
  row.current_time = new Date('2026-10-10T05:00:00Z');
  assert.equal((await checkin()).code, 200);
});
test('check-in acquires parent lock before boat lock, matching addon cancellation', async () => {
  setup(); await checkin();
  const locks = calls.filter(c => c.sql.includes('FOR UPDATE'));
  assert.match(locks[0].sql, /FROM room_bookings/);
  assert.match(locks[1].sql, /FROM boat_bookings/);
});
test('handed-out addon is preserved when the parent is cancelled', async () => {
  setup({ handed_out_at: new Date('2026-10-10T05:00:00Z') });
  await lifecycle.cancelBoatAddonsForRoomBooking({ query }, 12, 'pending');
  assert.equal(row.status, 'approved');
  assert.equal(calls.some(c => c.sql.includes('DELETE FROM boat_ticket_redemptions')), false);
});
