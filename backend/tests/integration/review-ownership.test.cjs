const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Client } = require('pg');
require('ts-node/register/transpile-only');
const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Review fixtures require a local TEST_DATABASE_URL');
function response() { return { code: 200, status(code) { this.code=code;return this; }, json(body) { this.body=body;return this; } }; }
test('reviews require completed owned stays and reject concurrent duplicates and foreign edits', { skip: !url }, async () => {
 const client = new Client({ connectionString: url }); await client.connect();
 const filename=require.resolve(path.resolve(__dirname,'../../src/config/database.ts'));
 require.cache[filename]={id:filename,filename,loaded:true,exports:{__esModule:true,default:client}};
 const review=require('../../src/controllers/review.controller.ts');
 try {
  await client.query(`CREATE TEMP TABLE room_bookings (room_booking_id int PRIMARY KEY, member_id int, status text);
   CREATE TEMP TABLE rooms (room_id int PRIMARY KEY, room_type_id int);
   CREATE TEMP TABLE booking_room (room_booking_id int, room_id int);
   CREATE TEMP TABLE reviews (review_id serial PRIMARY KEY, member_id int, room_booking_id int, room_type_id int,
    rating int, comment text, review_date timestamptz, UNIQUE(room_booking_id,member_id,room_type_id));
   INSERT INTO room_bookings VALUES (1,1,'approved'),(2,1,'checked_out');
   INSERT INTO rooms VALUES (10,3); INSERT INTO booking_room VALUES (1,10),(2,10);`);
  const create=async(id,owner=1,type=3)=>{const res=response();await review.createReview({user:{id:owner},body:{room_booking_id:id,room_type_id:type,rating:5,comment:'TEST-review'}},res);return res;};
  assert.equal((await create(1)).code,403);
  assert.equal((await create(2,2)).code,403);
  assert.equal((await create(2,1,4)).code,403);
  const results=await Promise.all([create(2),create(2)]);
  assert.deepEqual(results.map(r=>r.code).sort(),[201,409]);
  const id=(await client.query('SELECT review_id FROM reviews')).rows[0].review_id;
  for(const action of ['updateReview','deleteReview']) {
   const res=response();await review[action]({user:{id:2},params:{id:String(id)},body:{rating:1,comment:'TEST-foreign'}},res);assert.equal(res.code,404);
  }
  assert.equal((await client.query('SELECT rating FROM reviews')).rows[0].rating,5);
  const own=response();await review.updateReview({user:{id:1},params:{id:String(id)},body:{rating:4,comment:'TEST-own'}},own);assert.equal(own.code,200);
  const deleted=response();await review.deleteReview({user:{id:1},params:{id:String(id)}},deleted);assert.equal(deleted.code,200);
 } finally { await client.end(); }
});
