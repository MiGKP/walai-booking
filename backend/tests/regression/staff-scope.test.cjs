const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let queryHandler;
let sent = [];
const stub = (relative, exports) => {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};
stub('config/database.ts', { __esModule: true, default: { query: (...args) => queryHandler(...args) } });
stub('services/mail.service.ts', { sendPasswordResetEmail: async value => sent.push(value) });
stub('services/cloudinary.service.ts', { deleteCloudinaryImage: async () => {} });
const auth = require('../../src/controllers/auth.controller.ts');
const members = require('../../src/controllers/member.controller.ts');
const rows = data => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('staff recovery sends OTP only to the selected active staff account', async () => {
  sent = [];
  const calls = [];
  queryHandler = async (sql, values) => {
    calls.push({ sql, values });
    return sql.includes('SELECT') && sql.includes('FROM staff') ? rows([{ id: 9, email: 'qa@example.test', first_name: 'TEST' }]) : rows([]);
  };
  const res = response();
  await auth.forgotPassword({ body: { email: 'qa@example.test', account_type: 'staff' } }, res);
  assert.equal(res.code, 200);
  assert.equal(sent.length, 1);
  assert.match(calls.find(c => c.sql.includes('UPDATE')).sql, /UPDATE staff/);
  assert.match(calls[0].sql, /status = true/);
  assert.equal(calls.some(c => c.sql.includes('FROM members')), false);
});

test('staff profile actually persists contact fields instead of just echoing them', async () => {
  const calls = [];
  queryHandler = async (sql, values) => { calls.push({ sql, values }); return rows([{ staff_id: 9, email: 'qa@example.test', first_name: 'TEST', last_name: 'Staff', address: 'TEST address', line_id: 'test-line', facebook: 'test-fb' }]); };
  const res = response();
  await auth.updateProfile({ user: { id: 9, role: 'room_staff' }, body: { first_name: 'TEST', last_name: 'Staff', address: 'TEST address', line_id: 'test-line', facebook: 'test-fb' } }, res);
  assert.equal(res.code, 200);
  const update = calls.find(c => c.sql.includes('UPDATE staff'));
  assert.match(update.sql, /address/);
  assert.match(update.sql, /line_id/);
  assert.match(update.sql, /facebook/);
  assert.equal(res.body.data.address, 'TEST address');
});

test('member booking status filters use EXISTS for both services without duplicating members', async () => {
  const calls = [];
  queryHandler = async (sql, values) => { calls.push({ sql, values }); return rows([{ total: 1, active: 1, inactive: 0 }]); };
  const res = response();
  await members.getAllMembers({ query: { page: '1', limit: '10', booking_status: 'paid', booking_service: 'all' } }, res);
  const bounded = calls.find(c => c.sql.includes('LIMIT'));
  assert.match(bounded.sql, /EXISTS.*room_bookings/s);
  assert.match(bounded.sql, /EXISTS.*boat_bookings/s);
  assert.ok(bounded.values.includes('paid'));
});

test('profile validation rejects malformed or overlength contact fields before reaching PostgreSQL', async () => {
  const { validationResult } = require('express-validator');
  const { updateProfileValidator, forgotPasswordValidator } = require('../../src/middleware/validators.ts');
  for (const body of [
    { first_name: 'TEST', line_id: 'x'.repeat(101) },
    { first_name: 'TEST', facebook: 'x'.repeat(256) },
    { first_name: 'TEST', address: ['invalid'] },
    { first_name: 'TEST', email: 'not-an-email' },
  ]) {
    const req = { body }; for (const rule of updateProfileValidator) await rule.run(req);
    assert.equal(validationResult(req).isEmpty(), false);
  }
  const req = { body: { email: 'test@example.test', account_type: 'members; DROP TABLE staff' } };
  for (const rule of forgotPasswordValidator) await rule.run(req);
  assert.equal(validationResult(req).isEmpty(), false);
});
