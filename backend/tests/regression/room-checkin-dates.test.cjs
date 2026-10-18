const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { bangkokToday } = require('../../src/utils/bangkok-date.ts');
const today = bangkokToday();
const day = offset => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
let line, writes;
const query = async sql => {
  if (sql.includes('AS line_status')) return { rows: [line] };
  if (sql.includes('UPDATE booking_room')) writes++;
  return { rows: [], rowCount: 0 };
};
const filename = require.resolve('../../src/config/database.ts');
require.cache[filename] = { id: filename, filename, loaded: true, exports: { __esModule: true, default: { query, connect: async () => ({ query, release() {} }) } } };
const { checkinBookingRoom } = require('../../src/controllers/booking.controller.ts');
for (const scenario of [
  { name: 'today', start: 0, end: 1, confirmation: undefined, expected: 200 },
  { name: 'late without confirmation', start: -1, end: 1, confirmation: undefined, expected: 400 },
  { name: 'late after confirmation', start: -1, end: 1, confirmation: true, expected: 200 },
  { name: 'late with a string instead of explicit confirmation', start: -1, end: 1, confirmation: 'true', expected: 400 },
  { name: 'tomorrow even with confirmation', start: 1, end: 2, confirmation: true, expected: 400 },
  { name: 'checkout day', start: -1, end: 0, confirmation: true, expected: 400 },
  { name: 'expired stay', start: -6, end: -5, confirmation: true, expected: 400 },
]) {
  test(`room check-in date guard: ${scenario.name}`, async () => {
    line = { line_status: 'approved', header_status: 'approved', check_in_date: day(scenario.start), check_out_date: day(scenario.end) }; writes = 0;
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await checkinBookingRoom({ params: { bookingRoomId: '1' }, user: { id: 1, role: 'room_staff' }, body: { confirm_late_checkin: scenario.confirmation } }, res);
    assert.equal(res.code, scenario.expected);
    assert.equal(writes, scenario.expected === 200 ? 1 : 0);
  });
}

test('room check-in validator accepts only an explicit boolean confirmation', async () => {
  const { checkinRoomValidator } = require('../../src/middleware/validators.ts');
  const { validationResult } = require('express-validator');
  for (const value of [undefined, false, true, 'true', 'false', 1, [], {}]) {
    const req = { params: { bookingRoomId: '1' }, body: value === undefined ? {} : { confirm_late_checkin: value } };
    for (const rule of checkinRoomValidator) await rule.run(req);
    assert.equal(validationResult(req).isEmpty(), value === undefined || typeof value === 'boolean');
  }
});
