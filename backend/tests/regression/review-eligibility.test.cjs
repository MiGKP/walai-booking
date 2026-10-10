const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
let query;
const db = require.resolve('../../src/config/database.ts');
require.cache[db] = { id: db, filename: db, loaded: true, exports: { __esModule: true, default: { query: (...args) => query(...args) } } };
const reviews = require('../../src/controllers/review.controller.ts');
const rows = data => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });

// Model the legacy completed stay observed in production: approved header,
// every physical room checked out. List and submission must agree.
test('a completed legacy stay listed as reviewable can submit its first review', async () => {
  query = async sql => {
    if (sql.startsWith('SELECT 1 FROM room_bookings')) {
      return rows(sql.includes("'approved'") && sql.includes('NOT EXISTS') ? [{}] : []);
    }
    if (sql.startsWith('SELECT review_id')) return rows([]);
    if (sql.startsWith('INSERT INTO reviews')) return rows([{ review_id: 1 }]);
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();
  await reviews.createReview({ user: { id: 46, role: 'customer' }, body: { room_booking_id: 111, room_type_id: 7, rating: 5 } }, res);
  assert.equal(res.code, 201);
});

test('an unfinished room in the group blocks a review even for a completed room type', async () => {
  let inserts = 0;
  query = async sql => {
    if (sql.startsWith('SELECT 1 FROM room_bookings')) return rows(sql.includes('NOT EXISTS') ? [] : [{}]);
    if (sql.startsWith('SELECT review_id')) return rows([]);
    if (sql.startsWith('INSERT INTO reviews')) { inserts++; return rows([{ review_id: 1 }]); }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();
  await reviews.createReview({ user: { id: 46, role: 'customer' }, body: { room_booking_id: 112, room_type_id: 7, rating: 5 } }, res);
  assert.equal(res.code, 403);
  assert.equal(inserts, 0);
});

test('a second review remains a conflict after eligibility succeeds', async () => {
  query = async sql => {
    if (sql.startsWith('SELECT 1 FROM room_bookings')) return rows([{}]);
    if (sql.startsWith('SELECT review_id')) return rows([{ review_id: 1 }]);
    throw new Error('Duplicate review must not be inserted');
  };
  const res = response();
  await reviews.createReview({ user: { id: 46, role: 'customer' }, body: { room_booking_id: 112, room_type_id: 7, rating: 5 } }, res);
  assert.equal(res.code, 409);
});
