const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '../..');
function load(relative, states = [], overrides = {}) {
  let cursor = 0;
  const modules = new Map();
  const react = { ...React, useState: initial => [cursor < states.length ? states[cursor++] : (cursor++, typeof initial === 'function' ? initial() : initial), () => {}], useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn(), useRef: value => ({ current: value }) };
  const mocks = {
    react,
    'next/link': ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
    'next/navigation': { useSearchParams: () => new URLSearchParams(), useRouter: () => ({}), usePathname: () => '/' },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    'react-hot-toast': { error() {}, success() {} },
    '@/lib/api': { get: async () => ({ data: { data: [] } }), getApiErrorMessage: () => 'Mock error' },
    '@/hooks/useAuthGuard': { useAuthGuard: () => ({ ready: true, user: { role: 'customer' } }) },
    '@/hooks/useAuth': { useAuth: () => ({ user: { role: 'customer' } }) },
    '@/hooks/useConfirmStore': { useConfirmStore: { getState: () => ({}) } },
    '@/lib/toastConfirm': { toastConfirm() {} },
    ...overrides,
  };
  function read(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const mod = new Module(file);
    modules.set(file, mod);
    mod.filename = file;
    mod.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
        const found = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        return read(found);
      }
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }
  return read(path.join(root, relative));
}

const kayak = { boat_booking_id: 21, is_addon: true, room_booking_id: 9, kayak_name: 'เรือเสริม', status: 'pending', created_at: new Date().toISOString(), booking_date: '2026-11-02', total_price: 250 };

test('new password policy matches UTF-8 bcrypt limits and rejects easy guesses', () => {
  const { getNewPasswordError } = load('src/lib/password-policy.ts');
  for (const value of ['Stay2026', 'a long quiet stay beside the river', 'พักริมแม่น้ำ2569', 'A7!'.repeat(24)]) assert.equal(getNewPasswordError(value), null);
  for (const value of ['short', '12345678', 'PASSWORD', '        ', 'aaaaaaaa', 'A'.repeat(73), 'ก'.repeat(25)]) assert(getNewPasswordError(value));
});

test('room check-in offers whole-booking rejection only before any room starts', () => {
  for (const started of [false, true]) {
    const b = { id: 9, room_booking_id: 9, status: 'approved', user_name: 'TEST', check_in: '2099-01-01', check_out: '2099-01-02', rooms: [{ booking_room_id: 51, room_number: 'W1', status: 'approved' }, { booking_room_id: 52, room_number: 'W2', status: started ? 'checked_in' : 'approved' }] };
    const states = [[b], false, '', 'all', 'all', 'arrivals', 'detailed', 'time', 1, 1, new Set(), '14:00', '23:00', false, {}, false, null, null];
    const Page = load('src/app/admin/checkin/page.tsx', states, { '@/components/admin/ui': { Modal: () => null, CustomSelect: () => null } }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal(html.includes('aria-label="ปฏิเสธทั้งการจอง #9"'), !started);
  }
});

test('rejected room and boat cards preserve reasons without offering payment again', () => {
  for (const type of ['room', 'kayak']) {
    const b = { id: 9, room_name: 'TEST', kayak_name: 'TEST', status: 'rejected', reject_reason: 'เหตุผลทดสอบ', payment_status: 'paid', created_at: '2026-10-17', check_in: '2026-11-01', check_out: '2026-11-02', booking_date: '2026-11-01', total_price: 100 };
    const Page = load('src/components/dashboard/MyBookingsPanel.tsx', ['all', type === 'room' ? [b] : [], type === 'kayak' ? [b] : [], 3, false, false, new Set([`${type}-9`]), new Map()], { '@/components/booking/BoatAddonSection': () => null, '@/components/booking/RoomBoatTicketSummary': () => null }).default;
    const html = renderToStaticMarkup(React.createElement(Page, { ready: true }));
    assert(html.includes('ถูกปฏิเสธ')); assert(html.includes('เหตุผลทดสอบ')); assert(!html.includes('href="/payment'));
  }
});

test('guest age policy matches the booking API and handles missing settings', () => {
  const { parseGuestAgePolicy } = load('src/hooks/useInfantAgePolicy.ts');
  for (const value of [null, undefined, '']) assert.equal(parseGuestAgePolicy(null, value).infantAge, 6);
  assert.equal(parseGuestAgePolicy(null, 0).infantAge, 0);
  const policy = parseGuestAgePolicy('เด็ก 0-5 ปี: เข้าพักฟรี\nเด็ก 6-17 ปี: เตียงเสริม 500 บาท/คืน\n18 ปีขึ้นไป: คิดราคาผู้ใหญ่', 6);
  assert.equal(policy.childMaxAge, 11);
  assert.equal(policy.adultMinAge, 12);
});

test('guest capacity reads the same main settings row as backend', () => {
  const { guestPolicyFromResortRows } = load('src/hooks/useInfantAgePolicy.ts');
  const policy = guestPolicyFromResortRows([{ id: 3, infant_max_age_exclusive: 6 }, { id: 4, infant_max_age_exclusive: 0, kids_policy: 'เด็ก 6-11 ปี: เตียงเสริม 500 บาท/คืน' }]);
  assert.equal(policy.infantAge, 6);
  assert.equal(policy.childChargePricePerNight, 500);
});

test('free-child policy text never creates an automatic extra charge', () => {
  const { parseGuestAgePolicy } = load('src/hooks/useInfantAgePolicy.ts');
  const policy = parseGuestAgePolicy('เด็ก 6-11 ปี: เข้าพักฟรี ใช้เตียงเสริมฟรี', 6);
  assert.equal(policy.childChargeMinAge, null);
  assert.equal(policy.childChargePricePerNight, null);
});

function childBedCheckoutMarkup() {
  const { parseGuestAgePolicy } = load('src/hooks/useInfantAgePolicy.ts');
  const policy = parseGuestAgePolicy('เด็ก 0-5 ปี: เข้าพักฟรี\nเด็ก 6-17 ปี: มีค่าบริการเตียงเสริม 300 บาท/คืน (ชำระหน้าเคาน์เตอร์)\n18 ปีขึ้นไป: คิดราคาผู้ใหญ่', 6);
  const cart = { check_in: '2099-01-01', check_out: '2099-01-03', adults: 1, children: 3, child_ages: [0, 6, 11], items: [{ room_id: 1, room_type_id: 1, capacity: 4, quantity: 1, room_name: 'TEST Room', price_per_night: 1000 }] };
  const Page = load('src/app/booking/details/page.tsx', [], {
    '@/lib/room-cart-store': { useRoomCart: () => cart },
    '@/hooks/useInfantAgePolicy': { useGuestAgePolicy: () => policy },
    '@/components/promotions/PromoNotice': { PromoNotice: () => null, usePromoNotice: () => ({ notice: null, showNotice() {} }) },
  }).default;
  return renderToStaticMarkup(React.createElement(Page));
}

test('checkout does not charge children for beds they have not selected', () => {
  const html = childBedCheckoutMarkup();
  assert(!html.includes('ชำระเพิ่มเติม ณ วันเข้าพัก'), 'Unselected child beds must not create an onsite charge');
});

test('checkout offers separate beds for ages 6 and 11 but not a baby', () => {
  const html = childBedCheckoutMarkup();
  assert(html.includes('เตียงเสริมสำหรับเด็กคนที่ 2'));
  assert(html.includes('เตียงเสริมสำหรับเด็กคนที่ 3'));
  assert(!html.includes('เตียงเสริมสำหรับเด็กคนที่ 1'));
});

test('child bed selection counts only eligible selected children and expires when their age changes', () => {
  const { selectedChildExtraBeds } = load('src/lib/booking-checkout.ts');
  assert.equal(typeof selectedChildExtraBeds, 'function');
  const ages = [0, 5, 6, 11, 12, 17];
  assert.deepEqual(selectedChildExtraBeds(ages, {}, 6, 11), []);
  assert.deepEqual(selectedChildExtraBeds(ages, { 0: 0, 1: 5, 2: 6, 3: 11, 4: 12, 5: 17 }, 6, 11), [{ index: 2, age: 6 }, { index: 3, age: 11 }]);
  assert.deepEqual(selectedChildExtraBeds([5, 11], { 0: 6, 1: 6 }, 6, 11), []);
});

test('customer policy copy uses the booking adult boundary and optional child beds', () => {
  const { parseGuestAgePolicy } = load('src/hooks/useInfantAgePolicy.ts');
  const policy = parseGuestAgePolicy('เด็ก 6-17 ปี: เตียงเสริม 300 บาท/คืน\n18 ปีขึ้นไป: คิดราคาผู้ใหญ่', 6);
  assert.equal(policy.childChargePolicyTitle, 'เด็ก 6–11 ปี');
  assert.match(policy.bookingPolicyText, /12 ปีขึ้นไป/);
  assert.match(policy.bookingPolicyText, /เฉพาะ.*เลือก/);
  assert(!policy.bookingPolicyText.includes('18 ปีขึ้นไป'));
});

test('cancelled bookings never display payment instructions despite stale payment status or an old slip', () => {
  for (const kind of ['room', 'kayak']) {
    for (const hasSlip of [false, true]) {
      const payment = { id: `${kind}_58`, booking_type: kind, booking_id: 58, amount: 15, status: hasSlip ? 'paid' : 'pending', booking_status: 'cancelled', qr_code_url: 'QR_TEST' };
      const Page = load('src/app/payment/page.tsx', [payment, null, false, null, '', false, hasSlip, 'cancelled', null, false, false, 1, '']).default;
      const html = renderToStaticMarkup(React.createElement(Page));
      assert(html.includes('การจองถูกยกเลิกแล้ว'));
      assert(html.includes('/dashboard'));
      assert(!html.includes('QR_TEST'));
      assert(!html.includes('ยืนยันการชำระเงิน'));
      assert(!html.includes('ส่งสลิปสำเร็จแล้ว'));
    }
  }
});

test('a pending standalone booking still offers its QR and slip step', () => {
  const payment = { id: 'kayak_58', booking_type: 'kayak', booking_id: 58, amount: 15, status: 'pending', booking_status: 'pending', qr_code_url: 'QR_TEST' };
  const Page = load('src/app/payment/page.tsx', [payment, null, false, null, '', false, false, 'pending', null, false, false, 1, '']).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(html.includes('QR_TEST'));
  assert(html.includes('ถัดไป'));
  assert(!html.includes('การจองถูกยกเลิกแล้ว'));
});

test('coupon booking links prefill the shared promotion field using promo_code', () => {
  const Component = load('src/components/booking/PromoCodeFields.tsx', [], {
    'next/navigation': { useSearchParams: () => new URLSearchParams('promo_code=TESTBOAT'), useRouter: () => ({}) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { basePrice: 20, nights: null, scope: 'kayak', onChange() {} }));
  assert.match(html, /value="TESTBOAT"/);
});

test('kayak booking submits without discount codes and preserves room rights', async () => {
  const source = fs.readFileSync(path.join(root, 'src/app/kayaks/page.tsx'), 'utf8');
  const start = source.indexOf('  const handleBooking =');
  const end = source.indexOf('\n  };', start);
  assert(end > start, 'Booking handler must be present');
  const handler = source.slice(start, end + '\n  };'.length);
  const js = ts.transpileModule(`${handler}\nreturn handleBooking;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let payload;
  const handle = new Function('selectedDate', 'selectedSlot', 'today', 'pastCutoffToday', 'boatHours', 'isBoatSlotBookable', 'cartLines', 'slotFitsCart', 'setBookingLoading', 'api', 'toast', 'router', 'roomBookingId', 'normalizeSlotTime', 'promotionIds', js)('2099-01-02', { start_time: '15:00', end_time: '15:30' }, '2099-01-01', false, [], () => true, [{ boat_type_id: 1, num_passengers: 1, boat_count: 1, free_tickets_used: 0 }], () => true, () => {}, { post: async (_path, body) => { payload = body; return { data: { data: { boat_booking_id: 1 } } }; } }, { success() {}, error() {} }, { push() {} }, null, value => value, [32]);
  await handle({ preventDefault() {} });
  assert.equal(payload.promotion_ids, undefined);
  assert.equal(payload.items[0].free_tickets_used, 0);
});

test('kayak checkout removes discount entry and keeps room rights', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/kayaks/page.tsx'), 'utf8');
  assert.doesNotMatch(source, /<PromoCodeFields/);
  assert.match(source, /<RoomBoatRightsChoice/);
  assert.match(source, /totalPrice.toLocaleString/);
});

test('admin edits apply to rooms and preserve wallet and stacking settings', async () => {
  const source = fs.readFileSync(path.join(root, 'src/app/admin/promotions/page.tsx'), 'utf8');
  const extract = name => {
    const start = source.indexOf(`  const ${name} =`);
    const end = source.indexOf('\n  };', start);
    assert(start >= 0 && end > start);
    return ts.transpileModule(`${source.slice(start, end + 5)}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  };
  let form;
  const edit = new Function('setEditingId', 'setPromoTab', 'setHasBoatAddon', 'setForm', 'setShowModal', 'formatDateForInput', 'parseAppliesTo', extract('openEdit'))(
    () => {}, () => {}, () => {}, value => { form = value; }, () => {}, value => value || '', value => value || 'both',
  );
  edit({ id: 32, code: 'TESTBOTH', applies_to: 'both', discount_type: 'fixed', discount_value: 10, is_collectible: false, stackable: true });
  assert.equal(form.applies_to, 'room');
  assert.equal(form.is_collectible, false);
  assert.equal(form.stackable, true);
  let payload;
  const submit = new Function('setSaving', 'promoTab', 'form', 'hasBoatAddon', 'editingId', 'api', 'notify', 'setShowModal', 'fetchPromotions', 'getApiErrorMessage', 'parseAppliesTo', extract('handleSubmit'))(
    () => {}, 'room', form, false, 32, { put: async (_url, body) => { payload = body; } }, { success() {}, error(message) { assert.fail(message); } }, () => {}, () => {}, () => 'Unexpected save error', value => value || 'both',
  );
  await submit({ preventDefault() {} });
  assert.equal(payload.applies_to, 'room');
  assert.equal(payload.is_collectible, false);
  assert.equal(payload.stackable, true);
});

test('room promotion eligibility requires a known allowed type and rejects excluded types', () => {
  const { eligibleRoomPromotion } = load('src/lib/booking-checkout.ts');
  const promo = { id: 1, discount_type: 'fixed', discount_value: 10, room_type_ids: [1, 2], room_type_id: 3 };
  assert.equal(eligibleRoomPromotion(promo, 3000, 1, 1, 1), true);
  assert.equal(eligibleRoomPromotion(promo, 3000, 1, 2, 1), true);
  assert.equal(eligibleRoomPromotion(promo, 3000, 1, 3, 1), false);
  assert.equal(eligibleRoomPromotion(promo, 3000, 1, undefined, 1), false);
});

test('unchecking a room type in all-types mode excludes that type and preserves explicit choices', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/admin/promotions/page.tsx'), 'utf8');
  const start = source.indexOf('  const toggleRoomType =');
  const end = source.indexOf('\n  };', start);
  const js = ts.transpileModule(`${source.slice(start, end + 5)}\nreturn toggleRoomType;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const roomTypes = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const toggle = (selected, id) => {
    let result = selected;
    new Function('selectedIds', 'roomTypes', 'onChange', js)(selected, roomTypes, ids => { result = ids; })(id);
    return result;
  };
  assert.deepEqual(toggle([], 1), [2, 3]);
  assert.deepEqual(toggle([1, 2], 3), [1, 2, 3]);
  assert.deepEqual(toggle([1], 1), [1], 'removing the last explicit choice must not silently allow every type');
});

test('checkin search finds every room in a booking by plain and hash-prefixed booking number', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/admin/checkin/page.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const matchesSearch ='), source.indexOf('  const sortItems ='));
  const js = ts.transpileModule(`${handler}\nreturn matchesSearch;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const lines = ['W2', 'W10'].map(room_number => ({ room_booking_id: 112, user_name: 'TEST Chapter44', room_number, room_name: 'Standard' }));
  for (const search of ['112', '#112', ' TEST ', 'w2', 'not-a-booking']) {
    const match = new Function('search', js)(search);
    assert.equal(lines.filter(match).length, search === 'w2' ? 1 : search === 'not-a-booking' ? 0 : 2, search);
  }
});

test('calendar event retains all physical rooms, group total and guests returned by the booking API', () => {
  const booking = { id: 112, status: 'approved', check_in: '2026-10-09', check_out: '2026-10-10', guests: 4, adults: 3, children: 1, total_price: '9000', rooms: [{ room_number: 'W2', room_name: 'Standard' }, { room_number: 'W10', room_name: 'Deluxe' }] };
  const days = require('./calendar-fixture.cjs')([booking]);
  const events = days['2026-10-09'].checkins;
  assert.equal(events.length, 1);
  assert.equal(events[0].guestCount, 4);
  assert.equal(events[0].raw.total_price, '9000');
  assert.match(events[0].roomTitle, /Standard \(ห้อง W2\).*Deluxe \(ห้อง W10\)/);
  assert.equal(days['2026-10-10'].checkouts.length, 1);
});

test('cart capacity uses the configured free-child boundary and counts missing ages conservatively', () => {
  const { cartOccupyingGuestTotal } = load('src/lib/room-cart.ts');
  const state = { adults: 2, children: 2, child_ages: [2, 6], items: [] };
  assert.equal(cartOccupyingGuestTotal(state, 6), 3);
  assert.equal(cartOccupyingGuestTotal(state, 2), 4);
  assert.equal(cartOccupyingGuestTotal({ ...state, child_ages: [2] }, 6), 3);
  assert.equal(cartOccupyingGuestTotal(state, 0), 4);
});

test('family occupancy allows one extra age-6-to-11 child per room and preserves adult limits', () => {
  const { roomOccupancy, minimumRoomsForGuests } = load('src/lib/room-cart.ts');
  assert.equal(typeof roomOccupancy, 'function');
  const guests = { adults: 2, children: 1, childAges: [6], infantAge: 6 };
  assert.equal(roomOccupancy({ ...guests, capacity: 2, roomCount: 1 }).fits, true);
  assert.equal(roomOccupancy({ ...guests, childAges: [11], capacity: 2, roomCount: 1 }).fits, true);
  assert.equal(roomOccupancy({ ...guests, children: 2, childAges: [6, 11], capacity: 2, roomCount: 1 }).missingCapacity, 1);
  assert.equal(roomOccupancy({ ...guests, adults: 3, capacity: 2, roomCount: 1 }).fits, false);
  assert.equal(roomOccupancy({ ...guests, childAges: [12], capacity: 2, roomCount: 1 }).fits, false);
  assert.equal(roomOccupancy({ ...guests, childAges: [], capacity: 2, roomCount: 1 }).fits, false);
  assert.equal(roomOccupancy({ ...guests, childAges: [0], capacity: 2, roomCount: 1 }).fits, true);
  assert.equal(roomOccupancy({ ...guests, adults: 4, children: 2, childAges: [6, 11], capacity: 4, roomCount: 2 }).fits, true);
  assert.equal(minimumRoomsForGuests(guests, 2), 1);
  assert.equal(minimumRoomsForGuests({ ...guests, adults: 3 }, 2), 2);
  assert.equal(minimumRoomsForGuests({ ...guests, children: 2, childAges: [6, 11] }, 2), 2);
});

test('room summary lets two adults and one child reach the optional-bed checkout', () => {
  const cart = { check_in: '2099-01-01', check_out: '2099-01-03', adults: 2, children: 1, child_ages: [6], items: [{ room_id: 1, room_type_id: 1, capacity: 2, quantity: 1, room_name: 'TEST Room', price_per_night: 1000 }] };
  const Page = load('src/components/booking/BookingSummaryCard.tsx', [], {
    '@/lib/room-cart-store': { useRoomCart: () => cart },
    '@/hooks/useCartSync': { useCartSync: () => ({ commit() {}, clearAll() {} }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(!html.includes('ห้องพักไม่เพียงพอ'));
  const bookingButton = html.match(/<button[^>]*>จองรายการนี้<\/button>/)?.[0];
  assert(bookingButton);
  assert(!/\sdisabled(?:=|\s|>)/.test(bookingButton));
});

test('slip selection rejects missing, unsupported and oversized files and accepts the size boundary', () => {
  const { validateSlipFile } = load('src/lib/payment-slip.ts');
  assert.match(validateSlipFile(undefined), /เลือก/);
  assert.match(validateSlipFile({ name: 'slip.pdf', type: 'application/pdf', size: 1 }), /รูปภาพ/);
  assert.match(validateSlipFile({ name: 'slip.exe', type: 'image/png', size: 1 }), /รูปภาพ/);
  assert.match(validateSlipFile({ name: 'slip.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }), /5 MB/);
  assert.equal(validateSlipFile({ name: 'slip.JPG', type: 'image/jpeg', size: 5 * 1024 * 1024 }), null);
});

test('landing contact resolves the main settings row and does not invent coordinates or hours', () => {
  const { getResortLocation } = load('src/lib/resort-info.ts');
  const actual = getResortLocation([{ id: 4, phone: 'TEST-ROOM' }, { id: 3, phone: 'TEST-MAIN', coordinates: '16, 103', operating_days: 'วันทดสอบ', operating_hours: '09:00–16:00' }]);
  assert.equal(actual.phone, 'TEST-MAIN');
  assert.equal(actual.hours, 'วันทดสอบ 09:00–16:00');
  assert(actual.mapSrc.includes('16%2C103'));
  assert.deepEqual(getResortLocation([]), { address: undefined, phone: undefined, hours: undefined, mapSrc: undefined });
});

test('room rights choice rejects exhausted, expired, ended and already-paid priced grants', () => {
  const { canReserveRoomRights } = load('src/components/booking/RoomBoatRightsChoice.tsx');
  const booking = { id: 9, status: 'approved', boat_ticket_summary: { total_tickets: 2, remaining_tickets: 2, bookable_tickets: 2, free_tickets: 2, paid_tickets: 0, valid_from: '2099-11-02', valid_to: '2099-11-03' } };
  assert.equal(canReserveRoomRights(booking), true);
  for (const status of ['checked_out', 'cancelled', 'rejected']) assert.equal(canReserveRoomRights({ ...booking, status }), false);
  for (const patch of [{ remaining_tickets: 0 }, { bookable_tickets: 0 }, { valid_from: null }, { valid_to: '2020-01-01' }, { free_tickets: 0, paid_tickets: 2 }]) {
    assert.equal(canReserveRoomRights({ ...booking, boat_ticket_summary: { ...booking.boat_ticket_summary, ...patch } }), false);
  }
  assert.equal(canReserveRoomRights({ ...booking, status: 'pending', boat_ticket_summary: { ...booking.boat_ticket_summary, free_tickets: 0, paid_tickets: 2 } }), true);
});

test('checked room rights renders physical room redemption and retains the parent booking', () => {
  const summary = { total_tickets: 2, used_tickets: 0, remaining_tickets: 2, bookable_tickets: 2, free_tickets: 2, paid_tickets: 0, valid_from: '2099-11-02', valid_to: '2099-11-03' };
  const booking = { id: 9, status: 'approved', check_in_date: '2099-11-01T00:00:00.000Z', check_out_date: '2099-11-04T00:00:00.000Z', boat_ticket_summary: summary };
  const detail = { ...booking, rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1' }, { booking_room_id: 52, room_name: 'Standard', room_number: 'A2', status: 'checked_out' }] };
  const Component = load('src/components/booking/RoomBoatRightsChoice.tsx', [[booking], false, null, 9, detail, false, null], { './BoatAddonSection': props => React.createElement('div', { 'data-room': props.bookingRoomId, 'data-bookable': props.allowBooking }) }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { memberId: 7, enabled: true, onChange() {} }));
  assert.match(html, /type="checkbox"[^>]*checked/);
  assert(html.includes('การจองห้อง #9'));
  assert(html.includes('data-room="51" data-bookable="true"'));
  assert(!html.includes('data-room="52"'));
  assert(html.includes('คงเหลือ 2 สิทธิ์'));
  assert(!html.includes('NaN'));
  assert(!html.includes('ไม่ระบุวันที่'));
  assert(html.includes('กลับไปจองเรือแบบชำระแยก'));
});

test('missing rights dates explain the blocker once without repeating five room panels', () => {
  const summary = { total_tickets: 5, used_tickets: 0, remaining_tickets: 5, bookable_tickets: 5, free_tickets: 5, paid_tickets: 0, valid_from: null, valid_to: null };
  const booking = { id: 102, status: 'approved', check_in_date: '2099-11-01', check_out_date: '2099-11-02', boat_ticket_summary: summary };
  const detail = { ...booking, rooms: Array.from({ length: 5 }, (_, i) => ({ booking_room_id: i + 1, room_name: 'Standard', room_number: `W${i + 2}` })) };
  const Component = load('src/components/booking/RoomBoatRightsChoice.tsx', [[booking], false, null, 102, detail, false, null], { './BoatAddonSection': () => React.createElement('div', { 'data-room-panel': true }) }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { memberId: 7, enabled: true, onChange() {} }));
  assert(html.includes('การจองนี้ยังเลือกวันและรอบเรือไม่ได้'));
  assert(html.includes('href="/dashboard?tab=bookings"'));
  assert(!html.includes('data-room-panel'));
  assert.equal(html.split('ไม่พบช่วงวันที่ใช้สิทธิ์').length - 1, 1);
});

test('room promotions explain every unmet condition instead of disappearing', () => {
  const { roomPromotionReasons, eligibleRoomPromotion } = load('src/lib/booking-checkout.ts');
  const promo = { id: 6, code: 'MIDYEAR500', name: '500', discount_type: 'fixed', discount_value: 500, min_nights: 2, room_count: 10, min_price: 200, room_type_id: 7 };
  assert.deepEqual(roomPromotionReasons(promo, 3000, 1, 7, 1), ['ต้องพักอย่างน้อย 2 คืน', 'ต้องจองอย่างน้อย 10 ห้อง']);
  assert.equal(eligibleRoomPromotion(promo, 60000, 2, 7, 10), true);
  const coupon = { ...promo, min_nights: null, room_count: 5, is_collectible: true };
  assert.deepEqual(roomPromotionReasons(coupon, 3000, 1, 7, 1), ['ต้องจองอย่างน้อย 5 ห้อง', 'ต้องเก็บคูปองที่หน้าโปรโมชั่นก่อน']);
  assert.equal(eligibleRoomPromotion({ ...coupon, wallet_status: 'saved' }, 30000, 2, 7, 5), true);
});

test('boat rights describe the benefit and paid price without a zero discount', () => {
  const { roomPromotionLabel } = load('src/lib/booking-checkout.ts');
  const promo = { discount_type: 'fixed', discount_value: 0, boat_ticket_count: 2 };
  assert.equal(roomPromotionLabel(promo), 'เรือฟรี 2 สิทธิ์/ห้อง');
  assert.equal(roomPromotionLabel({ ...promo, boat_addon_mode: 'paid', boat_addon_price: '200.00' }), 'สิทธิ์จองเรือ 2 สิทธิ์/ห้อง ฿200/สิทธิ์');
});
function bookingsMarkup(rooms, kayaks) {
  const Component = load('src/components/dashboard/MyBookingsPanel.tsx', ['all', rooms, kayaks, 3, false, false, new Set(), new Map()]).default;
  return renderToStaticMarkup(React.createElement(Component, { ready: true }));
}

function expandedReviewMarkup(status, lines, reviewedTypes = []) {
  const room = { room_booking_id: 91, status, created_at: '2026-10-01', check_in: '2026-10-01', check_out: '2026-10-02', total_price: 1200, rooms: lines };
  const Component = load('src/components/dashboard/MyBookingsPanel.tsx', ['all', [room], [], 3, false, false, new Set(['room-91']), new Map([[91, new Set(reviewedTypes)]])], {
    '@/components/booking/BoatAddonSection': () => null,
  }).default;
  return renderToStaticMarkup(React.createElement(Component, { ready: true }));
}

test('approved and checked-out room cards link to the dashboard reviews tab', () => {
  for (const status of ['approved', 'checked_out']) {
    const html = expandedReviewMarkup(status, [{ booking_room_id: 1, room_name: 'Standard', room_number: 'TEST1', status: 'checked_out' }]);
    assert(html.includes('href="/dashboard?tab=reviews"'));
    assert(!html.includes('href="/reviews"'));
  }
  for (const status of ['pending', 'paid', 'cancelled', 'rejected']) {
    assert(!expandedReviewMarkup(status, []).includes('href="/dashboard?tab=reviews"'));
  }
});

test('cancelled room types do not prevent the already reviewed badge', () => {
  const html = expandedReviewMarkup('checked_out', [
    { booking_room_id: 1, room_name: 'Standard', room_number: 'TEST1', status: 'checked_out' },
    { booking_room_id: 2, room_name: 'Deluxe', room_number: 'TEST2', status: 'cancelled' },
  ], ['Standard']);
  assert(html.includes('รีวิวการพักนี้แล้ว'));
  assert(!html.includes('href="/dashboard?tab=reviews"'));
});

test('old review bookmarks permanently redirect to the dashboard reviews tab', async () => {
  const config = require('../../next.config.js');
  const redirect = (await config.redirects()).find(route => route.source === '/reviews');
  assert.equal(redirect.destination, '/dashboard?tab=reviews');
  assert.equal(redirect.statusCode, 301);
});

test('pending addons have no independent payment or cancellation action', () => {
  const html = bookingsMarkup([], [kayak]);
  assert(!html.includes('/payment?booking_type=kayak'), 'addon must be paid through its room');
  assert(!html.includes('ยกเลิก</button>'), 'addon cancellation belongs to its room');
});

test('standalone pending kayak retains its payment action', () => {
  assert(bookingsMarkup([], [{ ...kayak, is_addon: false }]).includes('/payment?booking_type=kayak'));
});

test('room entitlement CTA goes to room-addon booking rather than ordinary kayak checkout', () => {
  const html = bookingsMarkup([{ id: 9, status: 'approved', created_at: new Date().toISOString(), check_in_date: '2026-11-01', check_out_date: '2026-11-03', has_unused_boat_tickets: true, rooms: [{ booking_room_id: 51 }] }], []);
  assert(html.includes('/kayaks/room-addon?room_booking_id=9'), 'must choose a physical booking room entitlement');
});

test('deselecting a persisted room preserves the other rooms dates and guests', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/rooms/[id]/page.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const handleToggleRoom ='), source.indexOf('\n  if (loading) return', source.indexOf('  const handleToggleRoom =')));
  const old = { check_in: '2026-11-01', check_out: '2026-11-03', adults: 2, children: 1, child_ages: [7], items: [{ room_id: 51 }, { room_id: 52 }] };
  let saved;
  const js = ts.transpileModule(`${handler}\nreturn handleToggleRoom;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const toggle = new Function('room', 'cart', 'selectedRoomIds', 'range', 'toast', 'commitCart', 'setRoomCart', js)({ rooms: [{ room_id: 51 }] }, old, [51], { start: '2026-10-07', end: '2026-10-08' }, {}, items => { saved = { check_in: '2026-10-07', check_out: '2026-10-08', adults: 1, children: 0, child_ages: [], items }; }, next => { saved = next; });
  toggle(51);
  assert.deepEqual(saved, { ...old, items: [{ room_id: 52 }] });
});

test('partially used collectible remains eligible when its wallet has uses left', () => {
  const { eligibleRoomPromotion } = load('src/lib/booking-checkout.ts');
  const promo = { id: 7, discount_type: 'percent', discount_value: 10, is_collectible: true, wallet_status: 'used', wallet_remaining: 1 };
  assert.equal(eligibleRoomPromotion(promo, 1000, 2), true);
  assert.equal(eligibleRoomPromotion({ ...promo, wallet_remaining: 0 }, 1000, 2), false);
  assert.equal(eligibleRoomPromotion({ ...promo, wallet_status: 'expired' }, 1000, 2), false);
});

test('catalog offers booking for a partially used collectible', () => {
  const { PromoCollectAction } = load('src/components/promotions/PromoVoucher.tsx');
  const html = renderToStaticMarkup(React.createElement(PromoCollectAction, { code: 'ROOM10', status: 'used', remaining: 1, isCollectible: true, isCustomer: true, isAuthenticated: true, appliesTo: 'room', onCollect() {}, onLogin() {} }));
  assert(html.includes('/rooms?promo_code=ROOM10'));
});

test('customer wallet view keeps partially used coupons in the ready-to-use list', () => {
  const coupon = { promotion_id: 7, code: 'ROOM10', name: 'Reusable', description: null, discount_type: 'percent', discount_value: 10, status: 'used', remaining: 1, applies_to: 'room' };
  const Component = load('src/components/dashboard/MyPromotionsSection.tsx', [[coupon], false, 'saved', null, 0]).default;
  const html = renderToStaticMarkup(React.createElement(Component));
  assert(html.includes('/rooms?promo_code=ROOM10'));
});

test('room-addon requests redeem the physical room entitlement', async () => {
  const file = 'src/lib/room-boat-addon.ts';
  assert(fs.existsSync(path.join(root, file)), 'room-addon booking request helper is required');
  const requests = [];
  const addon = load(file, [], { '@/lib/api': { post: async (url, body) => { requests.push({ url, body }); return { data: {} }; } } });
  await addon.createRoomBoatAddon(51, { boat_type_id: 2, boat_round_id: 3, booking_date: '2026-11-02', num_passengers: 2 });
  assert.deepEqual(requests, [{ url: '/kayaks/room-addon/51', body: { boat_type_id: 2, boat_round_id: 3, booking_date: '2026-11-02', num_passengers: 2 } }]);
});

test('room-addon creation respects ticket dates, balance and paid room restrictions', () => {
  const { canBookRoomBoatAddon } = load('src/lib/room-boat-addon.ts');
  assert.equal(typeof canBookRoomBoatAddon, 'function', 'entitlement eligibility must gate the booking form');
  const info = { room_status: 'approved', balance: 1, mode: 'free', unit_price: 0, valid_from: '2026-11-02', valid_to: '2026-11-02' };
  assert.equal(canBookRoomBoatAddon(info, '2026-10-06'), true);
  assert.equal(canBookRoomBoatAddon({ ...info, balance: 0 }, '2026-10-06'), false);
  assert.equal(canBookRoomBoatAddon({ ...info, valid_from: null, valid_to: null }, '2026-10-06'), false);
  assert.equal(canBookRoomBoatAddon(info, '2026-11-03'), false);
  assert.equal(canBookRoomBoatAddon({ ...info, mode: 'paid' }, '2026-10-06'), false);
  assert.equal(canBookRoomBoatAddon({ ...info, mode: 'paid', room_status: 'pending' }, '2026-10-06'), true);
});

test('customer room-addon page renders each physical room entitlement separately', () => {
  const file = 'src/app/kayaks/room-addon/page.tsx';
  assert(fs.existsSync(path.join(root, file)), 'the perk destination must exist');
  const { default: Page } = load(file, [{ status: 'approved', rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1' }, { booking_room_id: 52, room_name: 'Deluxe', room_number: 'A2' }] }, false, null], {
    'next/navigation': { useSearchParams: () => new URLSearchParams('room_booking_id=9') },
    '@/components/booking/BoatAddonSection': props => React.createElement('div', { 'data-room': props.bookingRoomId }, 'Room entitlement'),
  });
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(html.includes('data-room="51"'));
  assert(html.includes('data-room="52"'));
  assert(!html.includes('/payment?booking_type=kayak'));
});

test('room entitlement booking form offers only its allowed date range', () => {
  const file = 'src/components/booking/RoomBoatAddonForm.tsx';
  assert(fs.existsSync(path.join(root, file)), 'room entitlement booking controls must exist');
  const Form = load(file).default;
  const html = renderToStaticMarkup(React.createElement(Form, { bookingRoomId: 51, info: { room_status: 'pending', balance: 2, mode: 'free', unit_price: 0, valid_from: '2099-11-02', valid_to: '2099-11-04' }, onCreated() {} }));
  assert(html.includes('min="2099-11-02"'));
  assert(html.includes('max="2099-11-04"'));
  assert(html.includes('จองรอบเรือด้วยสิทธิ์นี้'));
});

test('generic promotion preview supplies the actual room types', async () => {
  const source = fs.readFileSync(path.join(root, 'src/components/booking/PromoCodeFields.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const validateRequest ='), source.indexOf('  const applyByCode ='));
  const requests = [];
  const js = ts.transpileModule(`${handler}\nreturn validateRequest;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const validate = new Function('api', 'scope', 'roomTypeIds', js)({ post: async (url, body) => { requests.push(body); return { data: { data: {} } }; } }, 'room', [2, 3]);
  await validate({ code: 'ROOM10', price: 1000 });
  assert.deepEqual(requests[0].room_type_ids, [2, 3]);
});

test('legacy cart promotion preview validates against every room type in the cart', async () => {
  const source = fs.readFileSync(path.join(root, 'src/components/booking/RoomCartPanel.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const handleApplyPromo ='), source.indexOf('  const updateGuests ='));
  const requests = [];
  const js = ts.transpileModule(`${handler}\nreturn handleApplyPromo;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const validate = new Function('api', 'promoCode', 'baseTotal', 'nights', 'cart', 'roomTypeIds', 'setPromoLoading', 'setAppliedPromo', 'toast', 'getApiErrorMessage', js)({ post: async (url, body) => { requests.push(body); return { data: { data: {} } }; } }, 'ROOM10', 1000, 2, { items: [{ room_type_id: 2 }, { room_type_id: 3 }] }, [2, 3], () => {}, () => {}, {}, () => '');
  await validate();
  assert.equal(requests[0].scope, 'room');
  assert.deepEqual(requests[0].room_type_ids, [2, 3]);
});

test('boat time policy handles Bangkok time and advance windows longer than one day', () => {
  const file = 'src/lib/boat-time-policy.ts';
  assert(fs.existsSync(path.join(root, file)), 'boat slots need a shared time filter');
  const { isBoatSlotBookable } = load(file);
  const now = new Date('2026-10-06T12:00:00+07:00').getTime();
  const hours = { is_open: true, open_time: '08:00', close_time: '18:00' };
  assert.equal(isBoatSlotBookable('2026-10-07', '10:00', '11:00', hours, 1440, now), false);
  assert.equal(isBoatSlotBookable('2026-10-07', '12:00', '13:00', hours, 1440, now), true);
  assert.equal(isBoatSlotBookable('2026-10-06', '11:00', '12:00', hours, 0, now), false);
  assert.equal(isBoatSlotBookable('2026-10-07', '10:00', '11:00', { ...hours, is_open: false }, 60, now), false);
  assert.equal(isBoatSlotBookable('2026-10-07', '17:00', '19:00', hours, 60, now), false);
});

test('room-addon form submits its room entitlement and rechecks elapsed slots at click time', async () => {
  const source = fs.readFileSync(path.join(root, 'src/components/booking/RoomBoatAddonForm.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const handleSubmit ='), source.indexOf('\n  return (', source.indexOf('  const handleSubmit =')));
  const js = ts.transpileModule(`${handler}\nreturn handleSubmit;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const bookable of [true, false]) {
    const requests = [];
    const args = ['selectedBoat', 'availableRound', 'boatCount', 'info', 'date', 'firstDate', 'setSubmitting', 'createRoomBoatAddon', 'bookingRoomId', 'boatId', 'roundId', 'passengers', 'toast', 'setRoundId', 'onCreated', 'getApiErrorMessage', 'selectedRound', 'selectedDayHours', 'advanceMinutes', 'isBoatSlotBookable'];
    const submit = new Function(...args, js)({ id: 2 }, true, 1, { balance: 2, valid_to: '2026-11-04' }, '2026-11-02', '2026-11-02', () => {}, async (id, body) => requests.push({ id, body }), 51, '2', '3', 2, { success() {}, error() {} }, () => {}, async () => {}, () => '', { start_time: '10:00', end_time: '11:00' }, undefined, 60, () => bookable);
    await submit({ preventDefault() {} });
    assert.deepEqual(requests, bookable ? [{ id: 51, body: { boat_type_id: 2, boat_round_id: 3, booking_date: '2026-11-02', num_passengers: 2 } }] : []);
  }
});

test('room-addon page excludes ended physical rooms while the other rooms stay active', () => {
  const { default: Page } = load('src/app/kayaks/room-addon/page.tsx', [{ status: 'approved', rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1', status: 'checked_in' }, { booking_room_id: 52, room_name: 'Deluxe', room_number: 'A2', status: 'checked_out' }] }, false, null], {
    'next/navigation': { useSearchParams: () => new URLSearchParams('room_booking_id=9') },
    '@/components/booking/BoatAddonSection': props => React.createElement('div', { 'data-room': props.bookingRoomId }),
  });
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(html.includes('data-room="51"'));
  assert(!html.includes('data-room="52"'));
  const { canBookRoomBoatAddon } = load('src/lib/room-boat-addon.ts');
  assert.equal(canBookRoomBoatAddon({ room_status: 'approved', room_line_status: 'checked_out', balance: 1, mode: 'free', valid_from: '2026-11-02', valid_to: '2026-11-03' }, '2026-11-02'), false);
});
