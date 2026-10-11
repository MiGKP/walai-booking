const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

// All fixtures live in pg_temp and disappear when the dedicated connection closes.
const envPath = path.join(__dirname, '../../.env');
const localEnv = fs.existsSync(envPath) ? require('dotenv').parse(fs.readFileSync(envPath)) : {};
const databaseUrl = process.env.TEST_DATABASE_URL || localEnv.DATABASE_URL;
const localDatabase = databaseUrl && ['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname);
const enabled = Boolean(process.env.TEST_DATABASE_URL || localDatabase);
let client;
let committed;
let deletedImages;
let failMemberUpdate;

function mock(relative, exports) {
  const id = require.resolve(relative);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const query = async (sql, values) => {
  if (failMemberUpdate && /UPDATE members/.test(sql)) throw new Error('TEST update failure');
  const result = await client.query(sql, values);
  if (sql === 'COMMIT') committed = true;
  return result;
};
mock('../../dist/config/database', { __esModule: true, default: {
  query, connect: async () => ({ query, release() {} }),
} });
mock('../../dist/services/mail.service', { sendPasswordResetEmail: async () => assert.fail('Unexpected email') });
mock('../../dist/services/cloudinary.service', {
  extractCloudinaryPublicId: () => 'TEST/avatar',
  deleteCloudinaryImage: async id => { assert(committed, 'Media must only be deleted after commit'); deletedImages.push(id); },
});
const { deleteAccount } = require('../../dist/controllers/auth.controller');
const { getNextRoomNumber, createBatchSingleRooms } = require('../../dist/controllers/room.controller');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
async function fixture(t) {
  client = new Client({ connectionString: databaseUrl });
  await client.connect();
  t.after(async () => { await client.end(); });
  committed = false; deletedImages = []; failMemberUpdate = false;
  await client.query(`SET search_path TO pg_temp;
    CREATE TEMP TABLE members(member_id int PRIMARY KEY, password text, auth_provider text, image_profile text,
      email text, first_name text, last_name text, phone text, line_id text, facebook text, avatar_url text,
      google_id text, password_changed_at timestamptz, is_active boolean, deleted_at timestamptz, updated_at timestamptz);
    CREATE TEMP TABLE room_bookings(room_booking_id int, member_id int, status text);
    CREATE TEMP TABLE boat_bookings(boat_booking_id int, member_id int, status text);
    CREATE TEMP TABLE member_promotions(member_promotion_id int PRIMARY KEY, member_id int, status varchar(20));
    CREATE TEMP TABLE booking_promotions(id int PRIMARY KEY, member_promotion_id int REFERENCES member_promotions(member_promotion_id));
    CREATE TEMP TABLE room_types(id int PRIMARY KEY, type_name text);
    CREATE TEMP TABLE rooms(room_id serial PRIMARY KEY, room_type_id int REFERENCES room_types(id), room_number text UNIQUE, status text);
    INSERT INTO members(member_id, auth_provider, email, is_active, image_profile)
      VALUES(1, 'google', 'TEST@example.invalid', true, 'TEST/avatar');
    INSERT INTO room_bookings VALUES(1,1,'checked_out');
    INSERT INTO member_promotions VALUES(1,1,'saved'),(2,1,'saved');
    INSERT INTO booking_promotions VALUES(1,1);
    INSERT INTO room_types VALUES(1,'TEST Floating Room');
    INSERT INTO rooms(room_type_id,room_number,status) VALUES(1,'W8','available'),(1,'W10','available');`);
}

test('account deletion retains reusable coupon history while removing unused coupons', { skip: !enabled }, async t => {
  await fixture(t);
  const res = response();
  await deleteAccount({ user: { id: 1, role: 'customer' }, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal((await client.query('SELECT is_active FROM members')).rows[0].is_active, false);
  assert.deepEqual((await client.query('SELECT member_promotion_id FROM member_promotions')).rows, [{ member_promotion_id: 1 }]);
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM booking_promotions')).rows[0].count, 1);
  assert.deepEqual(deletedImages, ['TEST/avatar']);
});

test('failed account deletion rolls back data and leaves the avatar intact', { skip: !enabled }, async t => {
  await fixture(t); failMemberUpdate = true;
  const res = response();
  await deleteAccount({ user: { id: 1, role: 'customer' }, body: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.equal((await client.query('SELECT is_active FROM members')).rows[0].is_active, true);
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM member_promotions')).rows[0].count, 2);
  assert.deepEqual(deletedImages, []);
});

test('active room bookings still prevent account deletion', { skip: !enabled }, async t => {
  await fixture(t);
  await client.query("UPDATE room_bookings SET status='approved'");
  const res = response();
  await deleteAccount({ user: { id: 1, role: 'customer' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(deletedImages, []);
});

test('next room number detects a prefix using the real rooms primary key', { skip: !enabled }, async t => {
  await fixture(t);
  const res = response();
  await getNextRoomNumber({ query: { room_type_id: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.prefix, 'W');
  assert.equal(res.body.data.next_number, 11);
});

test('legacy batch room creation detects prefix and creates distinct room numbers', { skip: !enabled }, async t => {
  await fixture(t);
  const res = response();
  await createBatchSingleRooms({ body: { room_type_id: 1, quantity: 2, start_number: 11 } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.data.map(row => row.room_number), ['W11', 'W12']);
});
