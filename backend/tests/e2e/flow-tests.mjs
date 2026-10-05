import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(process.cwd() + '/package.json');
const { Client } = require('pg');

const API = process.env.TEST_API_URL || 'http://localhost:5055/api';
const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function login(email, password = 'Passw0rd!') {
  const r = await call('POST', '/auth/login', null, { email, password });
  return r.json?.data?.token ?? null;
}

// ---------- 1) login ----------
const memberToken = await login('member@example.test');
const adminToken = await login('admin@example.test');
const boatToken = await login('boat@example.test');
const roomToken = await login('room@example.test');
check('member login returns token', !!memberToken);
check('admin login returns token', !!adminToken);
check('boat staff login returns token', !!boatToken);
check('room staff login returns token', !!roomToken);

// ---------- 2) role-scoped routes ----------
let r = await call('GET', '/bookings/my', memberToken);
check('customer can list own bookings', r.status === 200, `status ${r.status}`);
r = await call('GET', '/bookings/my', adminToken);
check('staff token blocked from customer-only route (authorize customer)', r.status === 403, `status ${r.status}`);

// ---------- 3) IDOR: staff must not read customer booking by id ----------
r = await call('GET', '/bookings/101', memberToken);
check('owner can read own booking by id', r.status === 200, `status ${r.status}`);
r = await call('GET', '/bookings/101', roomToken);
check('room staff cannot read customer booking by id (member_id overlap)', r.status === 404, `status ${r.status}`);

// ---------- 4) cross-type payment confirmation ----------
r = await call('PUT', '/payments/room_101/confirm', boatToken);
check('boat staff cannot confirm a room booking payment', r.status === 403, `status ${r.status}`);

// ---------- 5) status transition guard ----------
r = await call('PUT', '/bookings/101/status', adminToken, { status: 'approved' });
check('cancelled booking cannot be approved', r.status === 400, `status ${r.status} ${r.json?.message ?? ''}`);

// ---------- 6) disabled customer loses access immediately ----------
await db.query('UPDATE members SET is_active = false WHERE member_id = 1');
r = await call('GET', '/bookings/my', memberToken);
check('disabled customer token rejected immediately', r.status === 401, `status ${r.status} ${r.json?.message ?? ''}`);
r = await call('POST', '/auth/login', null, { email: 'member@example.test', password: 'Passw0rd!' });
check('disabled customer cannot log in', r.status === 401, `status ${r.status}`);
await db.query('UPDATE members SET is_active = true WHERE member_id = 1');

// ---------- 7) staff role change takes effect on existing token ----------
r = await call('GET', '/kayaks/bookings/all', boatToken);
check('boat staff can reach boat-staff route before role change', r.status === 200, `status ${r.status}`);
await db.query("UPDATE staff SET role = 'room_staff' WHERE staff_id = 2");
r = await call('GET', '/kayaks/bookings/all', boatToken);
check('role downgraded in DB applies to existing token', r.status === 403, `status ${r.status}`);
await db.query("UPDATE staff SET role = 'boat_staff' WHERE staff_id = 2");

// ---------- 8) forgot-password does not reveal account existence ----------
const existing = await call('POST', '/auth/forgot-password', null, { email: 'member@example.test' });
const missing = await call('POST', '/auth/forgot-password', null, { email: 'nobody@example.test' });
check('forgot-password existing email generic response', existing.status === 200 && existing.json?.data === null, `status ${existing.status}`);
check('forgot-password missing email same shape', missing.status === 200 && JSON.stringify(existing.json) === JSON.stringify(missing.json));

// ---------- 9) OTP attempt limit ----------
const otp = '123456';
await db.query(
  "UPDATE members SET reset_token = $1, reset_token_expires_at = NOW() + interval '1 hour', reset_attempts = 0 WHERE member_id = 1",
  [crypto.createHash('sha256').update(otp).digest('hex')],
);
let wrongStatuses = [];
for (let i = 0; i < 5; i += 1) {
  const w = await call('POST', '/auth/reset-password', null, { email: 'member@example.test', otp: '000000', new_password: 'Changed123' });
  wrongStatuses.push(w.status);
}
const att = await db.query('SELECT reset_attempts, reset_token FROM members WHERE member_id = 1');
check('5 wrong OTP attempts all rejected', wrongStatuses.every((s) => s === 400), wrongStatuses.join(','));
check('attempt counter recorded 5 and token cleared', Number(att.rows[0].reset_attempts) === 5 && att.rows[0].reset_token === null, JSON.stringify(att.rows[0]));
await db.query(
  "UPDATE members SET reset_token = $1, reset_token_expires_at = NOW() + interval '1 hour', reset_attempts = 5 WHERE member_id = 1",
  [crypto.createHash('sha256').update(otp).digest('hex')],
);
r = await call('POST', '/auth/reset-password', null, { email: 'member@example.test', otp, new_password: 'Changed123' });
check('correct OTP rejected after attempts exhausted', r.status === 400, `status ${r.status}`);

// ---------- 10) password change revokes older sessions ----------
await new Promise((res) => setTimeout(res, 1100));
const oldMemberToken = await login('member@example.test');
r = await call('PUT', '/auth/change-password', oldMemberToken, { current_password: 'Passw0rd!', new_password: 'Changed123' });
check('change password succeeds', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
r = await call('GET', '/bookings/my', oldMemberToken);
check('session issued before change is revoked', r.status === 401, `status ${r.status} ${r.json?.message ?? ''}`);
await new Promise((res) => setTimeout(res, 1100));
const newMemberToken = await login('member@example.test', 'Changed123');
r = await call('GET', '/bookings/my', newMemberToken);
check('login after change works with new token', r.status === 200, `status ${r.status}`);

// ---------- 11) public reviews show last-name initial ----------
r = await call('GET', '/reviews/public');
check('public reviews endpoint responds', r.status === 200, `status ${r.status}`);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await db.end();
process.exit(failed.length ? 1 : 0);
