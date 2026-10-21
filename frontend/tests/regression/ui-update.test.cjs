const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const detailSource = () => fs.readFileSync(path.join(root, 'src/app/rooms/[id]/page.tsx'), 'utf8');
function compile(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; }

test('complete search date selection updates room links and clears only a cart with different dates', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/rooms/page.tsx'), 'utf8');
  const start = source.indexOf('  const handleRangeSelect =');
  const handler = source.slice(start, source.indexOf('  const handleCollectPromo =', start));
  const routes = [], carts = [], drafts = [];
  const fn = new Function('setDraftRange', 'searchParams', 'router', 'pathname', 'cart', 'setRoomCart', 'toast', 'nightsBetween', 'setOpenPanel', compile(`${handler}\nreturn handleRangeSelect`))(
    next => drafts.push(next), new URLSearchParams('check_in=2099-01-01&check_out=2099-01-02&promo_code=ROOM10'),
    { replace: url => routes.push(url), push: url => routes.push(url) }, '/rooms', { items: [{ room_id: 1 }], check_in: '2099-01-01', check_out: '2099-01-02' },
    next => carts.push(next), () => {}, () => 2, () => {},
  );
  fn({ start: '2099-01-05', end: '2099-01-07' });
  assert.equal(routes.length, 1, 'displayed dates must reach the URL used by room links');
  assert.match(routes[0], /check_in=2099-01-05/);
  assert.match(routes[0], /check_out=2099-01-07/);
  assert.match(routes[0], /promo_code=ROOM10/);
  assert.deepEqual(carts, [null]);
  fn({ start: '2099-01-01', end: '2099-01-02' });
  assert.equal(carts.length, 1, 'same-date selection preserves the selected rooms');
});

function effectFor(source, marker) {
  const position = source.indexOf(marker);
  const start = source.lastIndexOf('  useEffect(', position);
  const end = source.indexOf('\n  useEffect(', position);
  return source.slice(start, end);
}

test('navbar push initializes after room data loads, sends sticky events and cleans up', () => {
  const effect = effectFor(detailSource(), '    const updateNavbarPush =');
  let callback, dependencies;
  const events = [], properties = new Map(), listeners = {};
  const doc = { documentElement: { style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } } };
  const win = { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; }, dispatchEvent: event => events.push(event) };
  const sentinel = { current: { getBoundingClientRect: () => ({ top: 0 }) } };
  class Event { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  new Function('useEffect', 'loading', 'id', 'room', 'sentinelRef', 'window', 'document', 'CustomEvent', compile(effect))(
    (fn, deps) => { callback = fn; dependencies = deps; }, false, '7', { id: 7 }, sentinel, win, doc, Event,
  );
  assert(dependencies.includes(false), 'effect must re-run after the loading skeleton is replaced');
  const cleanup = callback();
  assert.equal(properties.get('--navbar-translate-y'), '-64px');
  assert(events.some(event => event.type === 'room-subnav-sticky' && event.detail.isStuck));
  sentinel.current.getBoundingClientRect = () => ({ top: 200 });
  listeners.scroll();
  assert.equal(properties.get('--navbar-translate-y'), '0px');
  assert(events.some(event => event.detail.isStuck === false));
  cleanup();
  assert.equal(properties.has('--navbar-translate-y'), false);
  assert.deepEqual(Object.keys(listeners), []);
});

test('scroll spy highlights nested promotions instead of their room-picker parent', () => {
  const source = detailSource();
  const position = source.indexOf('    const navSections =');
  const start = source.lastIndexOf('  useEffect(', position);
  const end = source.indexOf('\n  const handleToggleRoom', position);
  let callback;
  const active = [];
  const rects = { overview: { top: -1000, bottom: -500 }, amenities: { top: -500, bottom: -300 }, 'room-picker': { top: -300, bottom: 900 }, promotions: { top: 80, bottom: 500 }, reviews: { top: 1000, bottom: 1300 }, policies: { top: 1400, bottom: 1600 } };
  new Function('useEffect', 'loading', 'id', 'window', 'document', 'setActiveSection', 'requestAnimationFrame', 'cancelAnimationFrame', compile(source.slice(start, end)))(
    fn => { callback = fn; }, false, '7', { location: { hash: '' }, innerHeight: 800, scrollY: 400, addEventListener() {}, removeEventListener() {} },
    { documentElement: { scrollHeight: 4000 }, getElementById: id => rects[id] ? { getBoundingClientRect: () => rects[id] } : null },
    id => active.push(id), fn => { fn(); return 1; }, () => {},
  );
  callback();
  assert.equal(active.at(-1), 'promotions');
});

test('raft controls remain present but are disabled when every room fits', () => {
  const file = path.join(root, 'src/components/booking/RaftLayoutMap.tsx');
  const mod = new Module(file);
  const react = { ...React, useState: initial => [initial, () => {}], useCallback: fn => fn, useEffect() {}, useRef: () => ({ current: null }) };
  mod.require = id => id === 'react' ? react : id === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : require(id);
  mod._compile(compile(fs.readFileSync(file, 'utf8')), file);
  const rooms = Array.from({ length: 6 }, (_, index) => ({ room_id: index + 1, room_number: `W${index + 1}`, is_current_type: true, is_available: true }));
  const html = renderToStaticMarkup(mod.exports.default({ rooms }));
  const right = html.match(/<button[^>]*aria-label="เลื่อนขวา"[^>]*>/)?.[0];
  assert(right && /\sdisabled(?:=|\s|>)/.test(right), 'no dead enabled arrow on wide screens');
  assert.match(html, /<input[^>]*aria-label="เลื่อนดูผังห้องพัก"[^>]*disabled|<input[^>]*disabled[^>]*aria-label="เลื่อนดูผังห้องพัก"/);
});

function ui(relative, states) {
  let cursor = 0;
  const modules = new Map();
  const react = { ...React, useState: initial => [cursor < states.length ? states[cursor++] : (cursor++, typeof initial === 'function' ? initial() : initial), () => {}], useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn, useRef: value => ({ current: value }) };
  const mocks = {
    react, 'lucide-react': new Proxy({}, { get: () => () => null }), 'react-hot-toast': { error() {}, success() {} },
    'next/link': ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children), 'next/image': () => null,
    'next/navigation': { useParams: () => ({ id: '7' }), usePathname: () => '/rooms/7', useSearchParams: () => new URLSearchParams(), useRouter: () => ({}) },
    '@/hooks/useAuth': { useAuth: () => ({ loading: false, isAuthenticated: false }) },
    '@/hooks/useInfantAgePolicy': { useGuestAgePolicy: () => ({ infantAge: 6, childMaxAge: 11, bookingPolicyText: '', adultHint: 'อายุ 12 ปีขึ้นไป', childHint: 'อายุ 0–11 ปี' }) },
    '@/lib/api': {}, '@/lib/room-cart-store': { useRoomCart: () => null },
    '@/lib/avatar': { resolveMediaUrl: value => value || '', resolveAvatarUrl: () => null },
    '@/components/booking/BookingSummaryCard': () => null,
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const mod = new Module(file); modules.set(file, mod); mod.filename = file;
    mod.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
        return load([base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
      }
      return require(id);
    };
    mod._compile(compile(fs.readFileSync(file, 'utf8')), file);
    return mod.exports;
  }
  return load(path.join(root, relative)).default();
}
function detail(reviews, filter = null) {
  const room = { id: 7, room_name: 'TEST ROOM', capacity: 2, price_per_night: 1000, rooms: [], images: [], amenities: [], available_promotions: [] };
  return ui('src/app/rooms/[id]/page.tsx', [room, [], null, false, { year: 2099, month: 0 }, {}, false, 0, false, null, reviews, 4, filter, 0, 100, false]);
}

test('nullable review ratings do not crash the page or disappear from all reviews', () => {
  const html = renderToStaticMarkup(detail([{ review_id: 1, rating: null, comment: 'NULL SCORE COMMENT', review_date: '2099-01-01' }]));
  assert(html.includes('NULL SCORE COMMENT'));
});

test('review star filters keep only matching scores and disable no-overflow arrows', () => {
  const reviews = Array.from({ length: 4 }, (_, index) => ({ review_id: index + 1, rating: index === 0 ? 1 : 5, comment: `SCORE COMMENT ${index}`, review_date: '2099-01-01' }));
  const html = renderToStaticMarkup(detail(reviews, 1));
  assert(html.includes('SCORE COMMENT 0'));
  assert(!html.includes('SCORE COMMENT 1'));
  const all = renderToStaticMarkup(detail(reviews));
  const right = all.match(/<button[^>]*aria-label="รีวิวถัดไป"[^>]*>/)?.[0];
  assert(right && /\sdisabled(?:=|\s|>)/.test(right));
});

test('review slider measurement re-runs when the room loading skeleton is removed', () => {
  const source = detailSource();
  const position = source.indexOf('    const timer = setTimeout(updateReviewScrollState');
  const start = source.lastIndexOf('  useEffect(', position);
  const end = source.indexOf('\n  const handleSlidebarClick', position);
  let dependencies;
  new Function('useEffect', 'loading', 'updateReviewScrollState', 'filteredReviews', compile(source.slice(start, end)))(
    (_fn, deps) => { dependencies = deps; }, false, () => {}, [],
  );
  assert(dependencies.includes(false), 'review ref may not exist before the room loads');
});

test('mobile menu overlay is outside the navbar transform containing block', () => {
  const node = ui('src/components/layout/Navbar.tsx', [true, false, false, false, false, 0]);
  function find(element, predicate) {
    if (!React.isValidElement(element)) return null;
    if (predicate(element)) return element;
    return React.Children.toArray(element.props.children).map(child => find(child, predicate)).find(Boolean);
  }
  const nav = find(node, element => element.type === 'nav');
  assert(nav);
  assert(find(node, element => element.props.role === 'dialog'));
  assert.equal(find(nav, element => element.props.role === 'dialog'), undefined);
});
