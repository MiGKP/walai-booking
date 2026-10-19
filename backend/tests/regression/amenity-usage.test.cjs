const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node/register/transpile-only');
let queryHandler;
const queries = [];
const client = { query: async (sql, params) => { queries.push(sql); return queryHandler(sql, params); }, release() {} };
function stub(relative, exports) {
  const file = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: { connect: async () => client, query: (...args) => client.query(...args) } });
stub('services/cloudinary.service.ts', { deleteCloudinaryImage: async () => {} });
const rooms = require('../../src/controllers/room.controller.ts');
const rows = (data = []) => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('a referenced amenity cannot be deleted or silently removed from room types', async () => {
  queries.length = 0;
  queryHandler = async sql => {
    if (sql.includes('FROM room_types')) return rows([{ id: 2, room_name: 'ห้องธรรมดา', type_name: 'ห้องธรรมดา' }]);
    if (sql.includes('room_amenities')) return rows([{ id: 7, name: 'แชมพู' }]);
    return rows();
  };
  const res = response(); await rooms.deleteAmenity({ params: { id: '7' } }, res);
  assert.equal(res.code, 409);
  assert.match(res.body.message, /ใช้งาน|ผูก/);
  assert(!queries.some(sql => /DELETE FROM|array_remove/.test(sql)));
  assert(queries.includes('ROLLBACK'));
});

test('an unused amenity can be deleted after checking references', async () => {
  queries.length = 0;
  queryHandler = async sql => sql.includes('room_amenities') ? rows([{ id: 7, name: 'แชมพู' }]) : rows();
  const res = response(); await rooms.deleteAmenity({ params: { id: '7' } }, res);
  assert.equal(res.code, 200);
  const check = queries.findIndex(sql => sql.includes('FROM room_types'));
  assert(check >= 0 && check < queries.findIndex(sql => sql.includes('DELETE FROM')));
  assert(!queries.some(sql => sql.includes('array_remove')));
  assert(queries.includes('COMMIT'));
});

test('room type creation rejects references to an amenity that has been deleted', async () => {
  queries.length = 0; queryHandler = async sql => sql.includes('INSERT INTO room_types') ? rows([{ id: 2 }]) : rows();
  const res = response(); await rooms.createRoom({ body: { type_name: 'TEST', capacity: 2, price: 1000, room_image: 'test.jpg', amenities: [999] } }, res);
  assert.equal(res.code, 400);
  assert(!queries.some(sql => sql.includes('INSERT INTO room_types')));
});
