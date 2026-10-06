const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const jwt = require('jsonwebtoken');
require('ts-node/register/transpile-only');

// Isolate all external services before importing actual controller/middleware code.
let queryHandler;
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: { query: (...args) => queryHandler(...args) } });
stub('services/mail.service.ts', { sendPasswordResetEmail: async () => {} });
stub('services/cloudinary.service.ts', {});
const bcryptFile = require.resolve('bcryptjs');
require.cache[bcryptFile] = { id: bcryptFile, filename: bcryptFile, loaded: true, exports: {
  compare: async () => true, hash: async () => 'mock-password-hash',
} };
const auth = require('../../src/controllers/auth.controller.ts');
const { authenticate } = require('../../src/middleware/auth.middleware.ts');
const settings = require('../../src/controllers/settings.controller.ts');
const rows = data => ({ rows: data, rowCount: data.length });
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const secret = 'isolated-regression-test-secret';
const now = 2_000_000_000_750;

async function atTestTime(fn) {
  const oldNow = Date.now;
  const oldSecret = process.env.JWT_SECRET;
  Date.now = () => now;
  process.env.JWT_SECRET = secret;
  try { return await fn(); }
  finally {
    Date.now = oldNow;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
}

async function authenticateToken(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response();
  let calledNext = false;
  await authenticate(req, res, () => { calledNext = true; });
  return { req, res, calledNext };
}

test('actual reset then customer login in the same second accepts the newly issued token', async () => atTestTime(async () => {
  const crypto = require('node:crypto');
  const otpHash = crypto.createHash('sha256').update('123456').digest('hex');
  let passwordChangedAt;
  queryHandler = async (sql) => {
    if (sql.includes('SELECT member_id, reset_token')) return rows([{ member_id: 7, reset_token: otpHash }]);
    if (sql.includes('SET password = $1')) {
      passwordChangedAt = new Date(now - 250);
      return rows([{ member_id: 7 }]);
    }
    if (sql.includes('FROM staff')) return rows([]);
    if (sql.includes('SELECT is_active, password_changed_at')) return rows([{ is_active: true, password_changed_at: passwordChangedAt }]);
    return rows([{ member_id: 7, email: 'guest@example.test', password: 'hash', is_active: true }]);
  };
  const resetRes = response();
  await auth.resetPassword({ body: { email: 'guest@example.test', otp: '123456', new_password: 'new-password' } }, resetRes);
  assert.equal(resetRes.code, 200);
  const loginRes = response();
  await auth.login({ body: { email: 'guest@example.test', password: 'new-password' } }, loginRes);
  const token = loginRes.body.data.token;
  const claims = jwt.verify(token, secret);
  assert.equal(claims.issued_at_ms, now);
  assert.equal(claims.iat, Math.floor(now / 1000));
  assert.equal((await authenticateToken(token)).calledNext, true);
}));

test('old millisecond tokens and ambiguous legacy tokens are revoked; later legacy tokens still work', async () => atTestTime(async () => {
  queryHandler = async () => rows([{ is_active: true, password_changed_at: new Date(now - 250) }]);
  const base = { id: 7, role: 'customer', email: 'guest@example.test' };
  for (const claims of [
    { ...base, issued_at_ms: now - 400, iat: Math.floor(now / 1000) },
    { ...base, iat: Math.floor(now / 1000) },
  ]) {
    const result = await authenticateToken(jwt.sign(claims, secret, { expiresIn: '7d' }));
    assert.equal(result.res.code, 401);
    assert.equal(result.calledNext, false);
  }
  queryHandler = async () => rows([{ is_active: true, password_changed_at: new Date(now - 2000) }]);
  assert.equal((await authenticateToken(jwt.sign(base, secret, { expiresIn: '7d' }))).calledNext, true);
}));

test('invalid precise timestamps cannot bypass password revocation', async () => atTestTime(async () => {
  queryHandler = async () => rows([{ is_active: true, password_changed_at: new Date(now - 250) }]);
  for (const stamp of ['9999999999999', now + 1000, NaN]) {
    const token = jwt.sign({ id: 7, role: 'customer', iat: Math.floor(now / 1000), issued_at_ms: stamp }, secret, { expiresIn: '7d' });
    assert.equal((await authenticateToken(token)).res.code, 401);
  }
}));

test('staff login and Google callback issue precise signed tokens too', async () => atTestTime(async () => {
  queryHandler = async () => rows([{ staff_id: 9, email: 'staff@example.test', password: 'hash', role: 'boat_staff', status: true }]);
  const res = response();
  await auth.login({ body: { email: 'staff@example.test', password: 'password' } }, res);
  assert.equal(jwt.verify(res.body.data.token, secret).issued_at_ms, now);
  const redirects = [];
  await auth.googleCallback({ user: { member_id: 7, email: 'google@example.test' } }, { redirect: url => redirects.push(url) });
  const token = new URLSearchParams(redirects[0].split('?')[1]).get('token');
  assert.equal(jwt.verify(token, secret).issued_at_ms, now);
}));

test('registration issues a precise signed token', async () => atTestTime(async () => {
  queryHandler = async sql => sql.includes('INSERT INTO members')
    ? rows([{ member_id: 7, email: 'new@example.test' }]) : rows([]);
  const res = response();
  await auth.register({ body: { first_name: 'Guest', last_name: 'Test', email: 'new@example.test', password: 'password' } }, res);
  assert.equal(res.code, 201);
  assert.equal(jwt.verify(res.body.data.token, secret).issued_at_ms, now);
}));

async function saveResort(role, body) {
  const calls = [];
  queryHandler = async (sql, values) => { calls.push({ sql, values }); return rows([{ id: values.at(-1) }]); };
  const res = response();
  await settings.upsertResortInfo({ params: {}, body, user: { role, id: 9 } }, res);
  return { res, calls };
}

test('staff edits honor their explicit row and remain scoped when the name is changed or omitted', async () => {
  for (const [role, id] of [['room_staff', 4], ['boat_staff', 5]]) {
    for (const body of [{ id, additional_terms: 'terms' }, { name: 'New location name', address: 'address' }]) {
      const { res, calls } = await saveResort(role, body);
      assert.equal(res.code, 200);
      assert.equal(calls.at(-1).values.at(-1), id);
    }
  }
});

test('staff cannot write another service or the main resort, and admins only write supported rows', async () => {
  for (const [role, id] of [['room_staff', 3], ['room_staff', 5], ['boat_staff', 3], ['boat_staff', 4]]) {
    const { res, calls } = await saveResort(role, { id, additional_terms: 'terms' });
    assert.equal(res.code, 403);
    assert.equal(calls.length, 0);
  }
  for (const id of [3, 4, 5]) {
    assert.equal((await saveResort('admin', { id, address: 'address' })).res.code, 200);
  }
  assert.equal((await saveResort('admin', { id: 99, address: 'address' })).res.code, 400);
});

test('age setting accepts inclusive bounds on main resort only and preserves zero', async () => {
  for (const value of [0, 6, 18, '6']) {
    const { res, calls } = await saveResort('admin', { id: 3, infant_max_age_exclusive: value });
    assert.equal(res.code, 200);
    assert.equal(calls.at(-1).values[0], Number(value));
  }
  for (const value of [-1, 19, 6.5, null, '', '6oops', true]) {
    const { res, calls } = await saveResort('admin', { id: 3, infant_max_age_exclusive: value });
    assert.equal(res.code, 400);
    assert.equal(calls.length, 0);
  }
  assert.equal((await saveResort('admin', { id: 4, infant_max_age_exclusive: 6 })).res.code, 400);
  assert.equal((await saveResort('boat_staff', { id: 5, infant_max_age_exclusive: 6 })).res.code, 403);
});

test('staff payment destination fields remain protected', async () => {
  const { res, calls } = await saveResort('boat_staff', { id: 5, address: 'address', promptpay_id: 'blocked', bank_account_no: 'blocked', bank_account_name: 'blocked' });
  assert.equal(res.code, 200);
  assert.equal(calls.at(-1).sql.includes('promptpay_id'), false);
  assert.equal(calls.at(-1).sql.includes('bank_account'), false);
});

test('public resort response selects the configurable age setting', async () => {
  let sql;
  queryHandler = async query => { sql = query; return rows([{ id: 3, infant_max_age_exclusive: 6 }]); };
  const res = response();
  await settings.getResortInfo({ query: { id: '3' } }, res);
  assert.equal(res.body.data.infant_max_age_exclusive, 6);
  assert.ok(sql.includes('infant_max_age_exclusive'));
});
