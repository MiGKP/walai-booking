const { test } = require('node:test');
const assert = require('node:assert/strict');
const { persistBookingPromotions, restoreBookingPromotions } = require('../../dist/services/promotion-ledger');

test('multi-code quota writes use stable promotion order', async () => {
  const ids = [];
  const client = { query: async (sql, params) => {
    if (sql.includes('UPDATE promotions')) ids.push(params[0]);
    if (sql.includes('usage_limit_per_member')) return { rows: [{ usage_limit_per_member: null, used: 1 }] };
    return { rows: [], rowCount: 1 };
  } };
  await persistBookingPromotions(client, { memberId: 1, roomBookingId: 2, result: {
    totalPrice: 90, headerPromotionId: null,
    lines: [2, 1].map(id => ({ promotion_id: id, member_promotion_id: null, discount_amount: 5 })),
  } });
  assert.deepEqual(ids, [1, 2]);
});

test('quota restoration follows the same order', async () => {
  const ids = [];
  const client = { query: async (sql, params) => {
    if (sql.includes('DELETE FROM')) return { rows: [2, 1].map(id => ({ promotion_id: id, member_id: 1, member_promotion_id: null })) };
    if (sql.includes('UPDATE promotions')) ids.push(params[0]);
    return { rows: [], rowCount: 1 };
  } };
  await restoreBookingPromotions(client, { previousStatus: 'paid', roomBookingId: 2 });
  assert.deepEqual(ids, [1, 2]);
});
