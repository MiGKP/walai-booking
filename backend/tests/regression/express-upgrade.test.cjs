const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const bcrypt = require('bcryptjs');
require('ts-node/register/transpile-only');
const { memberListValidator } = require('../../src/middleware/pagination-validator.ts');
const { validate } = require('../../src/middleware/validate.middleware.ts');
const { preserveRequestQuery } = require('../../src/middleware/request-query.middleware.ts');

test('Express 5 query validation retains sanitized search and rejects duplicate pagination', async t => {
  const app = express();
  app.set('query parser', 'extended');
  app.use(preserveRequestQuery);
  app.get('/members', memberListValidator, validate, (req, res) => res.json(req.query));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/members`;
  const valid = await fetch(`${url}?search=%20TEST%20&page=2&limit=10`);
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).search, 'TEST');
  assert.equal((await fetch(`${url}?page=1&page=2`)).status, 400);
  assert.equal((await fetch(`${url}?search[]=TEST`)).status, 400);
});

test('bcrypt 3 accepts the existing bcrypt hash format and rejects a wrong password', async () => {
  // Generated with bcryptjs 2.4.3 using TEST data and a fixed salt.
  const hash = '$2a$04$abcdefghijklmnopqrstuuS51QQoJIOMhEzSmtnVad8eNx8LONTWS';
  assert.equal(await bcrypt.compare('TEST-legacy-password', hash), true);
  assert.equal(await bcrypt.compare('TEST-wrong-password', hash), false);
  const generated = await bcrypt.hash('TEST-password', 4);
  assert.equal(await bcrypt.compare('TEST-password', generated), true);
});

test('all API routers mount on Express 5 and still reject unauthenticated staff/member requests', async t => {
  const filename = require.resolve('../../src/config/database.ts');
  require.cache[filename] = { id: filename, filename, loaded: true, exports: { __esModule: true, default: {
    query() { throw new Error('This test must never access the database'); },
    connect() { throw new Error('This test must never access the database'); },
  } } };
  const app = express();
  app.use(express.json());
  app.set('query parser', 'extended');
  app.use(preserveRequestQuery);
  for (const [prefix, name] of [['auth','auth'],['rooms','room'],['bookings','booking'],['kayaks','kayak'],['payments','payment'],['uploads','upload'],['reviews','review'],['settings','settings'],['promotions','promotion'],['members','member'],['staff','staff']]) {
    app.use(`/api/${prefix}`, require(`../../src/routes/${name}.routes.ts`).default);
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  for (const endpoint of ['/auth/profile','/bookings','/kayaks/bookings/all','/payments/room_99999','/reviews/admin/all','/settings/notifications/pending','/members']) {
    assert.equal((await fetch(url + endpoint)).status, 401, endpoint);
  }
  assert.equal((await fetch(url + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
});
