const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
require('ts-node/register/transpile-only');

// Replace service boundaries before importing controllers: these tests never load
// .env, connect to PostgreSQL, send email, or contact Cloudinary.
let queryHandler;
let connectHandler;
let uploadHandler;
let deleteHandler;
const database = {
  query: (...args) => queryHandler(...args),
  connect: (...args) => connectHandler(...args),
};
function stub(relative, exports) {
  const filename = require.resolve(path.resolve(__dirname, '../../src', relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('config/database.ts', { __esModule: true, default: database });
stub('services/mail.service.ts', {
  sendBookingConfirmationEmail: async () => {},
  sendBookingStatusEmail: async () => {},
  sendPaymentSlipNotificationEmail: async () => {},
});
stub('services/cloudinary.service.ts', {
  uploadImage: (...args) => uploadHandler(...args),
  deleteCloudinaryImage: (...args) => deleteHandler(...args),
});
const payment = require('../../src/controllers/payment.controller.ts');
const booking = require('../../src/controllers/booking.controller.ts');
const kayak = require('../../src/controllers/kayak.controller.ts');

function rows(data = []) { return { rows: data, rowCount: data.length }; }
function response() {
  return {
    code: 200,
    body: undefined,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function request(body = {}, params = {}) {
  return { body, params, query: {}, user: { id: 1, role: 'customer', email: 'member@example.test' } };
}
function client(handler) { return { query: handler, release() {} }; }
function barrier(count) {
  let arrivals = 0;
  let resolve;
  const ready = new Promise(r => { resolve = r; });
  return async () => { if (++arrivals === count) resolve(); await ready; };
}

for (const type of ['room', 'kayak']) {
  test(`concurrent ${type} slip uploads keep the accepted image`, async () => {
    const assets = new Set();
    const uploads = [];
    const deleted = [];
    const bothUploaded = barrier(2);
    let accepted;
    queryHandler = async sql => sql.includes('FROM staff')
      ? rows() : rows([{ status: 'pending', total_price: 100, first_name: 'Guest', last_name: '' }]);
    uploadHandler = async (_buffer, options) => {
      const url = `https://res.cloudinary.com/test/image/upload/${options.publicId}.png`;
      uploads.push(options.publicId);
      assets.add(url);
      await bothUploaded();
      return { url, publicId: options.publicId };
    };
    deleteHandler = async url => { deleted.push(url); assets.delete(url); };
    connectHandler = async () => client(async (sql, values) => {
      if (sql.startsWith(`UPDATE ${type === 'room' ? 'room_bookings' : 'boat_bookings'}`)) {
        if (accepted) return rows();
        accepted = values[0];
        return { rows: [], rowCount: 1 };
      }
      return rows();
    });
    const first = response();
    const second = response();
    await Promise.all([first, second].map(res => payment.uploadPaymentSlip({
      ...request({}, { id: `${type}_7` }), file: { buffer: Buffer.from('slip') },
    }, res)));
    assert.deepEqual([first.code, second.code].sort(), [200, 409]);
    assert.equal(new Set(uploads).size, 2, 'each attempt must have its own Cloudinary public ID');
    assert.equal(assets.has(accepted), true, 'losing cleanup must leave the accepted asset intact');
    assert.equal(deleted.includes(accepted), false);
  });
}

test('slip upload cleans up its own asset if acquiring a DB connection fails', async t => {
  t.mock.method(console, 'error', () => {});
  const deleted = [];
  queryHandler = async () => rows([{ status: 'pending', total_price: 100 }]);
  uploadHandler = async () => ({ url: 'https://example.test/new-slip.png', publicId: 'new' });
  deleteHandler = async url => { deleted.push(url); };
  connectHandler = async () => { throw new Error('simulated pool unavailable'); };
  const res = response();
  await payment.uploadPaymentSlip({ ...request({}, { id: 'room_7' }), file: { buffer: Buffer.from('slip') } }, res);
  assert.equal(res.code, 500);
  assert.deepEqual(deleted, ['https://example.test/new-slip.png']);
});

test('POST payment exposes the room ticket flag used by the payment CTA', async () => {
  queryHandler = async sql => sql.includes('FROM resort_info')
    ? rows([{ promptpay_id: '0000000000' }])
    : rows([{ total_price: 100, payment_status: 'paid', status: 'paid', ...(sql.includes('has_boat_tickets') ? { has_boat_tickets: true } : {}) }]);
  const res = response();
  await payment.createPayment(request({ booking_type: 'room', booking_id: 7 }), res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.has_boat_tickets, true);
});

function roomScenario({ infantAge = 6, busy = new Set() } = {}) {
  const queries = [];
  let lineId = 0;
  const handler = async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('infant_max_age_exclusive')) return rows([{ infant_max_age_exclusive: infantAge }]);
    if (sql.includes('FROM room_types WHERE id')) return rows([{ id: values[0], price: 100, capacity: 1, room_name: `Type ${values[0]}` }]);
    if (sql.includes('FROM rooms') && sql.includes('ANY')) return rows([{ room_id: 10 }, { room_id: 20 }, { room_id: 21 }]);
    if (sql.startsWith('SELECT room_id FROM rooms')) return rows([{ room_id: values[0] }]);
    if (sql.includes('FROM rooms r') && sql.includes('r.room_id = $1')) {
      return busy.has(values[0]) || (values[2] || []).includes(values[0])
        ? rows() : rows([{ room_id: values[0], room_number: String(values[0]) }]);
    }
    if (sql.includes('FROM rooms r')) {
      const ids = values[0] === 1 ? [10] : [20, 21];
      return rows(ids.filter(id => !(values[1] || []).includes(id)).map(id => ({ room_id: id, room_number: String(id) })));
    }
    if (sql.includes('FROM booking_room br') && sql.includes('LIMIT 1')) return busy.has(values[0]) ? rows([{ '?column?': 1 }]) : rows();
    if (sql.includes('INSERT INTO room_bookings')) {
      const names = sql.match(/room_bookings\s*\(([\s\S]*?)\)/)[1].split(',').map(s => s.trim());
      const expressions = sql.match(/VALUES\s*\(([\s\S]*?)\)/)[1].split(',').map(s => s.trim());
      const header = { room_booking_id: 7 };
      names.forEach((name, i) => { if (/^\$\d+$/.test(expressions[i])) header[name] = values[Number(expressions[i].slice(1)) - 1]; });
      return rows([header]);
    }
    if (sql.includes('INSERT INTO booking_room')) return rows([{ booking_room_id: ++lineId, room_id: values[1] }]);
    return rows();
  };
  connectHandler = async () => client(handler);
  queryHandler = async () => rows();
  return queries;
}

function roomBody(items) {
  return { items, check_in_date: '2099-01-01', check_out_date: '2099-01-03', adults: 1, children: 0 };
}

test('reversed room carts including explicit choices take the same global lock order', async () => {
  const firstQueries = roomScenario();
  const first = response();
  await booking.createRoomBooking(request(roomBody([
    { room_type_id: 2, room_id: 21, quantity: 1 }, { room_type_id: 1, quantity: 1 },
  ])), first);
  const secondQueries = roomScenario();
  const second = response();
  await booking.createRoomBooking(request(roomBody([
    { room_type_id: 1, quantity: 1 }, { room_type_id: 2, room_id: 21, quantity: 1 },
  ])), second);
  assert.equal(first.code, 201);
  assert.equal(second.code, 201);
  const firstLock = firstQueries.find(q => /FROM rooms/.test(q.sql) && /FOR UPDATE/.test(q.sql));
  const secondLock = secondQueries.find(q => /FROM rooms/.test(q.sql) && /FOR UPDATE/.test(q.sql));
  assert.match(firstLock.sql, /ORDER BY (?:r\.)?room_id[\s\S]*FOR UPDATE/);
  assert.match(firstLock.sql, /ANY\(/, 'lock every candidate before allocating an explicit or automatic room');
  assert.deepEqual(firstLock.values, secondLock.values);
  assert.equal(first.body.data.rooms[0].room_id, 21, 'explicit physical room choice is preserved');
  assert.equal(firstQueries.some(q => /SKIP LOCKED/.test(q.sql)), false);
});

test('room allocation still checks overlap after acquiring locks', async () => {
  roomScenario({ busy: new Set([20]) });
  const res = response();
  await booking.createRoomBooking(request(roomBody([{ room_type_id: 2, quantity: 1 }])), res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.rooms[0].room_id, 21);
});

test('automatic room allocation preserves explicit physical choices later in the cart', async () => {
  roomScenario();
  const res = response();
  await booking.createRoomBooking(request(roomBody([
    { room_type_id: 2, quantity: 1 }, { room_type_id: 2, room_id: 20, quantity: 1 },
  ])), res);
  assert.equal(res.code, 201);
  assert.deepEqual(res.body.data.rooms.map(room => room.room_id), [21, 20]);
});

test('room booking persists guest contact details', async () => {
  roomScenario();
  const res = response();
  await booking.createRoomBooking(request({
    ...roomBody([{ room_type_id: 1, quantity: 1 }]),
    guest_name: 'Actual Guest', guest_phone: '0812345678', guest_email: 'guest@example.test',
  }), res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.guest_name, 'Actual Guest');
  assert.equal(res.body.data.guest_phone, '0812345678');
  assert.equal(res.body.data.guest_email, 'guest@example.test');
});

test('room capacity uses the configured infant age cutoff', async () => {
  const queries = roomScenario({ infantAge: 4 });
  const res = response();
  await booking.createRoomBooking(request({
    ...roomBody([{ room_type_id: 1, quantity: 1 }]), children: 1, child_ages: [4],
  }), res);
  assert.equal(res.code, 400, 'a four-year-old counts when the configured cutoff is four');
  assert.equal(queries.some(q => q.sql.includes('infant_max_age_exclusive')), true);
});

test('invalid persisted infant cutoff is rejected instead of becoming zero', async t => {
  t.mock.method(console, 'error', () => {});
  roomScenario({ infantAge: null });
  const res = response();
  await booking.createRoomBooking(request(roomBody([{ room_type_id: 1, quantity: 1 }])), res);
  assert.equal(res.code, 500);
});

test('staff room reads fall back to member details only when guest fields are absent', async () => {
  let select;
  queryHandler = async sql => { select = sql; return rows(); };
  await booking.getAllRoomBookings(request(), response());
  assert.match(select, /COALESCE\([\s\S]*rb\.guest_name[\s\S]*as user_name/);
  assert.match(select, /COALESCE\([^\n]*rb\.guest_email[^\n]*m\.email/);
  assert.match(select, /COALESCE\([^\n]*rb\.guest_phone[^\n]*m\.phone/);
});

function addonScenario() {
  const queries = [];
  const rounds = [
    { boat_round_id: 1, boat_type_id: 1, member_type_ids: [1], start_time: '09:00:00', end_time: '10:00:00', total_slots: 1, is_active: true },
    { boat_round_id: 2, boat_type_id: 2, member_type_ids: [2], start_time: '09:00:00', end_time: '10:00:00', total_slots: 1, is_active: true },
  ];
  connectHandler = async () => client(async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('FROM room_bookings rb') && sql.includes('FOR UPDATE OF rb')) return rows([{ room_booking_id: 7 }]);
    if (sql.includes('FROM booking_room br')) return rows([{ booking_room_id: 8, room_booking_id: 7, member_id: 1, check_in: '2099-01-01', check_out: '2099-01-04', room_status: 'pending' }]);
    if (sql.includes('SUM(total_tickets')) return rows([{ mode: 'free', unit_price: 0, balance: 1 }]);
    if (sql.includes('FROM boat_rounds br') && sql.includes('start_time =')) return rows(rounds);
    if (sql.includes('FROM boat_rounds br') && sql.includes('br.start_time = selected')) return rows(rounds);
    if (sql.includes('FROM boat_rounds br') && sql.includes('SELECT 1')) return rows([{ '?column?': 1 }]);
    if (sql.includes('FROM boat_rounds br')) return rows(rounds.filter(r => r.boat_round_id === values[0]));
    if (sql.includes('FROM boat_types')) return rows([{ boat_type_id: values[0], type_name: 'Boat', seat_count: 1, quantity: 4, price: 100 }]);
    if (sql.includes('FROM round_boats')) return rows([{ quantity: 4 }]);
    if (sql.includes('SUM(bnb.boat_count)')) return rows([{ booked_boats: 0, total_passengers: 0, total_booked: 0 }]);
    if (sql.includes('INSERT INTO boat_bookings')) return rows([{ boat_booking_id: 9 }]);
    if (sql.includes('FROM member_boat_tickets') && sql.includes('FOR UPDATE')) return rows([{ id: 1, total_tickets: 1, used_tickets: 0 }]);
    return rows();
  });
  queryHandler = async () => rows();
  return queries;
}

test('addon locks all rounds in the shared time window before counting capacity', async () => {
  const queries = addonScenario();
  const res = response();
  await kayak.createBoatAddon(request({ boat_type_id: 2, boat_round_id: 2, booking_date: '2099-01-02', num_passengers: 1 }, { bookingRoomId: '8' }), res);
  assert.equal(res.code, 201);
  const roundLock = queries.find(q => q.sql.includes('FROM boat_rounds') && /FOR UPDATE/.test(q.sql));
  assert.match(roundLock.sql, /ORDER BY br\.boat_round_id[\s\S]*FOR UPDATE OF br/);
  assert.match(roundLock.sql, /start_time[\s\S]*end_time/);
  assert.doesNotMatch(roundLock.sql, /WHERE br\.is_active = true/, 'inactive rounds may still have existing pool reservations');
  assert.ok(queries.indexOf(roundLock) < queries.findIndex(q => /SUM\(bnb.boat_count\)/.test(q.sql)));
});

test('normal kayak bookings use the same ascending shared-round lock order', async () => {
  const queries = addonScenario();
  const res = response();
  await kayak.createKayakBooking(request({ items: [{ boat_type_id: 1, num_passengers: 1 }], start_time: '09:00', end_time: '10:00', booking_date: '2099-01-02' }), res);
  assert.equal(res.code, 201);
  const roundLock = queries.find(q => q.sql.includes('FROM boat_rounds') && /FOR UPDATE/.test(q.sql));
  assert.match(roundLock.sql, /ORDER BY br\.boat_round_id[\s\S]*FOR UPDATE OF br/);
  assert.doesNotMatch(roundLock.sql, /WHERE br\.is_active = true/);
});

function inventoryScenario(reservations) {
  const queries = [];
  connectHandler = async () => client(async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('COUNT(*)') && sql.includes('FROM boat_types')) return rows([{ count: values[0].length }]);
    if (sql.includes('FROM boat_types')) return rows([{ boat_type_id: 1 }]);
    if (sql.includes('FROM boat_rounds') && sql.includes('FOR UPDATE')) return rows([{ boat_round_id: 1 }]);
    if (sql.includes('FROM round_boats')) return rows([{ boat_type_id: 1 }]);
    if (sql.includes('UPDATE boat_rounds')) return rows([{ boat_round_id: 1 }]);
    if (sql.includes('MAX') && sql.includes('booking_date')) {
      const events = new Map();
      for (const r of reservations) {
        if (['cancelled', 'rejected', 'checked_out'].includes(r.status)) continue;
        if (!events.has(r.date)) events.set(r.date, []);
        events.get(r.date).push([r.start, r.count], [r.end, -r.count]);
      }
      let peak = 0;
      for (const day of events.values()) {
        let active = 0;
        const grouped = new Map();
        for (const [time, delta] of day) grouped.set(time, (grouped.get(time) || 0) + delta);
        for (const [, delta] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) { active += delta; peak = Math.max(peak, active); }
      }
      return rows([{ n: peak }]);
    }
    if (sql.includes('SUM(') && sql.includes('booking_boat')) return rows([{ n: reservations.filter(r => !['cancelled', 'rejected', 'checked_out'].includes(r.status)).reduce((n, r) => n + r.count, 0) }]);
    return rows();
  });
  return queries;
}

test('addon locks its room header before the room line used by slip submission', async () => {
  const queries = addonScenario();
  const res = response();
  await kayak.createBoatAddon(request({ boat_type_id: 2, boat_round_id: 2, booking_date: '2099-01-02', num_passengers: 1 }, { bookingRoomId: '8' }), res);
  assert.equal(res.code, 201);
  const locks = queries.filter(q => /FOR UPDATE/.test(q.sql));
  assert.match(locks[0].sql, /FOR UPDATE OF rb/);
  assert.match(locks[1].sql, /FOR UPDATE OF br/);
});

test('concurrent addons selecting different round IDs cannot oversell a shared slot', async () => {
  const rounds = [1, 2].map(id => ({
    boat_round_id: id, boat_type_id: id, start_time: '09:00:00', end_time: '10:00:00',
    total_slots: 1, is_active: true,
  }));
  let queue = Promise.resolve();
  let booked = 0;
  const simultaneousUnprotectedChecks = barrier(2);
  connectHandler = async () => {
    let releasePool;
    let pending = 0;
    return client(async (sql, values = []) => {
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        if (sql === 'COMMIT') booked += pending;
        if (releasePool) releasePool();
        return rows();
      }
      if (sql.includes('FROM room_bookings rb') && sql.includes('FOR UPDATE OF rb')) return rows([{ room_booking_id: values[0] }]);
      if (sql.includes('FROM booking_room br')) return rows([{ booking_room_id: values[0], room_booking_id: values[0], member_id: 1, check_in: '2099-01-01', check_out: '2099-01-04', room_status: 'pending' }]);
      if (sql.includes('SUM(total_tickets')) return rows([{ mode: 'free', unit_price: 0, balance: 1 }]);
      if (sql.includes('FROM boat_rounds br') && sql.includes('FOR UPDATE') && sql.includes('start_time =')) {
        const previous = queue;
        queue = new Promise(resolve => { releasePool = resolve; });
        await previous;
        return rows(rounds);
      }
      if (sql.includes('FROM boat_rounds br') && sql.includes('SELECT 1')) return rows([{ '?column?': 1 }]);
      if (sql.includes('FROM boat_rounds br')) return rows(rounds.filter(round => round.boat_round_id === values[0]));
      if (sql.includes('FROM boat_types')) return rows([{ boat_type_id: values[0], type_name: 'Boat', seat_count: 1, quantity: 4, price: 100 }]);
      if (sql.includes('FROM round_boats')) return rows([{ quantity: 4 }]);
      if (sql.includes('SUM(bnb.boat_count)') && sql.includes('total_booked')) {
        const snapshot = booked;
        // Reproduce the stale-snapshot race if the controller does not hold
        // the common window lock; protected requests serialize at that lock.
        if (!releasePool) await simultaneousUnprotectedChecks();
        return rows([{ total_booked: snapshot }]);
      }
      if (sql.includes('SUM(bnb.boat_count)')) return rows([{ booked_boats: 0 }]);
      if (sql.includes('INSERT INTO boat_bookings')) return rows([{ boat_booking_id: values[7] }]);
      if (sql.includes('INSERT INTO booking_boat')) pending += Number(values[4]);
      if (sql.includes('FROM member_boat_tickets') && sql.includes('FOR UPDATE')) return rows([{ id: 1, total_tickets: 1, used_tickets: 0 }]);
      return rows();
    });
  };
  const first = response();
  const second = response();
  await Promise.all([first, second].map((res, index) => kayak.createBoatAddon(request({
    boat_type_id: index + 1, boat_round_id: index + 1, booking_date: '2099-01-02', num_passengers: 1,
  }, { bookingRoomId: String(index + 8) }), res)));
  assert.deepEqual([first.code, second.code].sort(), [201, 409]);
  assert.equal(booked, 1);
});

const separateReservations = [
  { date: '2099-01-01', start: '09:00', end: '10:00', count: 4, status: 'paid' },
  { date: '2099-01-02', start: '09:00', end: '10:00', count: 4, status: 'pending' },
  { date: '2099-01-02', start: '10:00', end: '11:00', count: 4, status: 'approved' },
  { date: '2099-01-02', start: '09:00', end: '11:00', count: 30, status: 'cancelled' },
];

function cancelAddonScenario() {
  const queries = [];
  connectHandler = async () => client(async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.includes('FROM room_bookings rb') && sql.includes('FOR UPDATE OF rb')) return rows([{ room_booking_id: 7 }]);
    if (sql.includes('FROM boat_bookings') && sql.includes('FOR UPDATE')) return rows([{
      boat_booking_id: 9, room_booking_id: 7, member_id: 1,
      status: 'pending', is_addon: true, room_status: 'pending', total_price: 0,
      hours_before_start: 72, handed_out_at: null,
    }]);
    return rows();
  });
  return queries;
}

for (const endpoint of ['cancelBoatAddon', 'updateKayakBookingStatus']) {
  test(`${endpoint} locks the owning room before locking an addon`, async () => {
    const queries = cancelAddonScenario();
    const res = response();
    const req = endpoint === 'cancelBoatAddon'
      ? request({}, { boatBookingId: '9' })
      : { ...request({ status: 'rejected' }, { id: '9' }), user: { id: 2, role: 'admin' } };
    await kayak[endpoint](req, res);
    assert.equal(res.code, 200);
    const locks = queries.filter(q => /FOR UPDATE/.test(q.sql));
    assert.match(locks[0].sql, /FROM room_bookings rb[\s\S]*FOR UPDATE OF rb/);
    assert.equal(locks.some(q => /FOR UPDATE OF bb, rb/.test(q.sql)), false, 'joined row-lock acquisition order is not guaranteed');
    assert.ok(locks.some(q => /boat_bookings/.test(q.sql) && /FOR UPDATE OF bb/.test(q.sql)));
  });

  test(`${endpoint} runs concurrently with room approval without reversing locks`, async t => {
    t.mock.method(console, 'error', () => {});
    const owners = new Map();
    const waitingFor = new Map();
    const waiters = new Map();
    let nextClientId = 0;
    let addonStatus = 'pending';
    let roomStatus = 'pending';
    async function acquire(owner, key) {
      const holder = owners.get(key);
      if (holder === owner) return;
      if (holder === undefined) {
        owners.set(key, owner);
        await Promise.resolve();
        return;
      }
      waitingFor.set(owner, holder);
      if (waitingFor.get(holder) === owner) throw new Error('simulated PostgreSQL deadlock');
      await new Promise(resolve => {
        if (!waiters.has(key)) waiters.set(key, []);
        waiters.get(key).push({ owner, resolve });
      });
      waitingFor.delete(owner);
    }
    function release(owner) {
      waitingFor.delete(owner);
      for (const [key, holder] of owners) {
        if (holder !== owner) continue;
        const next = (waiters.get(key) || []).shift();
        if (next) { owners.set(key, next.owner); next.resolve(); }
        else owners.delete(key);
      }
    }
    connectHandler = async () => {
      const owner = ++nextClientId;
      return client(async (sql, values = []) => {
        if (sql === 'COMMIT' || sql === 'ROLLBACK') { release(owner); return rows(); }
        if (/FOR UPDATE OF bb, rb/.test(sql)) { await acquire(owner, 'addon'); await acquire(owner, 'room'); }
        else if (/FOR UPDATE OF rb/.test(sql) || (/FROM room_bookings/.test(sql) && /FOR UPDATE/.test(sql))) await acquire(owner, 'room');
        else if (/FROM boat_bookings/.test(sql) && /FOR UPDATE/.test(sql)) await acquire(owner, 'addon');
        if (sql.startsWith('UPDATE room_bookings')) {
          await acquire(owner, 'room');
          if (sql.includes('SET status =')) roomStatus = values[0];
          return rows([{ status: roomStatus }]);
        }
        if (sql.startsWith('UPDATE boat_bookings')) {
          await acquire(owner, 'addon');
          addonStatus = sql.includes("status = 'cancelled'") ? 'cancelled' : 'approved';
          return rows([{ status: addonStatus }]);
        }
        if (sql.includes('FROM room_bookings') && sql.includes('FOR UPDATE')) return rows([{ room_booking_id: 7, status: roomStatus }]);
        if (sql.includes('FROM boat_bookings') && sql.includes('FOR UPDATE')) return rows([{
          boat_booking_id: 9, room_booking_id: 7, member_id: 1,
          status: addonStatus, is_addon: true, room_status: roomStatus, total_price: 0,
          hours_before_start: 72, handed_out_at: null,
        }]);
        if (sql.includes('SELECT boat_booking_id FROM boat_bookings')) return addonStatus === 'pending' ? rows([{ boat_booking_id: 9 }]) : rows();
        return rows();
      });
    };
    queryHandler = async () => rows();
    const cancelResponse = response();
    const approveResponse = response();
    const cancelRequest = endpoint === 'cancelBoatAddon'
      ? request({}, { boatBookingId: '9' })
      : { ...request({ status: 'rejected' }, { id: '9' }), user: { id: 2, role: 'admin' } };
    await Promise.all([
      kayak[endpoint](cancelRequest, cancelResponse),
      booking.updateRoomBookingStatus({ ...request({ status: 'approved' }, { id: '7' }), user: { id: 2, role: 'admin' } }, approveResponse),
    ]);
    assert.deepEqual([cancelResponse.code, approveResponse.code], [200, 200]);
  });
}
for (const controller of ['updateKayak', 'updateBoatRound']) {
  test(`${controller} allows capacity equal to peak demand across separate dates and adjacent windows`, async () => {
    const queries = inventoryScenario(separateReservations);
    const res = response();
    await kayak[controller](request(controller === 'updateKayak' ? { quantity: 4 } : { boats: [{ boat_type_id: 1, quantity: 4 }] }, { id: '1' }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    const peak = queries.find(q => q.sql.includes('MAX') && q.sql.includes('booking_date'));
    assert.ok(peak);
    assert.match(peak.sql, /bnb\.status NOT IN \('cancelled', 'rejected', 'checked_out'\)/);
    assert.match(peak.sql, /PARTITION BY booking_date/);
    assert.equal(queries.some(q => /UPDATE booking_boat/.test(q.sql)), false, 'inventory edits preserve line statuses');
  });

  test(`${controller} rejects capacity below overlapping reservation demand`, async () => {
    inventoryScenario([
      { date: '2099-01-01', start: '09:00', end: '11:00', count: 4, status: 'paid' },
      { date: '2099-01-01', start: '10:00', end: '12:00', count: 3, status: 'pending' },
    ]);
    const res = response();
    await kayak[controller](request(controller === 'updateKayak' ? { quantity: 6 } : { boats: [{ boat_type_id: 1, quantity: 6 }] }, { id: '1' }), res);
    assert.equal(res.code, 400);
    assert.equal(res.body.success, false);
  });
}
