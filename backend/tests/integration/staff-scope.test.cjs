const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('ts-node/register/transpile-only');
const url = process.env.TEST_DATABASE_URL;
if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('TEST_DATABASE_URL must be local');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const stub = (relative, exports) => { const filename = require.resolve(path.resolve(__dirname, '../../src', relative)); require.cache[filename] = { id: filename, filename, loaded: true, exports }; };
test('staff recovery, complete profiles, role reports and member filters against PostgreSQL', { skip: !url }, async t => {
  const client = new Client({ connectionString: url }); await client.connect();
  const previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'TEST-local-scope-only';
  const sent = [];
  stub('config/database.ts', { __esModule: true, default: client });
  stub('services/mail.service.ts', { sendPasswordResetEmail: async value => sent.push(value) });
  stub('services/cloudinary.service.ts', { deleteCloudinaryImage: async () => {} });
  const auth = require('../../src/controllers/auth.controller.ts');
  const { authenticate } = require('../../src/middleware/auth.middleware.ts');
  const { getStats } = require('../../src/controllers/settings.controller.ts');
  const { getAllMembers } = require('../../src/controllers/member.controller.ts');
  try {
    // All fixtures are temporary tables on a loopback-only test connection.
    await client.query(`CREATE TEMP TABLE members (member_id int PRIMARY KEY, first_name text, last_name text, email text UNIQUE, phone text,
      password text, is_active boolean DEFAULT true, password_changed_at timestamptz, reset_token text, reset_token_expires_at timestamptz,
      reset_attempts int DEFAULT 0, image_profile text, line_id text, facebook text, created_at timestamp DEFAULT NOW());
      CREATE TEMP TABLE staff (staff_id int PRIMARY KEY, first_name text, last_name text, email text UNIQUE, password text,
      phone text, address text, line_id text, facebook text, role text, status boolean DEFAULT true, password_changed_at timestamptz);
      CREATE TEMP TABLE room_types (id int PRIMARY KEY, room_name text, status boolean);
      CREATE TEMP TABLE rooms (room_id int PRIMARY KEY, room_type_id int, status text);
      CREATE TEMP TABLE room_bookings (room_booking_id int PRIMARY KEY, member_id int, check_in date, check_out date, status text,
      created_at timestamp, total_price numeric, promotion_id int);
      CREATE TEMP TABLE booking_room (booking_room_id int PRIMARY KEY, room_booking_id int, room_id int, subtotal numeric, status text);
      CREATE TEMP TABLE boat_types (boat_type_id int PRIMARY KEY, type_name text, quantity int, is_active boolean);
      CREATE TEMP TABLE boat_rounds (boat_round_id int PRIMARY KEY, boat_type_id int, start_time time, end_time time, total_slots int, is_active boolean);
      CREATE TEMP TABLE round_boats (boat_round_id int, boat_type_id int, quantity int);
      CREATE TEMP TABLE boat_bookings (boat_booking_id int PRIMARY KEY, member_id int, booking_date date, total_price numeric, status text, created_at timestamp,
        is_addon boolean DEFAULT false, room_booking_id int);
      CREATE TEMP TABLE booking_boat (boat_booking_id int, boat_type_id int, boat_round_id int, boat_count int, status text);
      CREATE TEMP TABLE promotions (id int PRIMARY KEY, name text, code text);
      CREATE TEMP TABLE booking_room_promotions (room_booking_id int, room_type_id int, promotion_id int, discount_amount numeric);
      CREATE TEMP TABLE booking_promotions (room_booking_id int, promotion_id int);`);
    const migration = fs.readFileSync(path.resolve(__dirname, '../../src/db/migrations/2026-10-17-staff-password-reset.sql'), 'utf8');
    await client.query(migration); await client.query(migration);
    const hash = await bcrypt.hash('TEST-old-password', 12);
    await client.query(`INSERT INTO members (member_id, first_name, last_name, email, password) VALUES
      (1, 'TEST', 'Member', 'shared@example.test', $1), (2, 'TEST', 'Second', 'second@example.test', $1), (3, 'TEST', 'Empty', 'empty@example.test', $1);
      `, [hash]);
    for (const [id, role] of [[10, 'admin'], [11, 'room_staff'], [12, 'boat_staff']]) await client.query('INSERT INTO staff (staff_id,first_name,last_name,email,password,role) VALUES ($1,$2,$3,$4,$5,$6)', [id, 'TEST', role, id === 10 ? 'shared@example.test' : `${role}@example.test`, hash, role]);
    const call = async (fn, request) => { const res = response(); await fn(request, res); return res; };
    await t.test('all three staff roles reset with OTP, revoke old sessions, and isolate a shared member email', async () => {
      for (const id of [10, 11, 12]) {
        const { rows: [staff] } = await client.query('SELECT * FROM staff WHERE staff_id = $1', [id]);
        const before = await call(auth.login, { body: { email: staff.email, password: 'TEST-old-password' } });
        assert.equal(before.code, 200);
        await call(auth.forgotPassword, { body: { email: staff.email, account_type: 'staff' } });
        const otp = sent.at(-1).otpCode;
        assert.equal(sent.at(-1).to, staff.email);
        assert.equal((await call(auth.resetPassword, { body: { email: staff.email, otp, new_password: 'TEST-new-password' } })).code, 400);
        const req = { body: { email: staff.email, account_type: 'staff', otp, new_password: 'TEST-new-password' } };
        const concurrent = await Promise.all([call(auth.resetPassword, req), call(auth.resetPassword, req)]);
        assert.deepEqual(concurrent.map(r => r.code).sort(), [200, 400]);
        assert.equal((await call(auth.resetPassword, req)).code, 400);
        assert.equal((await call(auth.login, { body: { email: staff.email, password: 'TEST-old-password' } })).code, 401);
        await new Promise(resolve => setTimeout(resolve, 10));
        const after = await call(auth.login, { body: { email: staff.email, password: 'TEST-new-password' } });
        assert.equal(after.code, 200);
        const oldSession = response(); let next = false;
        await authenticate({ headers: { authorization: `Bearer ${before.body.data.token}` } }, oldSession, () => { next = true; });
        assert.equal(oldSession.code, 401); assert.equal(next, false);
        await authenticate({ headers: { authorization: `Bearer ${after.body.data.token}` } }, response(), () => { next = true; }); assert.equal(next, true);
      }
      const member = await client.query('SELECT password FROM members WHERE member_id = 1');
      assert.equal(await bcrypt.compare('TEST-old-password', member.rows[0].password), true);
    });
    await t.test('wrong / expired OTP and disabled staff cannot reset', async () => {
      const email = 'room_staff@example.test';
      await call(auth.forgotPassword, { body: { email, account_type: 'staff' } });
      const otp = sent.at(-1).otpCode;
      for (let i = 0; i < 5; i++) assert.equal((await call(auth.resetPassword, { body: { email, account_type: 'staff', otp: 'wrong', new_password: 'TEST-new-password' } })).code, 400);
      assert.equal((await call(auth.resetPassword, { body: { email, account_type: 'staff', otp, new_password: 'TEST-new-password' } })).code, 400);
      await client.query('UPDATE staff SET reset_token_expires_at = NOW() - interval \'1 hour\' WHERE staff_id = 11');
      await call(auth.forgotPassword, { body: { email, account_type: 'staff' } });
      const latest = sent.at(-1).otpCode;
      await client.query('UPDATE staff SET reset_token_expires_at = NOW() - interval \'1 minute\' WHERE staff_id = 11');
      assert.equal((await call(auth.resetPassword, { body: { email, account_type: 'staff', otp: latest, new_password: 'TEST-new-password' } })).code, 400);
      await client.query('UPDATE staff SET status = false WHERE staff_id = 11'); const count = sent.length;
      assert.equal((await call(auth.forgotPassword, { body: { email, account_type: 'staff' } })).code, 200); assert.equal(sent.length, count);
      await client.query('UPDATE staff SET status = true WHERE staff_id = 11');
    });
    await t.test('profile fields survive reload; email changes require password and reject duplicates', async () => {
      for (const [id, role] of [[10, 'admin'], [11, 'room_staff'], [12, 'boat_staff']]) {
        const user = { id, role };
        assert.equal((await call(auth.updateProfile, { user, body: { first_name: 'TEST', last_name: 'Profile', phone: '0812345678', address: 'TEST address', line_id: 'TEST-line', facebook: 'TEST-facebook' } })).code, 200);
        const read = await call(auth.getProfile, { user });
        assert.equal(read.body.data.address, 'TEST address'); assert.equal(read.body.data.line_id, 'TEST-line'); assert.equal(read.body.data.facebook, 'TEST-facebook');
        const session = await call(auth.login, { body: { email: read.body.data.email, password: 'TEST-new-password' } });
        const body = { first_name: 'TEST', last_name: 'Profile', email: `new-${id}@example.test` };
        assert.equal((await call(auth.updateProfile, { user, body })).code, 400);
        assert.equal((await call(auth.updateProfile, { user, body: { ...body, email: 'second@example.test', current_password: 'TEST-new-password' } })).code, 409);
        assert.equal((await call(auth.updateProfile, { user, body: { ...body, current_password: 'TEST-new-password' } })).code, 200);
        const updated = await call(auth.getProfile, { user }); assert.equal(updated.body.data.email, body.email); assert.equal(updated.body.data.address, 'TEST address');
        const request = { headers: { authorization: `Bearer ${session.body.data.token}` } };
        let accepted = false;
        await authenticate(request, response(), () => { accepted = true; });
        assert.equal(accepted, true);
        assert.equal(request.user.email, body.email, 'staff actions must use the saved email rather than the old JWT email');
      }
    });
    await t.test('concurrent email edits cannot silently overwrite an already changed account', async () => {
      const edits = await Promise.all(['a', 'b'].map(suffix => call(auth.updateProfile, {
        user: { id: 10, role: 'admin' },
        body: { first_name: 'TEST', last_name: 'Profile', email: `concurrent-${suffix}@example.test`, current_password: 'TEST-new-password' },
      })));
      assert.deepEqual(edits.map(r => r.code).sort(), [200, 409]);
    });
    await client.query(`INSERT INTO room_types VALUES (1, 'TEST A', true), (2, 'TEST B', true);
      INSERT INTO rooms VALUES (1,1,'available'), (2,1,'available'), (3,2,'available'), (4,2,'maintenance');
      INSERT INTO room_bookings VALUES (1,1,'2026-10-12','2026-10-14','approved','2026-10-12',2700,1),
        (2,2,'2026-10-12','2026-10-13','cancelled','2026-10-12',1000,1), (3,1,'2026-10-14','2026-10-15','paid','2026-10-12',500,NULL);
      INSERT INTO booking_room VALUES (1,1,1,1000,'approved'), (2,1,3,2000,'approved'), (3,2,2,1000,'cancelled');
      INSERT INTO promotions VALUES (1,'TEST package A','TEST_A'), (2,'TEST package B','TEST_B');
      INSERT INTO booking_room_promotions VALUES (1,1,1,100), (1,2,2,200), (2,1,1,0);
      INSERT INTO booking_promotions VALUES (1,1), (1,2), (2,1);
      INSERT INTO boat_types VALUES (1,'TEST boat A',5,true), (2,'TEST boat B',3,true);
      INSERT INTO boat_rounds VALUES (1,NULL,'15:00','15:30',4,true);
      INSERT INTO round_boats VALUES (1,1,5), (1,2,3);
      INSERT INTO boat_bookings (boat_booking_id,member_id,booking_date,total_price,status,created_at) VALUES (1,1,'2026-10-12',40,'approved','2026-10-12'), (2,2,'2026-10-12',20,'paid','2026-10-12');
      INSERT INTO booking_boat VALUES (1,1,1,2,'approved'), (2,2,1,1,'paid');`);
    await t.test('reports enforce service access and correctly allocate group packages / shared boat capacity', async () => {
      const query = { period: 'day', date: '2026-10-12' };
      assert.equal((await call(getStats, { user: { role: 'customer' }, query })).code, 403);
      assert.equal((await call(getStats, { user: { role: 'admin' }, query: { period: 'day', date: '2026-02-30' } })).code, 400);
      const room = await call(getStats, { user: { role: 'room_staff' }, query }); assert.equal(room.code, 200);
      assert.equal(room.body.data.kayak_summary, undefined); assert.equal(room.body.data.boat_inventory, undefined); assert.equal(room.body.data.total_members, undefined);
      assert.equal(Number(room.body.data.room_summary.revenue), 2700); assert.equal(room.body.data.room_summary.paid_count, 1);
      assert.deepEqual(room.body.data.packages.map(p => [p.id, p.booking_count, Number(p.revenue)]), [[1,1,900],[2,1,1800]]);
      assert.deepEqual(room.body.data.room_inventory.map(r => [r.total,r.booked,r.available]), [[2,1,1],[1,1,0]]);
      const boat = await call(getStats, { user: { role: 'boat_staff' }, query }); assert.equal(boat.code, 200);
      assert.equal(boat.body.data.room_summary, undefined); assert.equal(boat.body.data.packages, undefined);
      assert.deepEqual(boat.body.data.boat_inventory.map(r => [r.total,r.booked,r.available]), [[5,2,1],[3,1,1]]);
      const admin = await call(getStats, { user: { role: 'admin' }, query }); assert.equal(admin.body.data.total_members, 3);
      const month = await call(getStats, { user: { role: 'admin' }, query: { period: 'month', year: '2026', month: '10' } });
      assert.equal(month.code, 200); assert.equal(month.body.data.room_inventory.length, 62);
    });
    await t.test('member filters match status in selected service and count each member once', async () => {
      const filter = async query => call(getAllMembers, { query: { page: '1', limit: '10', ...query } });
      assert.deepEqual((await filter({ booking_status: 'paid' })).body.data.map(m => m.member_id).sort(), [1,2]);
      assert.deepEqual((await filter({ booking_status: 'paid', booking_service: 'room' })).body.data.map(m => m.member_id), [1]);
      assert.deepEqual((await filter({ booking_status: 'paid', booking_service: 'boat' })).body.data.map(m => m.member_id), [2]);
      assert.deepEqual((await filter({ booking_status: 'none' })).body.data.map(m => m.member_id), [3]);
      assert.equal((await filter({ booking_status: 'approved' })).body.pagination.total, 1);
      assert.equal((await filter({ booking_status: "paid'; DROP TABLE members" })).code, 400);
    });
    await t.test('paid room addons and legacy stacked codes never double-count report revenue', async () => {
      await client.query(`INSERT INTO room_bookings VALUES (4,1,'2026-10-20','2026-10-21','approved','2026-10-12',1100,NULL);
        INSERT INTO booking_room VALUES (4,4,1,400,'approved'), (5,4,3,600,'approved');
        INSERT INTO booking_promotions VALUES (4,1),(4,2);
        INSERT INTO boat_bookings VALUES (3,1,'2026-10-20',200,'approved','2026-10-12',true,4);`);
      const admin = await call(getStats, { user: { role: 'admin' }, query: { period: 'day', date: '2026-10-12' } });
      assert.equal(admin.code, 200);
      assert.equal(Number(admin.body.data.room_summary.revenue), 3600);
      assert.equal(Number(admin.body.data.kayak_summary.revenue), 240);
      assert.deepEqual(admin.body.data.packages.map(p => [p.id,p.booking_count,Number(p.revenue)]), [[1,2,1350],[2,2,2250]]);
      assert.equal(Number(admin.body.data.room_chart[0].revenue), 3600);
    });
  } finally { await client.end(); if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; }
});
