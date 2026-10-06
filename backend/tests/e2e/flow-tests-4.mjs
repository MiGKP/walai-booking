import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const BACKEND = process.cwd();
const require = createRequire(BACKEND + '/package.json');
const { Client } = require('pg');
const mail = require(BACKEND + '/dist/services/mail.service.js');
const reminder = require(BACKEND + '/dist/services/review-reminder.service.js');
const autoCancel = require(BACKEND + '/dist/services/auto-cancel.service.js');

const API = process.env.TEST_API_URL || 'http://localhost:5055/api';
const DB_URL = process.env.TEST_DATABASE_URL;
const db = new Client({ connectionString: DB_URL });
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

// ---------- A) การแจ้งเตือนรีวิว: claim flag, ไม่ส่งซ้ำ, คืน flag เมื่อส่งไม่สำเร็จ ----------
await db.query(`DELETE FROM booking_room WHERE room_booking_id >= 500`);
await db.query(`DELETE FROM room_bookings WHERE room_booking_id >= 500`);
await db.query(`
  INSERT INTO room_bookings (room_booking_id, member_id, check_in, check_out, guest_count, adults, children, total_price, status, review_reminder_sent)
  VALUES (500, 1, CURRENT_DATE - 2, CURRENT_DATE, 1, 1, 0, 1000, 'checked_out', false)`);
await db.query(`
  INSERT INTO booking_room (room_booking_id, room_id, price_per_night, nights, subtotal, status)
  VALUES (500, 1, 1000, 2, 2000, 'checked_out')`);

let sendCalls = 0;
let sendMode = 'fail';
mail.sendReviewReminderEmail = async () => {
  sendCalls += 1;
  if (sendMode === 'fail') throw new Error('simulated send failure');
};

await reminder.sendPendingReviewReminders();
let flag = (await db.query('SELECT review_reminder_sent FROM room_bookings WHERE room_booking_id = 500')).rows[0].review_reminder_sent;
check('reminder: failed send resets flag to false', sendCalls === 1 && flag === false, `calls ${sendCalls}, flag ${flag}`);

sendMode = 'ok';
await reminder.sendPendingReviewReminders();
flag = (await db.query('SELECT review_reminder_sent FROM room_bookings WHERE room_booking_id = 500')).rows[0].review_reminder_sent;
check('reminder: successful send sets flag to true', sendCalls === 2 && flag === true, `calls ${sendCalls}, flag ${flag}`);

await reminder.sendPendingReviewReminders();
await reminder.sendPendingReviewReminders();
check('reminder: no duplicate send after success', sendCalls === 2, `calls ${sendCalls}`);

// ---------- B) auto-cancel: ยกเลิกบุ๊กกิ้งค้างชำระ + คืนโควตาโปรและ ledger ----------
await db.query(`DELETE FROM booking_promotions WHERE room_booking_id = 501`);
await db.query(`DELETE FROM booking_room WHERE room_booking_id = 501`);
await db.query(`DELETE FROM room_bookings WHERE room_booking_id = 501`);
await db.query(`
  INSERT INTO room_bookings (room_booking_id, member_id, check_in, check_out, guest_count, adults, children, total_price, status, created_at)
  VALUES (501, 1, CURRENT_DATE + 30, CURRENT_DATE + 31, 1, 1, 0, 900, 'pending', NOW() - INTERVAL '30 days')`);
await db.query(`
  INSERT INTO booking_room (room_booking_id, room_id, price_per_night, nights, subtotal, status)
  VALUES (501, 2, 900, 1, 900, 'pending')`);
const before = Number((await db.query('SELECT usage_count FROM promotions WHERE id = 1')).rows[0].usage_count);
await db.query(`UPDATE promotions SET usage_count = usage_count + 1 WHERE id = 1`);
await db.query(`
  INSERT INTO booking_promotions (promotion_id, member_id, room_booking_id, discount_amount)
  VALUES (1, 1, 501, 100)`);

await autoCancel.cancelExpiredBookings();
const st = (await db.query('SELECT status FROM room_bookings WHERE room_booking_id = 501')).rows[0].status;
const lineSt = (await db.query('SELECT status FROM booking_room WHERE room_booking_id = 501')).rows[0].status;
const after = Number((await db.query('SELECT usage_count FROM promotions WHERE id = 1')).rows[0].usage_count);
const ledger = Number((await db.query('SELECT COUNT(*)::int AS n FROM booking_promotions WHERE room_booking_id = 501')).rows[0].n);
check('auto-cancel: expired pending booking becomes cancelled', st === 'cancelled', `header ${st}`);
check('auto-cancel: room line cancelled with header', lineSt === 'cancelled', `line ${lineSt}`);
check('auto-cancel: promo usage restored', after === before, `usage ${after} expected ${before}`);
check('auto-cancel: ledger rows removed', ledger === 0, `rows ${ledger}`);

// ---------- C) การลบรูปเรือข้ามเรือ ----------
await db.query(`INSERT INTO boat_types (boat_type_id, type_name, seat_count, price, quantity, is_active) VALUES (2, 'เรือทดสอบ 2', 2, 300, 1, true) ON CONFLICT (boat_type_id) DO NOTHING`);
const img = (await db.query(`INSERT INTO boat_images (boat_type_id, image_path) VALUES (1, 'test/boat-1.jpg') RETURNING boat_image_id`)).rows[0].boat_image_id;
const adminToken = (await call('POST', '/auth/login', null, { email: 'admin@example.test', password: 'Passw0rd!' })).json?.data?.token;
let r = await call('DELETE', `/kayaks/2/images/${img}`, adminToken);
const stillThere = (await db.query('SELECT COUNT(*)::int AS n FROM boat_images WHERE boat_image_id = $1', [img])).rows[0].n;
check('boat image of another boat cannot be deleted via this boat URL', r.status === 404 && stillThere === 1, `status ${r.status}, rows ${stillThere}`);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await db.end();
process.exit(failed.length ? 1 : 0);
