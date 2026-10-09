const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('pg');
require('ts-node/register/transpile-only');
const { persistBookingPromotions, restoreBookingPromotions } = require('../../src/services/promotion-ledger.ts');

const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Wallet fixtures require a local TEST_DATABASE_URL');
}

test('collected coupon use and cancellation restore its varchar wallet status', { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE promotions (id int PRIMARY KEY, usage_count int, usage_limit int,
        usage_limit_per_member int, updated_at timestamptz);
      CREATE TEMP TABLE member_promotions (member_promotion_id int PRIMARY KEY,
        status varchar(20) NOT NULL CHECK (status IN ('saved','used','expired')), used_at timestamptz);
      CREATE TEMP TABLE booking_promotions (promotion_id int, member_id int,
        member_promotion_id int, room_booking_id int, boat_booking_id int, discount_amount numeric);
      INSERT INTO promotions VALUES (1,0,5,1,NULL);
      INSERT INTO member_promotions VALUES (1,'saved',NULL);
    `);
    for (const scope of ['room', 'boat']) {
      const header = scope === 'room' ? { roomBookingId: 10 } : { boatBookingId: 20 };
      await persistBookingPromotions(client, { memberId: 1, ...header, result: {
        totalPrice: 15000, headerPromotionId: 1,
        lines: [{ promotion_id: 1, member_promotion_id: 1, discount_amount: 0 }],
      } });
      const used = await client.query('SELECT status, used_at IS NOT NULL AS timestamp_set FROM member_promotions');
      assert.deepEqual(used.rows, [{ status: 'used', timestamp_set: true }]);
      assert.equal((await client.query('SELECT usage_count FROM promotions')).rows[0].usage_count, 1);
      await restoreBookingPromotions(client, { previousStatus: 'pending', ...header });
      assert.deepEqual((await client.query('SELECT status, used_at FROM member_promotions')).rows,
        [{ status: 'saved', used_at: null }]);
      assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM booking_promotions')).rows[0].n, 0);
      assert.equal((await client.query('SELECT usage_count FROM promotions')).rows[0].usage_count, 0);
      await restoreBookingPromotions(client, { previousStatus: 'pending', ...header });
      assert.equal((await client.query('SELECT usage_count FROM promotions')).rows[0].usage_count, 0);
      assert.equal((await client.query('SELECT status FROM member_promotions')).rows[0].status, 'saved');
    }
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
