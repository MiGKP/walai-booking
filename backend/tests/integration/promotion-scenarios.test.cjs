const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const path = require('node:path');
const { validationResult } = require('express-validator');
require('ts-node/register/transpile-only');

const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Promotion scenarios require an isolated local PostgreSQL server');
}
let pool;
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: {
  query: (...args) => pool.query(...args), connect: () => pool.connect(),
} });
stub('services/mail.service.ts', { sendBookingConfirmationEmail: async () => {} });
const promotions = require('../../src/controllers/promotion.controller.ts');
const rooms = require('../../src/controllers/booking.controller.ts');
const validators = require('../../src/middleware/validators.ts');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const today = new Date();
function day(offset) {
  return new Date(today.getTime() + (offset * 24 + 7) * 3600000).toISOString().slice(0, 10);
}
const fixtures = [
  { code: 'ROOM10PCT', discount_type: 'percent', discount_value: 10 },
  { code: 'ROOM20MAX', discount_type: 'percent', discount_value: 20, min_price: 1000, max_discount: 300, usage_limit: 50 },
  { code: 'STAY2NIGHT', discount_type: 'percent', discount_value: 15, min_nights: 2 },
  { code: 'VIPROOM500', discount_type: 'fixed', discount_value: 500, min_price: 2500 },
  { code: 'ROOMONCE10', discount_type: 'percent', discount_value: 10, usage_limit_per_member: 1 },
  { code: 'ROOMFIRST1', discount_type: 'fixed', discount_value: 300, usage_limit: 1 },
  { code: 'ROOMFREEBOAT', discount_type: 'fixed', discount_value: 0, boat_ticket_count: 1, boat_addon_mode: 'free', is_collectible: true },
  { code: 'ROOMEXPIRED', discount_type: 'fixed', discount_value: 100, start_date: day(-30), end_date: day(-1) },
  { code: 'ROOMFUTURE', discount_type: 'percent', discount_value: 15, start_date: day(7) },
  { code: 'ROOMDISABLED', discount_type: 'fixed', discount_value: 100, is_active: false },
];

test('ten room promotion scenarios: persistence, validation, real booking and quota rules', { skip: !url }, async t => {
  const admin = new Pool({ connectionString: url });
  const schema = `promotion_qa_${require('node:crypto').randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  await pool.query(`
    CREATE TABLE room_types(id int PRIMARY KEY, room_name text, type_name text, price numeric, capacity int, status boolean);
    INSERT INTO room_types VALUES(1,'TEST Room','TEST Type',1000,3,true);
    CREATE TABLE rooms(room_id int PRIMARY KEY, room_type_id int, room_number text, status text);
    INSERT INTO rooms VALUES(1,1,'TEST-W1','available'),(2,1,'TEST-W2','available');
    CREATE TABLE promotions(id serial PRIMARY KEY, code text UNIQUE, name text, description text,
      discount_type text, discount_value numeric NOT NULL, min_nights int, min_price numeric, max_discount numeric,
      start_date date, end_date date, usage_limit int, usage_count int NOT NULL DEFAULT 0, is_active boolean,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), room_type_id int,
      room_type_ids int[] NOT NULL DEFAULT '{}', room_count int, boat_ticket_count int,
      usage_limit_per_member int, is_collectible boolean, stackable boolean, applies_to text,
      boat_addon_mode text, boat_addon_price numeric);
    CREATE TABLE member_promotions(member_promotion_id serial PRIMARY KEY, member_id int, promotion_id int,
      status varchar(20), used_at timestamptz, UNIQUE(member_id,promotion_id));
    CREATE TABLE booking_promotions(promotion_id int, member_id int, member_promotion_id int,
      room_booking_id int, boat_booking_id int, discount_amount numeric);
    CREATE TABLE members(member_id int, email text, first_name text, last_name text);
    CREATE TABLE resort_info(id int, infant_max_age_exclusive int, room_max_advance_days int);
    INSERT INTO resort_info VALUES(3,6,NULL);
    CREATE TABLE room_bookings(room_booking_id serial PRIMARY KEY, member_id int, check_in date,
      check_out date, guest_count int, adults int, children int, child_ages int[], special_request text,
      arrival_time time, promotion_id int, status text, total_price numeric, guest_name text, guest_phone text, guest_email text);
    CREATE TABLE booking_room(booking_room_id serial PRIMARY KEY, room_booking_id int, room_id int,
      price_per_night numeric, nights int, subtotal numeric, status text);
    CREATE TABLE booking_room_promotions(room_booking_id int, room_type_id int, promotion_id int, discount_amount numeric);
    CREATE TABLE member_boat_tickets(id serial PRIMARY KEY, member_id int, promotion_id int,
      room_booking_id int, booking_room_id int, total_tickets int, used_tickets int DEFAULT 0, mode text, unit_price numeric);
  `);
  let dateOffset = 1;
  async function validate(promo, { member = 1, price = 2000, nights = 2 } = {}) {
    const res = response();
    await promotions.validatePromoCode({ body: { code: promo.code, scope: 'room', price, nights, room_type_ids: [1] }, user: { id: member, role: 'customer' } }, res);
    return res;
  }
  async function book(promo, { member = 1, nights = 2, quantity = 1 } = {}) {
    const offset = dateOffset; dateOffset += 5;
    const res = response();
    await rooms.createRoomBooking({ body: { items: [{ room_type_id: 1, quantity, promotion_id: promo.id }],
      check_in_date: day(offset), check_out_date: day(offset + nights), adults: 1, children: 0, child_ages: [] },
      params: {}, user: { id: member, role: 'customer' } }, res);
    return res;
  }
  for (const [index, fixture] of fixtures.entries()) {
    await t.test(`case ${index + 1}: ${fixture.code}`, async () => {
      const body = { name: `TEST ${fixture.code}`, description: 'TEST isolated fixture', applies_to: 'room',
        min_nights: null, min_price: null, max_discount: null, start_date: null, end_date: null,
        usage_limit: null, usage_limit_per_member: null, room_type_ids: [], boat_ticket_count: 0,
        is_active: true, is_collectible: false, stackable: false, ...fixture };
      const req = { body };
      for (const validator of validators.createPromotionValidator) await validator.run(req);
      assert.deepEqual(validationResult(req).array(), []);
      const created = response(); await promotions.createPromotion(req, created);
      assert.equal(created.code, 201, JSON.stringify(created.body));
      const promo = created.body.data;
      assert.equal(promo.is_collectible, true);
      if (index < 7) {
        const uncollected = await validate(promo, { price: index === 3 ? 3000 : 2000 });
        assert.equal(uncollected.code, 400);
        assert.match(uncollected.body.message, /ต้องเก็บโค้ดนี้ก่อนใช้/);
        await pool.query("INSERT INTO member_promotions(member_id,promotion_id,status) VALUES(1,$1,'saved'),(2,$1,'saved')", [promo.id]);
      }
      assert.deepEqual(promo.room_type_ids, []);
      if (index < 7) assert.equal(promo.end_date, null);
      if (index === 6) {
        const checked = await validate(promo); assert.equal(checked.code, 200);
        assert.equal(checked.body.data.final_price, 2000);
        const booked = await book(promo, { quantity: 2 });
        assert.equal(booked.code, 201, JSON.stringify(booked.body));
        assert.equal(Number(booked.body.data.total_price), 4000);
        assert.equal(booked.body.data.boat_tickets_granted, 2);
        const grants = (await pool.query('SELECT booking_room_id,total_tickets,mode,unit_price FROM member_boat_tickets WHERE room_booking_id=$1 ORDER BY booking_room_id', [booked.body.data.room_booking_id])).rows;
        assert.equal(grants.length, 2);
        assert.equal(new Set(grants.map(g => g.booking_room_id)).size, 2);
        for (const grant of grants) { assert.equal(grant.total_tickets, 1); assert.equal(grant.mode, 'free'); assert.equal(Number(grant.unit_price), 0); }
        const edited = response(); await promotions.updatePromotion({ params: { id: promo.id }, body: { name: 'TEST renamed free addon' } }, edited);
        assert.equal(edited.code, 200); assert.equal(Number(edited.body.data.discount_value), 0);
        const removedAddon = response();
        await promotions.updatePromotion({ params: { id: promo.id }, body: { boat_ticket_count: 0 } }, removedAddon);
        assert.equal(removedAddon.code, 400, 'zero-discount promotion must retain a room boat benefit');
        assert.equal((await pool.query('SELECT boat_ticket_count FROM promotions WHERE id=$1', [promo.id])).rows[0].boat_ticket_count, 1);
      } else if (index >= 7) {
        const checked = await validate(promo);
        assert.equal(checked.code, 400);
        assert.match(checked.body.message, [null,null,null,null,null,null,null,/หมดอายุ/,/ยังไม่เริ่ม/,/ปิดใช้งาน/][index]);
        const rejected = await book(promo); assert.equal(rejected.code, 400);
      } else {
        const price = index === 3 ? 3000 : 2000;
        const checked = await validate(promo, { price }); assert.equal(checked.code, 200, JSON.stringify(checked.body));
        const expected = [1800,1700,1700,2500,1800,1700][index];
        assert.equal(checked.body.data.final_price, expected);
        const booked = await book(promo, { nights: index === 3 ? 3 : 2 });
        assert.equal(booked.code, 201, JSON.stringify(booked.body));
        assert.equal(Number(booked.body.data.total_price), expected);
        if ([1,2,3].includes(index)) {
          const insufficient = await validate(promo, { price: index === 1 ? 999 : index === 3 ? 2499 : 1000, nights: 1 });
          assert.equal(insufficient.code, 400);
          assert.match(insufficient.body.message, index === 2 ? /ขั้นต่ำ 2 คืน/ : /ยอดขั้นต่ำ/);
          const rejected = await book(promo, { nights: 1 }); assert.equal(rejected.code, index === 1 ? 201 : 400);
        }
        if (index === 4 || index === 5) {
          const member = index === 5 ? 2 : 1;
          const exhausted = await validate(promo, { member });
          assert.equal(exhausted.code, 400); assert.match(exhausted.body.message, /ครบจำนวน/);
          const rejected = await book(promo, { member }); assert.equal(rejected.code, 400);
        }
      }
    });
  }
  await t.test('zero discounts cannot create empty or invalid promotions', async () => {
    for (const [index, extra] of [
      { discount_type: 'fixed', discount_value: 0, boat_ticket_count: 0 },
      { discount_type: 'percent', discount_value: 0, boat_ticket_count: 1 },
      { discount_type: 'fixed', discount_value: -1, boat_ticket_count: 1 },
      { discount_type: 'fixed', discount_value: Infinity, boat_ticket_count: 1 },
      { discount_type: 'fixed', discount_value: 0, boat_ticket_count: 1, applies_to: 'kayak' },
    ].entries()) {
      const res = response();
      await promotions.createPromotion({ body: { code: `TEST_INVALID_${index}`, name: 'TEST invalid', applies_to: 'room', ...extra } }, res);
      assert.equal(res.code, 400);
    }
    assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM promotions WHERE code LIKE 'TEST_INVALID_%'")).rows[0].n, 0);
  });
  await t.test('collection migration fixes legacy flags, defaults new rows to true, and is repeatable', async () => {
    await pool.query('UPDATE promotions SET is_collectible=false');
    const migration = require('node:fs').readFileSync(path.resolve(__dirname, '../../src/db/migrations/2026-10-19-promotions-require-collection.sql'), 'utf8');
    await pool.query(migration);
    await pool.query(migration);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM promotions WHERE is_collectible IS NOT TRUE')).rows[0].n, 0);
    const column = await pool.query("SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='promotions' AND column_name='is_collectible'", [schema]);
    assert.equal(column.rows[0].column_default, 'true');
  });
});
