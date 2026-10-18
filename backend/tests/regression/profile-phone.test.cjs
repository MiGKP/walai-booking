const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let duplicate = false;
let calls = [];
let released = false;
const query = async (sql, values) => {
  calls.push({ sql, values });
  if (sql.includes('UNION ALL') && sql.includes('phone')) return { rows: duplicate ? [{ exists: 1 }] : [], rowCount: duplicate ? 1 : 0 };
  if (sql.includes('SELECT email, password')) return { rows: [{ email: 'staff@example.test', password: 'unused' }], rowCount: 1 };
  return { rows: [{ first_name: 'Test', phone: '0812345678' }], rowCount: 1 };
};
const stub = (name, exports) => {
  const filename = require.resolve(path.resolve(__dirname, '../../src', name));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};
stub('config/database.ts', { __esModule: true, default: { query, connect: async () => ({ query, release: () => { released = true; } }) } });
stub('services/mail.service.ts', {});
stub('services/cloudinary.service.ts', {});
const { updateProfile } = require('../../src/controllers/auth.controller.ts');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

for (const role of ['customer', 'room_staff', 'boat_staff', 'admin']) {
  test(`${role}: rejects another account's phone without updating the profile`, async () => {
    calls = []; duplicate = true; released = false;
    const res = response();
    await updateProfile({ user: { id: 9, role }, body: { first_name: 'Test', last_name: 'User', phone: '0812345678' } }, res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /เบอร์โทรศัพท์.*ใช้งานแล้ว/);
    assert.equal(calls.some(c => /UPDATE (members|staff)/.test(c.sql)), false);
    const lookup = calls.find(c => c.sql.includes('UNION ALL') && c.sql.includes('phone'));
    assert.ok(lookup);
    assert.match(lookup.sql, /member_id/);
    assert.match(lookup.sql, /staff_id/);
    assert.ok(released);
    assert.ok(calls.some(c => c.sql === 'ROLLBACK'));
  });
  test(`${role}: saves an unused phone or its own phone and commits before responding`, async () => {
    calls = []; duplicate = false; released = false;
    const res = response();
    await updateProfile({ user: { id: 9, role }, body: { first_name: 'Test', last_name: 'User', phone: '0812345678' } }, res);
    assert.equal(res.code, 200);
    assert.ok(calls.some(c => /UPDATE (members|staff)/.test(c.sql)));
    assert.ok(calls.some(c => c.sql === 'COMMIT'));
    assert.ok(released);
    const lock = calls.findIndex(c => c.sql.includes('pg_advisory_xact_lock'));
    const lookup = calls.findIndex(c => c.sql.includes('UNION ALL'));
    assert.ok(lock >= 0 && lock < lookup);
  });
}
