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
  const mocks = {
    react: { ...React, useState: initial => [cursor < states.length ? states[cursor++] : (cursor++, typeof initial === 'function' ? initial() : initial), () => {}], useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn, useRef: value => ({ current: value }) },
    'next/link': ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
    'next/navigation': { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {} }), usePathname: () => '/' },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    'react-hot-toast': { error() {}, success() {}, Toaster: () => null },
    '@/lib/api': { get: async () => ({ data: { data: [] } }), getApiErrorMessage: () => 'Mock error' },
    '@/hooks/useAuthGuard': { useAuthGuard: () => ({ ready: true, user: { role: 'customer' } }) },
    '@/hooks/useAuth': { useAuth: () => ({ user: null }) },
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
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith(path.join('booking', 'details', 'page.tsx'))) source += '\nexport { BookingDetailsContent as TestContent };';
    if (file.endsWith(path.join('admin', 'boats', 'page.tsx'))) source += '\nexport { BoatStaffDashboardContent as TestContent };';
    if (file.endsWith(path.join('admin', 'rooms', 'page.tsx'))) source += '\nexport { RoomStaffDashboardContent as TestContent };';
    if (file.endsWith(path.join('boats', 'checkin', 'page.tsx'))) source += '\nexport { BoatCheckinContent as TestContent };';
    mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }
  return read(path.join(root, relative));
}
const summary = { total_tickets: 3, used_tickets: 1, remaining_tickets: 2, free_tickets: 2, paid_tickets: 1, valid_from: '2099-11-02', valid_to: '2099-11-03' };
const room = { id: 9, status: 'approved', created_at: new Date().toISOString(), check_in_date: '2099-11-01', check_out_date: '2099-11-04', boat_ticket_summary: summary };

test('room rights can select the future 15:00 round with ten boats and adequate rights', () => {
  const info = { room_status: 'paid', room_line_status: 'paid', balance: 5, mode: 'free', unit_price: 0, valid_from: '2099-11-01', valid_to: '2099-11-02' };
  const round = { boat_round_id: 25, start_time: '15:00:00', end_time: '15:30:00', remaining: 10, available: true };
  const hours = Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, is_open: true, open_time: '08:00:00', close_time: '18:00:00', advance_booking_minutes: 60 }));
  const Form = load('src/components/booking/RoomBoatAddonForm.tsx', ['2099-11-01', [{ id: 1, name: 'TEST Boat', capacity: 3 }], '1', 3, [round], '25', false, false, hours]).default;
  const html = renderToStaticMarkup(React.createElement(Form, { bookingRoomId: 115, info, onCreated() {} }));
  assert.match(html, /<option value="25" selected="">/);
  assert(!/<option[^>]*value="25"[^>]*disabled/.test(html));
  assert(!/<button[^>]*type="submit"[^>]* disabled=""/.test(html));
});

test('today uses Bangkok date even for a browser in another timezone', t => {
  const oldTZ = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  t.after(() => { if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ; });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T17:15:00Z').getTime() });
  assert.equal(load('src/lib/date.ts').todayISO(), '2026-10-10');
});

test('frontend boat cutoff includes exact advance boundary and rejects closed days and insufficient time', () => {
  const { isBoatSlotBookable } = load('src/lib/boat-time-policy.ts');
  const hours = { is_open: true, open_time: '08:00:00', close_time: '18:00:00' };
  const now = new Date('2026-10-09T14:00:00+07:00').getTime();
  assert.equal(isBoatSlotBookable('2026-10-09', '15:00:00', '15:30:00', hours, 60, now), true);
  assert.equal(isBoatSlotBookable('2026-10-09', '15:00:00', '15:30:00', hours, 60, now + 1), false);
  assert.equal(isBoatSlotBookable('2026-10-09', '15:00:00', '15:30:00', { ...hours, is_open: false }, 60, now), false);
  assert.equal(isBoatSlotBookable('2026-10-09', '17:30:00', '18:30:00', hours, 60, now), false);
});

test('admin overview identifies normal and room-addon boats by their API booking IDs', () => {
  const Wrapper = ({ children }) => React.createElement('div', null, children);
  const Page = load('src/app/admin/page.tsx', [[], [
    { boat_booking_id: 47, status: 'paid', user_name: 'TEST Normal', total_price: 100 },
    { boat_booking_id: 48, room_booking_id: 102, is_addon: true, status: 'pending', user_name: 'TEST Addon', total_price: 0 },
  ], [], [], [], [], [], false], { '@/components/admin/ui': { PageHeader: Wrapper, StatCard: Wrapper, Panel: Wrapper, StatusBadge: Wrapper, EmptyState: Wrapper, Skeleton: Wrapper }, '@/lib/admin-notify': { notify: {} } }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  for (const id of [47, 48]) {
    assert(html.includes(`#${id}`));
    assert(html.includes(`href="/admin/boats?search=${id}"`));
  }
  assert(html.includes('TEST Normal'));
  assert(!html.includes('#?'));
});

test('room staff can approve zero-charge pending rooms but cannot approve unpaid positive amounts', () => {
  const Wrapper = ({ children }) => React.createElement('div', null, children);
  for (const [amount, slip, status, expected] of [[0, null, 'pending', true], [100, null, 'pending', false], [100, 'slip.png', 'pending', false], [100, 'slip.png', 'paid', true], [0, null, 'cancelled', false]]) {
    const Page = load('src/app/admin/rooms/page.tsx', [[{ id: 7, room_booking_id: 7, status, total_price: amount, payment_slip: slip, rooms: [] }], false, { total: 1, totalPages: 1 }, { all: 1, totalRevenue: 0, pendingRevenue: 0 }, [], ''], {
      '@/components/admin/ui': { PageHeader: Wrapper, StatCard: Wrapper, Panel: Wrapper, Modal: () => null, EmptyState: Wrapper, BookingStatusBadge: Wrapper },
      '@/lib/admin-notify': { notify: {} }, '@/lib/avatar': { resolveMediaUrl: value => value },
    }).TestContent;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal(html.includes('<span>อนุมัติ</span>'), expected, `${status} / ${amount} / ${slip}`);
  }
});

test('room detail and its printable document list every actual room, guests and subtotal', () => {
  const Wrapper = ({ children }) => React.createElement('div', null, children);
  const booking = { id: 7, status: 'approved', guests: 4, adults: 3, children: 1, total_price: 6000, check_in: '2026-10-10', check_out: '2026-10-12', rooms: [
    { booking_room_id: 1, room_number: 'TEST-W2', room_name: 'TEST Standard', subtotal: 2000 },
    { booking_room_id: 2, room_number: 'TEST-D3', room_name: 'TEST Deluxe', subtotal: 4000 },
  ] };
  const Page = load('src/app/admin/rooms/page.tsx', [[], false, { total: 0, totalPages: 0 }, { totalRevenue: 0 }, [], '', { open: false }, { open: true, booking }], {
    '@/components/admin/ui': { PageHeader: Wrapper, StatCard: Wrapper, Panel: Wrapper, Modal: ({ open, children }) => open ? React.createElement('div', null, children) : null, EmptyState: Wrapper, BookingStatusBadge: Wrapper },
    '@/lib/avatar': { resolveMediaUrl: value => value },
  }).TestContent;
  const html = renderToStaticMarkup(React.createElement(Page));
  for (const text of ['TEST-W2', 'TEST-D3', 'TEST Standard', 'TEST Deluxe', '2,000', '4,000', '6,000']) assert(html.includes(text), text);
  assert.match(html, /ผู้เข้าพัก:/);
  assert.match(html, /4(?:<!-- -->)? คน/);
  assert.match(html, /ผู้ใหญ่ (?:<!-- -->)?3/);
  assert.match(html, /เด็ก (?:<!-- -->)?1/);
});

test('staff and admin shared calendar names every actual room in a multi-room booking', () => {
  const Wrapper = ({ children }) => React.createElement('div', null, children);
  const booking = { id: 7, status: 'approved', check_in: '2026-10-10', check_out: '2026-10-12', user_name: 'TEST Guest', rooms: [
    { room_number: 'TEST-W2', room_name: 'TEST Standard' }, { room_number: 'TEST-D3', room_name: 'TEST Deluxe' },
  ] };
  const day = require('./calendar-fixture.cjs')([booking])['2026-10-10'];
  const Page = load('src/app/admin/calendar/page.tsx', [new Date(2026, 9, 10), 'all', [booking], [], false, day, 'checkins'], {
    '@/components/admin/ui': { PageHeader: Wrapper, Panel: Wrapper, Modal: ({ open, children }) => open ? React.createElement('div', null, children) : null }, '@/lib/admin-notify': { notify: {} },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  for (const text of ['TEST-W2', 'TEST-D3', 'TEST Standard', 'TEST Deluxe']) assert(html.includes(text), text);
});
function dashboard(rooms, kayaks = []) {
  const Component = load('src/components/dashboard/MyBookingsPanel.tsx', ['all', rooms, kayaks, 3, false, false, new Set(), new Map()]).default;
  return renderToStaticMarkup(React.createElement(Component, { ready: true }));
}
test('collapsed room booking explains grant, reserved, remaining, free and paid terms', () => {
  const html = dashboard([room]);
  for (const text of ['ได้รับ 3 สิทธิ์', 'จองรอบแล้ว 1 สิทธิ์', 'คงเหลือ 2 สิทธิ์', 'ฟรี 2 สิทธิ์', 'มีค่าใช้จ่าย 1 สิทธิ์', '1 สิทธิ์ = เรือ 1 ลำ 1 รอบ', 'ความจุของประเภทเรือ', 'พ.ย.', '/kayaks/room-addon?room_booking_id=9']) assert(html.includes(text), text);
});
test('exhausted and ended room summaries stay visible without redemption links', () => {
  for (const status of ['approved', 'cancelled', 'rejected', 'checked_out']) {
    const html = dashboard([{ ...room, status, boat_ticket_summary: { ...summary, used_tickets: 3, remaining_tickets: 0 } }]);
    assert(html.includes('ได้รับ 3 สิทธิ์'));
    assert(html.includes('คงเหลือ 0 สิทธิ์'));
    assert(!html.includes('/kayaks/room-addon?room_booking_id=9'));
  }
});
test('missing entitlement dates show a clear error and no CTA', () => {
  const html = dashboard([{ ...room, boat_ticket_summary: { ...summary, valid_from: null, valid_to: null } }]);
  assert(html.includes('ไม่พบช่วงวันที่ใช้สิทธิ์'));
  assert(!html.includes('/kayaks/room-addon?room_booking_id=9'));
});
test('legacy room flag retains room-addon CTA without invented counters', () => {
  const html = dashboard([{ ...room, boat_ticket_summary: undefined, has_unused_boat_tickets: true }]);
  assert(html.includes('/kayaks/room-addon?room_booking_id=9'));
  assert(!html.includes('ได้รับ 3 สิทธิ์'));
});
test('kayak addon names its parent room booking and links to its entitlement page', () => {
  const html = dashboard([], [{ boat_booking_id: 21, room_booking_id: 9, is_addon: true, addon_mode: 'paid', status: 'approved', created_at: new Date().toISOString(), booking_date: '2099-11-02', kayak_name: 'Kayak', total_price: 200 }]);
  assert(html.includes('เรือจากโปรโมชั่นห้องพัก'));
  assert(html.includes('การจองห้องพัก #9'));
  assert(html.includes('/kayaks/room-addon?room_booking_id=9'));
  assert(html.includes('มีค่าใช้จ่าย'));
});
test('initial payment and uploaded-slip confirmation both show entitlement summary', () => {
  for (const done of [false, true]) {
    const payment = { id: 1, booking_id: 9, booking_type: 'room', amount: 1000, booking_status: 'pending' };
    const detail = { boat_ticket_summary: summary, rooms: [], promotions: [] };
    const Page = load('src/app/payment/page.tsx', [payment, detail, false, null, '', false, done, 'pending', null, false, false, 1, ''], { 'next/navigation': { useSearchParams: () => new URLSearchParams('booking_type=room&booking_id=9'), useRouter: () => ({ push() {} }) } }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert(html.includes('ได้รับ 3 สิทธิ์'), `done=${done}`);
    assert(html.includes('มีค่าใช้จ่าย 1 สิทธิ์'));
  }
});
test('physical room entitlement summary remains visible without addon rows or booking form', () => {
  const info = { total_tickets: 2, used_tickets: 2, balance: 0, mode: 'free', unit_price: 0, room_status: 'approved', valid_from: '2099-11-02', valid_to: '2099-11-03' };
  const Section = load('src/components/booking/BoatAddonSection.tsx', [[], false, null, info]).default;
  const html = renderToStaticMarkup(React.createElement(Section, { bookingRoomId: 51, roomBookingStatus: 'approved' }));
  assert(html.includes('ได้รับ 2 สิทธิ์'));
  assert(html.includes('จองรอบแล้ว 2 สิทธิ์'));
  assert(html.includes('คงเหลือ 0 สิทธิ์'));
});
const promo = { id: 7, name: 'Room promo', code: 'ROOM', discount_type: 'fixed', discount_value: 0, boat_ticket_count: 2, boat_addon_mode: 'paid', boat_addon_price: 150 };
const cart = { check_in: '2099-11-01', check_out: '2099-11-02', adults: 2, children: 0, child_ages: [], items: [{ room_id: 51, room_type_id: 2, room_name: 'Room', type_name: 'Standard', room_number: 'A1', price_per_night: 1000, quantity: 1, capacity: 2 }] };
function details(overrides = {}) {
  return load('src/app/booking/details/page.tsx', ['First', 'Last', 'guest@example.test', '0800000000', '14:00', false, false, false, '', [promo], { 2: 7 }, false], { '@/lib/room-cart-store': { useRoomCart: () => cart, setRoomCart() {} }, ...overrides });
}
test('checkout keeps ineligible room offers visible with a disabled option and explanation', () => {
  const offer = { ...promo, name: 'ROOMANDBOAT', min_nights: 2, room_count: 5, is_collectible: true };
  const Component = load('src/app/booking/details/page.tsx', ['First', 'Last', 'guest@example.test', '0800000000', '14:00', false, false, false, '', [offer], {}, null, false, true, true], { '@/lib/room-cart-store': { useRoomCart: () => cart, setRoomCart() {} } }).default;
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.match(html, /<button[^>]*disabled[^>]*>[^]*?ROOMANDBOAT/);
  assert(html.includes('ต้องพักอย่างน้อย 2 คืน'));
  assert(html.includes('ต้องจองอย่างน้อย 5 ห้อง'));
  assert(html.includes('ต้องเก็บคูปองที่หน้าโปรโมชั่นก่อน'));
  assert(html.includes('href="/promotions"'));
  assert(!html.includes('ลด ฿0'));
});
test('room checkout explains priced boat benefit and inclusive stay dates', () => {
  const html = renderToStaticMarkup(React.createElement(details().default));
  assert(html.includes('มีค่าใช้จ่าย'));
  assert(html.includes('150'));
  assert(html.includes('ตามรอบเรือที่เปิดให้จอง'));
  assert(html.includes('รวมวันเช็คอินและวันเช็คเอาต์'));
});
function findClick(element, text) {
  if (!element || typeof element !== 'object') return null;
  if (element.type === 'button' && element.props.onClick && JSON.stringify(element.props.children).includes(text)) return element.props.onClick;
  for (const child of React.Children.toArray(element.props?.children)) { const found = findClick(child, text); if (found) return found; }
  return null;
}
test('real checkout button reports server grant count and navigates to room payment', async () => {
  const toasts = [], routes = [], requests = [];
  const { TestContent } = details({ '@/lib/api': { post: async (url, body) => { requests.push({ url, body }); return { data: { data: { room_booking_id: 9, boat_ticket_summary: { ...summary, total_tickets: 4 } } } }; } }, 'react-hot-toast': { success: message => toasts.push(message), error: message => assert.fail(message) }, 'next/navigation': { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: url => routes.push(url) }) } });
  const click = findClick(TestContent(), 'ชำระเงิน');
  assert.equal(typeof click, 'function');
  await click();
  assert.equal(requests[0].url, '/bookings/room');
  assert.equal(requests[0].body.items[0].promotion_id, 7);
  assert(toasts.some(message => message.includes('4 สิทธิ์')));
  assert.deepEqual(routes, ['/payment?booking_type=room&booking_id=9']);
});
test('ended, expired and already-paid priced entitlements do not offer another reservation', () => {
  for (const booking of [
    { ...room, status: 'checked_out' },
    { ...room, status: 'rejected' },
    { ...room, status: 'cancelled' },
    { ...room, boat_ticket_summary: { ...summary, valid_from: '2020-01-01', valid_to: '2020-01-02' } },
    { ...room, status: 'paid', boat_ticket_summary: { ...summary, bookable_tickets: 2, free_tickets: 0, paid_tickets: 3 } },
  ]) {
    const html = dashboard([booking]);
    assert(html.includes('ได้รับ 3 สิทธิ์'));
    assert(!html.includes('/kayaks/room-addon?room_booking_id=9'));
  }
});
test('successful slip handler immediately closes the priced addon reservation window', async () => {
  const source = fs.readFileSync(path.join(root, 'src/app/payment/page.tsx'), 'utf8');
  const start = source.indexOf('  const handleUploadSlip =');
  const handler = source.slice(start, source.indexOf('\n  // ยกเลิกการจอง', start));
  const js = ts.transpileModule(`${handler}\nreturn handleUploadSlip;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let status;
  const click = new Function('slip', 'payment', 'setUploading', 'specialRequest', 'api', 'setDone', 'setBookingStatus', 'toast', 'getApiErrorMessage', js)(new Blob(['slip']), { id: 1 }, () => {}, '', { post: async () => ({ data: {} }) }, () => {}, value => { status = value; }, { error: message => assert.fail(message) }, () => 'error');
  await click();
  assert.equal(status, 'paid');
});
test('ended parent remains readable from addon origin link and offers no booking form', () => {
  const Page = load('src/app/kayaks/room-addon/page.tsx', [{ status: 'checked_out', boat_ticket_summary: summary, rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1', status: 'checked_out' }] }, false, null], {
    'next/navigation': { useSearchParams: () => new URLSearchParams('room_booking_id=9') },
    '@/components/booking/BoatAddonSection': props => React.createElement('div', { 'data-booking': String(props.allowBooking) }, 'Existing boat reservations'),
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(html.includes('Existing boat reservations'));
  assert(html.includes('data-booking="false"'));
  assert(html.includes('ได้รับ 3 สิทธิ์'));
});
test('boat staff row and details identify room promotion origin and parent booking', () => {
  const addon = { boat_booking_id: 21, room_booking_id: 9, is_addon: true, addon_mode: 'paid', status: 'approved', booking_date: '2099-11-02', total_price: 200, user_name: 'Guest', kayak_name: 'Kayak' };
  const Wrapper = ({ children }) => React.createElement('div', null, children);
  const Page = load('src/app/admin/boats/page.tsx', [[addon], false, { total: 1, totalPages: 1 }, { all: 1, has_slip: 0, pending: 0, approved: 1, checked_out: 0, totalRevenue: 200, pendingRevenue: 0 }, [], '', { open: false }, { open: true, booking: addon }], {
    '@/components/admin/ui': { PageHeader: Wrapper, StatCard: Wrapper, Panel: Wrapper, Modal: ({ open, children }) => open ? React.createElement('div', null, children) : null, BookingStatusBadge: Wrapper, EmptyState: Wrapper },
    '@/lib/admin-notify': { notify: { success() {}, error() {} } },
    '@/lib/avatar': { resolveMediaUrl: value => value },
  }).TestContent;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert(html.includes('แพ็กเกจห้องพัก #9'));
  assert(html.includes('เรือจากโปรโมชั่นห้องพัก'));
  assert(html.includes('การจองห้องพัก #9'));
  assert(html.includes('มีค่าใช้จ่าย'));
});
test('checked-in addon never advertises cancellation even without card handout', () => {
  const Section = load('src/components/booking/BoatAddonSection.tsx', [[{
    boat_booking_id: 7, status: 'approved', handed_out_at: null, checkin_at: '2026-10-10T05:00:00Z',
    booking_date: '2026-10-10', start_time: '12:00', end_time: '13:00', mode: 'free', price: 0,
  }], false, null, null]).default;
  const html = renderToStaticMarkup(React.createElement(Section, { bookingRoomId: 51, roomBookingStatus: 'approved' }));
  assert(!html.includes('ยกเลิกบัตรเสริม'));
});
for (const [now, disabled] of [['2026-10-10T04:44:59Z', true], ['2026-10-10T04:45:00Z', false], ['2026-10-10T06:00:00Z', true]]) {
  test(`boat staff check-in button respects the API time window at ${now}`, () => {
    const Wrapper = ({ children }) => React.createElement('div', null, children);
    const booking = { boat_booking_id: 7, booking_date: '2026-10-10', start_time: '12:00', end_time: '13:00',
      status: 'approved', checkin_at: null, checkin_opens_at: '2026-10-10T04:45:00Z', checkin_closes_at: '2026-10-10T06:00:00Z',
      customer_name: 'TEST Boat', boats: [], total_price: 0 };
    const Page = load('src/app/admin/boats/checkin/page.tsx', ['2026-10-10', '', 'all', [booking], { total_bookings: 1, waiting_count: 1, on_water_count: 0, checked_out_count: 0, total_boats: 1 }, false, null, new Date(now).getTime()], {
      '@/components/admin/ui': { Modal: () => null }, '@/lib/admin-notify': { notify: {} },
    }).TestContent;
    const html = renderToStaticMarkup(React.createElement(Page));
    if(disabled) assert.match(html, /<button[^>]*disabled[^>]*title="(?:ยังไม่ถึงเวลาเปิดเช็คอิน|รอบเรือสิ้นสุดแล้ว)"/);
    else assert.match(html, /<button(?![^>]*disabled)[^>]*>[^]*?ปล่อยเรือลงน้ำ \(Check-in\)/);
  });
}
test('authoritative bookable count prevents mixed-paid and ended-room phantom CTAs', () => {
  const html = dashboard([{ ...room, boat_ticket_summary: { ...summary, bookable_tickets: 0 } }]);
  assert(html.includes('คงเหลือ 2 สิทธิ์'));
  assert(!html.includes('/kayaks/room-addon?room_booking_id=9'));
  assert(html.includes('ไม่สามารถจองรอบเพิ่ม'));
});
test('ended physical line summary explains inability to reserve despite active header', () => {
  const info = { total_tickets: 2, used_tickets: 0, balance: 2, mode: 'free', unit_price: 0, room_status: 'approved', room_line_status: 'checked_out', valid_from: '2099-11-02', valid_to: '2099-11-03' };
  const Section = load('src/components/booking/BoatAddonSection.tsx', [[], false, null, info]).default;
  const html = renderToStaticMarkup(React.createElement(Section, { bookingRoomId: 51, roomBookingStatus: 'approved' }));
  assert(html.includes('สิ้นสุดแล้ว'));
  assert(html.includes('คงเหลือ 2 สิทธิ์'));
});
test('slip refresh replaces pending bookable counts and refresh failure still confirms payment', async () => {
  const source = fs.readFileSync(path.join(root, 'src/app/payment/page.tsx'), 'utf8');
  const start = source.indexOf('  const handleUploadSlip =');
  const handler = source.slice(start, source.indexOf('\n  // ยกเลิกการจอง', start));
  const js = ts.transpileModule(`${handler}\nreturn handleUploadSlip;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const failRefresh of [false, true]) {
    let detail = { boat_ticket_summary: { ...summary, bookable_tickets: 2 } };
    let done = false, status;
    const requests = [];
    const click = new Function('slip', 'payment', 'setUploading', 'specialRequest', 'api', 'setDone', 'setBookingStatus', 'setBookingDetail', 'toast', 'getApiErrorMessage', 'console', js)(new Blob(['slip']), { id: 1, booking_type: 'room', booking_id: 9 }, () => {}, '', {
      post: async url => { requests.push(url); },
      get: async url => { requests.push(url); if (failRefresh) throw new Error('refresh unavailable'); return { data: { data: { boat_ticket_summary: { ...summary, bookable_tickets: 0 } } } }; },
    }, value => { done = value; }, value => { status = value; }, value => { detail = typeof value === 'function' ? value(detail) : value; }, { error: message => assert.fail(message) }, () => 'error', { error() {} });
    await click();
    assert.equal(status, 'paid');
    assert.equal(done, true);
    assert.equal(detail.boat_ticket_summary.bookable_tickets, 0);
    assert.deepEqual(requests, ['/payments/1/slip', '/bookings/9']);
  }
});
test('booking or cancelling a room addon refreshes the page header counters', async () => {
  const old = { status: 'approved', boat_ticket_summary: summary, rooms: [{ booking_room_id: 51, room_name: 'Standard', room_number: 'A1', status: 'approved' }] };
  const updated = { ...old, boat_ticket_summary: { ...summary, used_tickets: 2, remaining_tickets: 1 } };
  let onChanged, saved, cursor = 0;
  const requests = [];
  const Page = load('src/app/kayaks/room-addon/page.tsx', [], {
    react: { ...React, useState: () => { const index = cursor++; return [[old, false, null][index], value => { if (index === 0) saved = value; }]; }, useEffect() {} },
    'next/navigation': { useSearchParams: () => new URLSearchParams('room_booking_id=9') },
    '@/lib/api': { get: async url => { requests.push(url); return { data: { data: updated } }; } },
    '@/components/booking/BoatAddonSection': props => { onChanged = props.onChanged; return React.createElement('div', null, 'Reservations'); },
  }).default;
  renderToStaticMarkup(React.createElement(Page));
  assert.equal(typeof onChanged, 'function');
  await onChanged();
  assert.deepEqual(requests, ['/bookings/9']);
  assert.deepEqual(saved.boat_ticket_summary, updated.boat_ticket_summary);
});
