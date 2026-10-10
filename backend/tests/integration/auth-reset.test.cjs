const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('ts-node/register/transpile-only');
const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Auth fixtures require a local TEST_DATABASE_URL');
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function stub(relative, exports) {
 const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
 require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
test('real OTP replacement, one-time reset, bcrypt login and token revocation', { skip: !url }, async () => {
 const client = new Client({ connectionString: url });
 await client.connect();
 const previousSecret = process.env.JWT_SECRET;
 process.env.JWT_SECRET = 'TEST-local-auth-regression-only';
 const captured = [];
 stub('config/database.ts', { __esModule: true, default: client });
 stub('services/mail.service.ts', { sendPasswordResetEmail: async data => captured.push(data.otpCode) });
 const auth = require('../../src/controllers/auth.controller.ts');
 const { authenticate } = require('../../src/middleware/auth.middleware.ts');
 try {
  await client.query(`CREATE TEMP TABLE members (member_id int PRIMARY KEY, email text, first_name text, last_name text,
   password text, is_active boolean, reset_token text, reset_token_expires_at timestamptz,
   reset_attempts int DEFAULT 0, password_changed_at timestamptz);
   CREATE TEMP TABLE staff (staff_id int, email text, status boolean);`);
  await client.query('INSERT INTO members (member_id,email,password,is_active) VALUES (1,$1,$2,true)', ['TEST-reset@example.test', await bcrypt.hash('TEST-old-password', 12)]);
  const login = async password => { const res = response(); await auth.login({ body: { email: 'TEST-reset@example.test', password } }, res); return res; };
  const before = await login('TEST-old-password');
  assert.equal(before.code, 200);
  for (let i = 0; i < 2; i++) {
   const res = response(); await auth.forgotPassword({ body: { email: 'TEST-reset@example.test' } }, res); assert.equal(res.code, 200);
  }
  assert.equal(captured.length, 2);
  const reset = async otp => { const res = response(); await auth.resetPassword({ body: { email: 'TEST-reset@example.test', otp, new_password: 'TEST-new-password' } }, res); return res; };
  // If the secure random generator repeats a six-digit value, request another OTP.
  while (captured.at(-1) === captured[0]) await auth.forgotPassword({ body: { email: 'TEST-reset@example.test' } }, response());
  assert.equal((await reset(captured[0])).code, 400);
  assert.equal((await reset(captured.at(-1))).code, 200);
  assert.equal((await reset(captured.at(-1))).code, 400);
  assert.equal((await login('TEST-old-password')).code, 401);
  const after = await login('TEST-new-password');
  assert.equal(after.code, 200);
  const oldSession = response(); let oldNext = false;
  await authenticate({ headers: { authorization: `Bearer ${before.body.data.token}` } }, oldSession, () => { oldNext = true; });
  assert.equal(oldSession.code, 401); assert.equal(oldNext, false);
  const newSession = response(); let newNext = false;
  await authenticate({ headers: { authorization: `Bearer ${after.body.data.token}` } }, newSession, () => { newNext = true; });
  assert.equal(newNext, true);
 } finally {
  await client.end();
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
 }
});
