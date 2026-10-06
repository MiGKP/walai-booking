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
const promoUsage = async (id) => Number((await db.query('SELECT usage_count FROM promotions WHERE id = $1', [id])).rows[0].usage_count);

const memberToken = await login('member@example.test');
const adminToken = await login('admin@example.test');
check('logins ok', !!memberToken && !!adminToken);

// 1) ยกเลิกหลังอนุมัติ ต้องคืนโควตาโปรโมชั่น
const usageBefore = await promoUsage(1);
let r = await call('POST', '/bookings/room', memberToken, {
  check_in_date: '2099-06-01', check_out_date: '2099-06-02', adults: 1, children: 0,
  items: [{ room_type_id: 1, quantity: 1, promotion_id: 1 }],
});
const bookingId = r.json?.data?.room_booking_id ?? r.json?.data?.booking?.room_booking_id ?? r.json?.data?.id;
check('booking with promo created', (r.status === 201 || r.status === 200) && !!bookingId, `status ${r.status}`);
check('usage incremented by booking', (await promoUsage(1)) === usageBefore + 1);
r = await call('PUT', `/bookings/${bookingId}/status`, adminToken, { status: 'approved' });
check('admin approves booking', r.status === 200, `status ${r.status}`);
r = await call('PUT', `/bookings/${bookingId}/status`, adminToken, { status: 'cancelled' });
check('admin cancels approved booking', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);
check('approved cancellation restores promo usage', (await promoUsage(1)) === usageBefore, `usage ${await promoUsage(1)} expected ${usageBefore}`);

// 2) จองย้อนหลังไม่ได้
r = await call('POST', '/bookings/room', memberToken, {
  check_in_date: '2020-01-01', check_out_date: '2020-01-02', adults: 1, children: 0,
  items: [{ room_type_id: 1, quantity: 1 }],
});
check('backdated room booking rejected', r.status === 400, `status ${r.status} ${r.json?.message ?? ''}`);

// 3) ลดโควตาเรือ/รอบ/ประเภทเรือ ต้องไม่กระทบการจองที่ยังไม่เช็คเอาต์ (ทดสอบเฉพาะ path การตอบ 400 กับจำนวนติดลบ)
r = await call('PUT', '/kayaks/1', adminToken, { quantity: 2 });
check('cannot reduce boat fleet below unfinished bookings (3 boats booked)', r.status === 400, `status ${r.status} ${r.json?.message ?? ''}`);
r = await call('PUT', '/kayaks/1', adminToken, { quantity: 5 });
check('boat fleet can still be set at or above booked count', r.status === 200, `status ${r.status} ${r.json?.message ?? ''}`);

// 4) ปิดใช้งานประเภทห้องแทนการลบ และหน้าบ้านไม่แสดง
r = await call('DELETE', '/rooms/1', adminToken);
const rtStatus = (await db.query('SELECT status FROM room_types WHERE id = 1')).rows[0];
check('deleteRoom deactivates room type instead of deleting', r.status === 200 && rtStatus && rtStatus.status === false, `status ${r.status}, room_type status ${rtStatus?.status}`);
r = await call('GET', '/rooms/1', null);
check('deactivated room type hidden from public', r.status === 404 || r.json?.data == null, `status ${r.status}`);
await db.query('UPDATE room_types SET status = true WHERE id = 1');

// 5) GET /settings/resort ส่งเฉพาะฟิลด์ที่กำหนด
r = await call('GET', '/settings/resort?id=3', null);
const keys = Object.keys(r.json?.data ?? {}).sort();
const allowed = ['address','additional_terms','bank_account_name','bank_account_no','checkin_time_from','checkin_time_to','checkout_time','coordinates','email','facebook','facilities','id','important_info','kids_policy','line_id','name','operating_days','operating_hours','parking_info','payment_due_days','phone','promptpay_id'];
check('resort endpoint returns only allowed fields', r.status === 200 && keys.every((k) => allowed.includes(k)), `keys ${keys.join(',')}`);

// 6) เช็คอินแล้วห้องต้องเป็น occupied (ตรวจว่า trigger ทำงานจริง)
r = await call('POST', '/bookings/room', memberToken, {
  check_in_date: '2099-07-01', check_out_date: '2099-07-02', adults: 1, children: 0,
  items: [{ room_type_id: 1, quantity: 1, room_id: 2 }],
});
const bId = r.json?.data?.room_booking_id ?? r.json?.data?.booking?.room_booking_id ?? r.json?.data?.id;
await call('PUT', `/bookings/${bId}/status`, adminToken, { status: 'approved' });
const line = (await db.query('SELECT booking_room_id FROM booking_room WHERE room_booking_id = $1', [bId])).rows[0];
r = await call('PUT', `/bookings/booking-rooms/${line.booking_room_id}/checkin`, adminToken);
const roomRow = (await db.query('SELECT status FROM rooms WHERE room_id = 2')).rows[0];
check('check-in sets room to occupied', r.status === 200 && roomRow.status === 'occupied', `checkin ${r.status}, room status ${roomRow.status}`);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await db.end();
process.exit(failed.length ? 1 : 0);
