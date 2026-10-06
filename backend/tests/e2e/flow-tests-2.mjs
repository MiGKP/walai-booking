import { createRequire } from 'node:module';

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
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
async function login(email, password = 'Passw0rd!') {
  const r = await call('POST', '/auth/login', null, { email, password });
  return r.json?.data?.token ?? null;
}
const bookingBody = (checkIn, checkOut, extra = {}) => ({
  check_in_date: checkIn,
  check_out_date: checkOut,
  adults: 1,
  children: 0,
  ...extra,
});
const promoUsage = async (id) => Number((await db.query('SELECT usage_count FROM promotions WHERE id = $1', [id])).rows[0].usage_count);
const ledgerCount = async (bookingId) => Number((await db.query('SELECT COUNT(*)::int AS n FROM booking_promotions WHERE room_booking_id = $1', [bookingId])).rows[0].n);

const memberToken = await login('member@example.test');
const adminToken = await login('admin@example.test');
check('logins ok', !!memberToken && !!adminToken);

// ---------- A) room booking with a valid promo ----------
let r = await call('POST', '/bookings/room', memberToken, bookingBody('2099-02-01', '2099-02-03', {
  items: [{ room_type_id: 1, quantity: 1, promotion_id: 1 }],
}));
const bookingA = r.json?.data?.room_booking_id ?? r.json?.data?.booking?.room_booking_id ?? r.json?.data?.id;
check('valid promo booking created', r.status === 201 || r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
const usageAfterBook = await promoUsage(1);
check('valid promo increments usage_count to 1', usageAfterBook === 1, `usage ${usageAfterBook}`);
if (bookingA) {
  check('ledger row written for the booking', (await ledgerCount(bookingA)) === 1);
  const total = Number((await db.query('SELECT total_price FROM room_bookings WHERE room_booking_id = $1', [bookingA])).rows[0].total_price);
  check('discount applied (2 nights x 1000 -10%)', total === 1800, `total ${total}`);
}

// ---------- B) cancel restores promo quota and wallet ledger ----------
if (bookingA) {
  r = await call('PUT', `/bookings/${bookingA}/cancel`, memberToken);
  check('customer can cancel pending booking', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
  check('cancel restores usage_count to 0', (await promoUsage(1)) === 0, `usage ${await promoUsage(1)}`);
  check('cancel removes ledger rows', (await ledgerCount(bookingA)) === 0);
}

// ---------- C) promo rejections ----------
for (const [id, label] of [[2, 'expired promo'], [3, 'promo at usage limit'], [4, 'kayak-only promo used for room']]) {
  r = await call('POST', '/bookings/room', memberToken, bookingBody('2099-05-01', '2099-05-02', {
    items: [{ room_type_id: 1, quantity: 1, promotion_id: id }],
  }));
  check(`${label} rejected`, r.status === 400, `status ${r.status} ${r.json?.message ?? ''}`);
}

// ---------- D) concurrency: one explicit room cannot be double-booked ----------
const burst = await Promise.all(
  Array.from({ length: 5 }, () => call('POST', '/bookings/room', memberToken, bookingBody('2099-03-01', '2099-03-03', {
    items: [{ room_type_id: 1, quantity: 1, room_id: 1 }],
  }))),
);
const okBurst = burst.filter((x) => x.status === 201 || x.status === 200).length;
check('5 parallel requests for same explicit room: exactly 1 succeeds', okBurst === 1, `successes ${okBurst}, statuses ${burst.map((x) => x.status).join(',')}`);
const overlapRows = Number((await db.query(
  `SELECT COUNT(*)::int AS n FROM booking_room br JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
   WHERE br.room_id = 1 AND br.status NOT IN ('cancelled','rejected','checked_out') AND rb.check_in < '2099-03-03' AND rb.check_out > '2099-03-01'`,
)).rows[0].n);
check('database holds exactly 1 active line for room 1 in that window', overlapRows === 1, `rows ${overlapRows}`);

// ---------- E) auto-assign: 3 parallel requests on a 2-room type -> 2 succeed ----------
const autoBurst = await Promise.all(
  Array.from({ length: 3 }, () => call('POST', '/bookings/room', memberToken, bookingBody('2099-04-01', '2099-04-03', {
    items: [{ room_type_id: 1, quantity: 1 }],
  }))),
);
const okAuto = autoBurst.filter((x) => x.status === 201 || x.status === 200).length;
check('3 parallel auto-assign requests on 2 rooms: exactly 2 succeed', okAuto === 2, `successes ${okAuto}, statuses ${autoBurst.map((x) => x.status).join(',')}`);
const distinctRooms = Number((await db.query(
  `SELECT COUNT(DISTINCT br.room_id)::int AS n FROM booking_room br JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
   WHERE rb.check_in = '2099-04-01' AND br.status NOT IN ('cancelled','rejected','checked_out')`,
)).rows[0].n);
check('auto-assigned lines use distinct rooms', distinctRooms === 2, `distinct ${distinctRooms}`);

// ---------- F) review only after checkout ----------
const bookingF = autoBurst.map((x) => x.json?.data?.room_booking_id ?? x.json?.data?.booking?.room_booking_id ?? x.json?.data?.id).find(Boolean);
if (bookingF) {
  r = await call('PUT', `/bookings/${bookingF}/status`, adminToken, { status: 'approved' });
  check('admin approves pending booking', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
  r = await call('POST', '/reviews', memberToken, { room_booking_id: bookingF, room_type_id: 1, rating: 5, comment: 'ดีมาก' });
  check('review rejected before checkout', r.status === 403, `status ${r.status}`);
  r = await call('PUT', `/bookings/${bookingF}/checkout`, adminToken);
  check('checkout rejected when no room was checked in', r.status === 400, `status ${r.status} ${r.json?.message ?? ''}`);
  const lineF = (await db.query('SELECT booking_room_id FROM booking_room WHERE room_booking_id = $1 LIMIT 1', [bookingF])).rows[0];
  r = await call('PUT', `/bookings/booking-rooms/${lineF.booking_room_id}/checkin`, adminToken);
  check('admin checks in the room line', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
  r = await call('PUT', `/bookings/${bookingF}/checkout`, adminToken);
  check('admin checks out booking', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
  r = await call('POST', '/reviews', memberToken, { room_booking_id: bookingF, room_type_id: 1, rating: 5, comment: 'ดีมาก' });
  check('review accepted after checkout', r.status === 201 || r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
} else {
  check('booking id available for review test', false, 'no booking id parsed from auto burst');
}

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await db.end();
process.exit(failed.length ? 1 : 0);
