const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');
let queryHandler;
const filename = require.resolve('../../src/config/database.ts');
require.cache[filename] = { id: filename, filename, loaded: true, exports: { __esModule: true, default: { query: (...args) => queryHandler(...args) } } };
for (const [relative, exports] of [
  ['services/mail.service.ts', { sendBookingConfirmationEmail: async () => {}, sendBookingStatusEmail: async () => {} }],
  ['services/cloudinary.service.ts', { deleteCloudinaryImage: async () => {} }],
]) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const booking = require('../../src/controllers/booking.controller.ts');
const kayak = require('../../src/controllers/kayak.controller.ts');
const members = require('../../src/controllers/member.controller.ts');
const reviews = require('../../src/controllers/review.controller.ts');
const rows = data => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('members return bounded rows, filtered count and global active totals', async () => {
  const calls = [];
  queryHandler = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('LIMIT')) return rows([{ member_id: 7, first_name: 'Guest', is_active: true }]);
    if (sql.includes('FILTER')) return rows([{ total: '13', active: '10', inactive: '3' }]);
    if (sql.includes('COUNT')) return rows([{ total: '11' }]);
    return rows([{ member_id: 7 }]);
  };
  const res = response();
  await members.getAllMembers({ query: { page: '2', limit: '10', search: 'Guest', status: 'active' } }, res);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 11, totalPages: 2 });
  assert.deepEqual(res.body.summary, { total: 13, active: 10, inactive: 3 });
  assert.equal(res.body.data.length, 1);
  const bounded = calls.find(call => call.sql.includes('LIMIT'));
  assert.ok(bounded.sql.includes('member_id DESC'));
  assert.deepEqual(bounded.values.slice(-2), [10, 10]);
  assert.ok(bounded.values.includes('%Guest%'));
});
test('reviews keep filtered averages and rating distribution over all matched rows', async () => {
  const calls = [];
  queryHandler = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('LIMIT')) return rows([{ review_id: 9, rating: 5 }]);
    if (sql.includes('AVG')) return rows([{ total: '12', avg_rating: '4.5', rating_5: '6', rating_4: '6', rating_3: '0', rating_2: '0', rating_1: '0' }]);
    return rows([{ review_id: 9, rating: 5 }]);
  };
  const res = response();
  await reviews.getAllReviews({ query: { page: '2', limit: '10', room_type_id: '3', min_rating: '4', search: 'quiet' } }, res);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 12, totalPages: 2 });
  assert.equal(res.body.avg_rating, 4.5);
  assert.deepEqual(res.body.summary.ratingCounts, { 1: 0, 2: 0, 3: 0, 4: 6, 5: 6 });
  const bounded = calls.find(call => call.sql.includes('LIMIT'));
  assert.ok(bounded.sql.includes('review_id DESC'));
  assert.ok(bounded.values.includes('%quiet%'));
});
test('legacy member and review requests keep unpaged data arrays', async () => {
  const calls = [];
  queryHandler = async sql => { calls.push(sql); return rows([{ member_id: 2, review_id: 3, rating: 4 }]); };
  for (const handler of [members.getAllMembers, reviews.getAllReviews]) {
    const res = response();
    await handler({ query: {} }, res);
    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.pagination, undefined);
  }
  assert.equal(calls.some(sql => sql.includes('LIMIT')), false);
});
test('pagination parser rejects malformed integers and clamps a requested limit', () => {
  const file = path.resolve(__dirname, '../../src/utils/pagination.ts');
  let helper;
  try { helper = require(file); } catch { helper = {}; }
  assert.equal(typeof helper.parsePagination, 'function');
  assert.equal(helper.parsePagination({}), null);
  assert.deepEqual(helper.parsePagination({ page: '2', limit: '500' }), { page: 2, limit: 100, offset: 100 });
  for (const bad of ['0', '-1', '1.5', '2oops', '', ['2'], '9007199254740992']) {
    assert.throws(() => helper.parsePagination({ page: bad }));
  }
  assert.deepEqual(helper.paginationMeta({ page: 3, limit: 10, offset: 20 }, 0), { page: 3, limit: 10, total: 0, totalPages: 0 });
});

for (const [name, handler,id] of [['room',booking.getAllRoomBookings,'room_booking_id'],['kayak',kayak.getAllKayakBookings,'boat_booking_id']]) {
  test(`${name} admin list bounds rows while retaining full summary and server filters`, async () => {
    const calls = [];
    queryHandler = async (sql,values) => {
      calls.push({sql,values});
      if(sql.includes(' AS totalRevenue') || sql.includes(' AS "totalRevenue"')) return rows([{ all:'14',has_slip:'4',pending:'3',approved:'5',checked_out:'2', totalRevenue:'950',pendingRevenue:'300' }]);
      if(sql.includes('COUNT(*) AS total')) return rows([{total:'11'}]);
      return rows([{[id]:7}]);
    };
    const res=response();
    await handler({query:{page:'2',limit:'10',filter:'has_slip',search:'Guest',date_from:'2026-10-01',date_to:'2026-10-05',room_type:'Deluxe',boat_type:'Double',sort:'total_price',sort_dir:'asc'}},res);
    assert.deepEqual(res.body.pagination,{page:2,limit:10,total:11,totalPages:2});
    assert.equal(res.body.summary.all,14);
    assert.equal(res.body.summary.totalRevenue,950);
    const bounded=calls.find(call => /LIMIT \$\d+ OFFSET/.test(call.sql));
    assert.ok(bounded, 'page query must use LIMIT and OFFSET parameters');
    assert.deepEqual(bounded.values.slice(-2),[10,10]);
    assert.ok(bounded.values.includes('%Guest%'));
    assert.ok(bounded.values.includes('2026-10-01'));
    assert.ok(bounded.sql.includes('EXISTS'), 'group filters must find matching booking lines');
    assert.ok(bounded.sql.includes(`${id} DESC`));
  });
  test(`${name} admin legacy caller still receives the complete data array`,async()=>{
    const calls=[];
    queryHandler=async sql=>{calls.push(sql);return rows([{[id]:7}]);};
    const res=response();
    await handler({query:{}},res);
    assert.equal(Array.isArray(res.body.data),true);
    assert.equal(res.body.pagination,undefined);
    assert.equal(calls.length,1);
    assert.equal(calls.some(sql=>/LIMIT \$\d+ OFFSET/.test(sql)),false);
  });
}

test('list query validators reject malformed paging and scalar filters before SQL',async()=>{
  const {paginationValidator,bookingListValidator,reviewListValidator,memberListValidator}=require('../../src/middleware/pagination-validator.ts');
  const {validationResult}=require('express-validator');
  const valid = async (validators,query) => {
    const req={query};
    for(const validator of validators) await validator.run(req);
    return validationResult(req).isEmpty();
  };
  for(const bad of ['0','-2','1.5','1e2','3oops','',['2','3']]) assert.equal(await valid(paginationValidator,{page:bad}),false);
  assert.equal(await valid(paginationValidator,{limit:'500'}),true,'large limits clamp at parser');
  assert.equal(await valid(paginationValidator,{page:'9007199254740991',limit:'100'}),false,'unsafe offsets rejected');
  assert.equal(await valid(bookingListValidator,{date_from:'2026-02-30'}),false);
  assert.equal(await valid(bookingListValidator,{sort:'total_price; DROP TABLE members'}),false);
  assert.equal(await valid(bookingListValidator,{filter:['pending','approved']}),false);
  assert.equal(await valid(reviewListValidator,{min_rating:['4','5']}),false);
  assert.equal(await valid(memberListValidator,{status:['active','inactive']}),false);
  assert.equal(await valid(reviewListValidator,{min_rating:'4',room_type_id:'3',search:'Guest'}),true);
});
