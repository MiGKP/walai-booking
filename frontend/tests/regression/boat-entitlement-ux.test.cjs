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
    'react-hot-toast': { error() {}, success() {} },
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
    mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }
  return read(path.join(root, relative));
}
const summary = { total_tickets: 3, used_tickets: 1, remaining_tickets: 2, free_tickets: 2, paid_tickets: 1, valid_from: '2099-11-02', valid_to: '2099-11-03' };
const room = { id: 9, status: 'approved', created_at: new Date().toISOString(), check_in_date: '2099-11-01', check_out_date: '2099-11-04', boat_ticket_summary: summary };
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
test('one-night entitlement explicitly excludes arrival and departure and has no CTA', () => {
  const html = dashboard([{ ...room, boat_ticket_summary: { ...summary, valid_from: null, valid_to: null } }]);
  assert(html.includes('ไม่รวมวันเช็คอินและวันเช็คเอาต์'));
  assert(html.includes('พัก 1 คืน'));
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
test('room checkout explains priced boat benefit and unusable one-night dates before submission', () => {
  const html = renderToStaticMarkup(React.createElement(details().default));
  assert(html.includes('มีค่าใช้จ่าย'));
  assert(html.includes('150'));
  assert(html.includes('พัก 1 คืน'));
  assert(html.includes('ไม่รวมวันเช็คอินและวันเช็คเอาต์'));
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
  assert.equal(html.split('เรือจากโปรโมชั่นห้องพัก').length - 1, 2);
  assert.equal(html.split('การจองห้องพัก #9').length - 1, 2);
  assert(html.includes('มีค่าใช้จ่าย'));
});
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
