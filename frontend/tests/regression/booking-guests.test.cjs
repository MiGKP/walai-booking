const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function component() {
  const file = path.resolve(__dirname, '../../src/components/booking/BookingGuests.tsx');
  assert(fs.existsSync(file), 'booking details needs an editable guest section');
  const mod = new Module(file);
  mod.require = id => id === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, file);
  return mod.exports.default;
}

function tree(overrides = {}) {
  const changes = [];
  const props = { adults: 1, childAges: [], capacities: [2], adultHint: 'อายุ 12 ปีขึ้นไป', childMaxAge: 11,
    onChange: next => changes.push(next), ...overrides };
  return { node: component()(props), changes };
}
function find(node, predicate) {
  if (!React.isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props.children).map(child => find(child, predicate)).find(Boolean);
}

test('one standard room offers one/two adults without a number input', () => {
  const t = tree();
  const html = renderToStaticMarkup(t.node);
  assert.match(html, /พักได้ 1–2 ท่าน/);
  assert(!html.includes('type="number"'));
  find(t.node, node => node.type === 'input' && node.props.type === 'radio' && node.props.value === 2).props.onChange();
  assert.deepEqual(t.changes.at(-1), { adults: 2, childAges: [] });
});

test('large rooms and multiple standard rooms allow larger groups', () => {
  for (const capacities of [[6], [2, 2]]) {
    const t = tree({ capacities, adults: 2 });
    const increase = find(t.node, node => node.props['aria-label'] === 'เพิ่มผู้ใหญ่');
    assert(increase);
    increase.props.onClick();
    assert.deepEqual(t.changes.at(-1), { adults: 3, childAges: [] });
  }
});

test('adding children requires their ages and preserves infant age zero', () => {
  const t = tree({ adults: 2, childAges: [0] });
  find(t.node, node => node.props['aria-label'] === 'เพิ่มเด็ก').props.onClick();
  assert.deepEqual(t.changes.at(-1), { adults: 2, childAges: [0, null] });
  const next = tree({ adults: 2, childAges: [0, null] });
  find(next.node, node => node.props['aria-label'] === 'อายุเด็กคนที่ 2').props.onChange({ target: { value: '6' } });
  assert.deepEqual(next.changes.at(-1), { adults: 2, childAges: [0, 6] });
  const html = renderToStaticMarkup(next.node);
  assert.match(html, /value="0" selected=""/);
  assert(!html.includes('value="12"'));
});

test('removing a child drops only the last age and keeps adult count', () => {
  const t = tree({ adults: 2, childAges: [0, 11] });
  find(t.node, node => node.props['aria-label'] === 'ลดเด็ก').props.onClick();
  assert.deepEqual(t.changes.at(-1), { adults: 2, childAges: [0] });
});

function selectionHandler(previous) {
  const file = path.resolve(__dirname, '../../src/app/booking/details/page.tsx');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  const handleGuestSelection =');
  assert(start >= 0);
  const handler = source.slice(start, source.indexOf('\n  useEffect(', start));
  const code = ts.transpileModule(`${handler}\nreturn handleGuestSelection`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const carts = [], routes = [], bedChanges = [];
  const handle = new Function('setGuestSelection', 'setShowGuestErrors', 'guests', 'setChildBeds', 'setChildBedRoomIds', 'searchParams', 'router', 'cart', 'setRoomCart', code)(
    () => {}, () => {}, previous, value => bedChanges.push(value), () => {},
    new URLSearchParams('check_in=2099-01-01&check_out=2099-01-02&adults=1&promo_code=ROOM10'),
    { replace: url => routes.push(url) }, { items: [{ room_id: 1 }], check_in: '2099-01-01', check_out: '2099-01-02' }, value => carts.push(value),
  );
  return { handle, carts, routes, bedChanges };
}

test('confirmed guest edits persist actual adults and infant age zero with rooms and promotions intact', () => {
  const t = selectionHandler({ adults: 1, childAges: [0, 6] });
  t.handle({ adults: 2, childAges: [0, 6] });
  assert.equal(t.carts[0].adults, 2);
  assert.deepEqual(t.carts[0].child_ages, [0, 6]);
  assert.equal(t.carts[0].children, 2);
  assert.deepEqual(t.carts[0].items, [{ room_id: 1 }]);
  assert.match(t.routes[0], /promo_code=ROOM10/);
  assert.deepEqual(t.bedChanges, [], 'adult-only changes keep child beds');
});

test('unknown ages cannot overwrite valid saved guests, and changing child ages resets bed requests', () => {
  const t = selectionHandler({ adults: 2, childAges: [6] });
  t.handle({ adults: 2, childAges: [null] });
  assert.equal(t.carts.length, 0);
  assert.match(t.routes[0], /child_ages=/);
  assert.deepEqual(t.bedChanges, [{}]);
  t.handle({ adults: 2, childAges: [] });
  assert.equal(t.carts[0].children, 0);
  assert.deepEqual(t.carts[0].child_ages, []);
});
