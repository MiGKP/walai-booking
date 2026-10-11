const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node/register/transpile-only');
let current;
let saved;
const databaseId = require.resolve('../../src/config/database.ts');
require.cache[databaseId] = { id: databaseId, filename: databaseId, loaded: true, exports: { __esModule: true, default: {
  query: async (sql, values) => {
    if (/SELECT \* FROM promotions/.test(sql)) return { rows: [current] };
    if (/FROM room_types/.test(sql)) return { rows: values[0].filter(id => [1, 2, 3].includes(id)).map(id => ({ id })) };
    if (/SELECT id FROM promotions/.test(sql)) return { rows: [] };
    if (/INSERT INTO promotions|UPDATE promotions SET/.test(sql)) {
      saved = { room_type_id: values[12], room_type_ids: values[21] };
      return { rows: [saved] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
} } };
const { createPromotion, updatePromotion } = require('../../src/controllers/promotion.controller.ts');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const baseline = () => ({ id: 1, code: 'TEST', name: 'TEST', discount_type: 'fixed', discount_value: 10, room_type_id: 1, room_type_ids: [1], applies_to: 'room' });

for (const [label, body, expected] of [
  ['legacy type edit', { room_type_id: 2 }, { room_type_id: 2, room_type_ids: [2] }],
  ['legacy restriction clear', { room_type_id: null }, { room_type_id: null, room_type_ids: [] }],
  ['explicit unrestricted array', { room_type_ids: [], room_type_id: 1 }, { room_type_id: null, room_type_ids: [] }],
  ['multiple types', { room_type_ids: [1, 2, 2], room_type_id: 3 }, { room_type_id: null, room_type_ids: [1, 2] }],
  ['unrelated edit', { name: 'TEST renamed' }, { room_type_id: 1, room_type_ids: [1] }],
]) {
  test(`promotion update keeps one consistent room restriction: ${label}`, async () => {
    current = baseline(); saved = undefined;
    const res = response();
    await updatePromotion({ params: { id: '1' }, body }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(saved, expected);
  });
}
test('promotion create gives explicit array precedence over legacy restriction', async () => {
  saved = undefined;
  const res = response();
  await createPromotion({ body: { ...baseline(), room_type_ids: [], room_type_id: 1 } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(saved, { room_type_id: null, room_type_ids: [] });
});
for (const handler of [createPromotion, updatePromotion]) {
  test(`${handler.name} rejects unknown room types before saving`, async () => {
    current = baseline(); saved = undefined;
    const res = response();
    await handler({ params: { id: '1' }, body: { ...baseline(), room_type_ids: [999999] } }, res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /ประเภทห้อง/);
    assert.equal(saved, undefined);
  });
}
