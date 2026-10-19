const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('pg');
require('ts-node/register/transpile-only');
const url = process.env.TEST_DATABASE_URL;
if (url && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Review fixtures require a local TEST_DATABASE_URL');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });

test('review list and submission agree for partial and full checkout', { skip: !url }, async t => {
  const client = new Client({ connectionString: url });
  await client.connect();
  const db = require.resolve('../../src/config/database.ts');
  require.cache[db] = { id: db, filename: db, loaded: true, exports: { __esModule: true, default: client } };
  const reviews = require('../../src/controllers/review.controller.ts');
  try {
    await client.query(`CREATE TEMP TABLE room_bookings (room_booking_id int PRIMARY KEY, member_id int, status text, check_in date, check_out date);
      CREATE TEMP TABLE room_types (id int PRIMARY KEY, room_name text, type_name text, room_image text);
      CREATE TEMP TABLE rooms (room_id int PRIMARY KEY, room_type_id int);
      CREATE TEMP TABLE booking_room (room_booking_id int, room_id int, status text);
      CREATE TEMP TABLE reviews (review_id serial PRIMARY KEY, member_id int, room_booking_id int, room_type_id int, rating int, comment text, review_date timestamptz, UNIQUE(room_booking_id, member_id, room_type_id));
      INSERT INTO room_types VALUES (1,'TEST Standard','Standard',NULL),(2,'TEST Deluxe','Deluxe',NULL),(3,'TEST Cancelled','Cancelled',NULL);
      INSERT INTO rooms VALUES (1,1),(2,2),(3,3),(4,1);`);
    const cases = [
      { name: 'completed bill remains eligible with legacy approved lines', status: 'checked_out', lines: ['approved','approved','cancelled'], eligible: [1,2] },
      { name: 'checked-out type is eligible while another type is still occupied', status: 'approved', lines: ['checked_out','approved','rejected'], eligible: [1] },
      { name: 'cancelled and rejected rooms do not block completed rooms', status: 'approved', lines: ['checked_out','cancelled','rejected'], eligible: [1] },
      { name: 'fully checked-out approved bill is eligible for both types', status: 'approved', lines: ['checked_out','checked_out','cancelled'], eligible: [1,2] },
      { name: 'approved bill with no checkout remains ineligible despite past dates', status: 'approved', lines: ['approved','approved','cancelled'], eligible: [] },
      ...['pending','paid','cancelled','rejected'].map(status => ({ name: `${status} bill cannot bypass eligibility with completed lines`, status, lines: ['checked_out','checked_out','rejected'], eligible: [] })),
      { name: 'a bill with only cancelled lines is ineligible', status: 'checked_out', lines: ['cancelled','cancelled','rejected'], eligible: [] },
      { name: 'multiple rooms of the same type produce one review opportunity', status: 'approved', lines: ['checked_out','approved','cancelled','checked_out'], eligible: [1] },
    ];
    for (const fixture of cases) await t.test(fixture.name, async () => {
      await client.query('TRUNCATE room_bookings, booking_room, reviews');
      await client.query("INSERT INTO room_bookings VALUES (1,1,$1,'2020-01-01','2020-01-02')", [fixture.status]);
      for (const [index, status] of fixture.lines.entries()) await client.query('INSERT INTO booking_room VALUES (1,$1,$2)', [index + 1, status]);
      const list = async memberId => { const res = response(); await reviews.getReviewableBookings({ user: { id: memberId } }, res); assert.equal(res.code, 200); return res.body.data; };
      const create = async (typeId, memberId = 1) => { const res = response(); await reviews.createReview({ user: { id: memberId }, body: { room_booking_id: 1, room_type_id: typeId, rating: 5, comment: 'TEST checkout rules' } }, res); return res; };
      assert.deepEqual((await list(1)).map(row => row.room_type_id).sort(), fixture.eligible);
      assert.deepEqual(await list(2), []);
      assert.equal((await create(1,2)).code, 403);
      assert.equal((await create(99)).code, 403);
      for (const typeId of [1,2,3]) {
        const eligible = fixture.eligible.includes(typeId);
        assert.equal((await create(typeId)).code, eligible ? 201 : 403);
        if (eligible) assert.equal((await create(typeId)).code, 409);
      }
      assert.deepEqual(await list(1), []);
    });
  } finally { await client.end(); }
});
