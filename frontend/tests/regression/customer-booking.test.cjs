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
  const booking = { id: 9, status: 'approved', check_in_date: '2099-11-01', check_out_date: '2099-11-04', boat_ticket_summary: summary };
  const detail = { ...booking, rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1' }, { booking_room_id: 52, room_name: 'Standard', room_number: 'A2', status: 'checked_out' }] };
  const Component = load('src/components/booking/RoomBoatRightsChoice.tsx', [[booking], false, null, 9, detail, false, null], { './BoatAddonSection': props => React.createElement('div', { 'data-room': props.bookingRoomId, 'data-bookable': props.allowBooking }) }).default;
  const html = renderToStaticMarkup(React.createElement(Component, { memberId: 7, enabled: true, onChange() {} }));
  assert.match(html, /type="checkbox"[^>]*checked/);
  assert(html.includes('การจองห้อง #9'));
  assert(html.includes('data-room="51" data-bookable="true"'));
  assert(!html.includes('data-room="52"'));
  assert(html.includes('คงเหลือ 2 สิทธิ์'));
  assert(html.includes('กลับไปจองเรือแบบชำระแยก'));
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

test('both customer wallet views keep partially used coupons in the ready-to-use list', () => {
  const coupon = { promotion_id: 7, code: 'ROOM10', name: 'Reusable', description: null, discount_type: 'percent', discount_value: 10, status: 'used', remaining: 1, applies_to: 'room' };
  for (const file of ['src/components/dashboard/MyPromotionsSection.tsx', 'src/app/dashboard/promotions/page.tsx']) {
    const Component = load(file, [[coupon], false, 'saved', null, 0]).default;
    const html = renderToStaticMarkup(React.createElement(Component));
    assert(html.includes('/rooms?promo_code=ROOM10'), file);
  }
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
