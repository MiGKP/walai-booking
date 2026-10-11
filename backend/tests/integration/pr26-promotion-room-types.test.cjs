const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const enabled = Boolean(process.env.TEST_DATABASE_URL);
let client;
const db = require.resolve('../../dist/config/database');
require.cache[db] = { id: db, filename: db, loaded: true, exports: { __esModule: true, default: {
  query: (...args) => client.query(...args),
} } };
const { createPromotion, updatePromotion, getActivePromotions } = require('../../dist/controllers/promotion.controller');
const { loadPromosForApply } = require('../../dist/services/promotion-ledger');
const { applyPromotionList } = require('../../dist/services/promotion-apply');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('promotion migration, persistence and catalog restrictions work together in PostgreSQL', { skip: !enabled }, async t => {
  client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  t.after(() => client.end());
  // No persistent writes: every fixture is isolated in pg_temp, never public.
  await client.query(`SET search_path TO pg_temp;
    CREATE TEMP TABLE room_types(id int PRIMARY KEY);
    INSERT INTO room_types VALUES(1),(2),(3);
    CREATE TEMP TABLE promotions(id serial PRIMARY KEY, code text UNIQUE, name text, description text,
      discount_type text, discount_value numeric, min_nights int, min_price numeric, max_discount numeric,
      start_date date, end_date date, usage_limit int, usage_count int DEFAULT 0, is_active boolean,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      room_type_id int REFERENCES room_types(id), room_count int, boat_ticket_count int,
      usage_limit_per_member int, is_collectible boolean, stackable boolean, applies_to text,
      boat_addon_mode text, boat_addon_price numeric);
    CREATE TEMP TABLE member_promotions(promotion_id int, member_id int, status text);
    CREATE TEMP TABLE booking_promotions(promotion_id int, member_id int);
    INSERT INTO promotions(code,name,room_type_id,is_collectible,stackable,applies_to)
      VALUES('TESTLEGACY','TEST Legacy',1,false,true,'both');`);
  const migration = fs.readFileSync(path.join(__dirname, '../../src/db/migrations/2026-10-16-promotions-room-type-ids.sql'), 'utf8');
  await client.query(migration);
  await client.query(migration);
  const legacy = (await client.query('SELECT room_type_ids,stackable,applies_to FROM promotions WHERE id=1')).rows[0];
  assert.deepEqual(legacy, { room_type_ids: [1], stackable: true, applies_to: 'both' });

  const created = response();
  await createPromotion({ body: { code: 'TESTMULTI', name: 'TEST Multi', discount_type: 'percent', discount_value: 50,
    max_discount: 10, room_type_ids: [1, 2], room_type_id: 3, applies_to: 'both', stackable: true } }, created);
  assert.equal(created.code, 201);
  assert.equal(created.body.data.room_type_id, null);
  assert.deepEqual(created.body.data.room_type_ids, [1, 2]);
  const id = created.body.data.id;
  const promos = await loadPromosForApply(client, [id]);
  const ctx = { memberId: 1, basePrice: 3000, nights: 1, now: new Date(), scope: 'room', roomTypeIds: [1, 2], memberUsedCountByPromoId: {}, walletsByPromoId: {} };
  assert.equal(applyPromotionList(promos, ctx).totalPrice, 2990);
  assert.throws(() => applyPromotionList(promos, { ...ctx, roomTypeIds: [1, 3] }), /ประเภทห้อง/);
  const active = response();
  await getActivePromotions({}, active);
  assert.equal(active.body.success, true);
  assert.deepEqual(active.body.data.find(p => p.id === id).room_type_ids, [1, 2]);
  for (const [body, types] of [[{ room_type_id: 3 }, [3]], [{ room_type_id: null }, []], [{ room_type_ids: [1, 2] }, [1, 2]], [{ name: 'TEST renamed' }, [1, 2]]]) {
    const res = response();
    await updatePromotion({ params: { id: String(id) }, body }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.data.room_type_ids, types);
    assert.equal(res.body.data.stackable, true);
    assert.equal(res.body.data.applies_to, 'both');
  }
  const rejected = response();
  await updatePromotion({ params: { id: String(id) }, body: { room_type_ids: [99999] } }, rejected);
  assert.equal(rejected.code, 400);
  assert.deepEqual((await client.query('SELECT room_type_ids FROM promotions WHERE id=$1', [id])).rows[0].room_type_ids, [1, 2]);
});
