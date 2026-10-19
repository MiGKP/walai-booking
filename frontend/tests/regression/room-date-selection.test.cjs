const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const ts = require('typescript');

function calendar(props) {
  const states = [];
  let cursor = 0;
  const react = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  }, useMemo: fn => fn(), useEffect() {}, useRef: value => ({ current: value }) };
  const root = path.resolve(__dirname, '../..');
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const mod = new Module(file); modules.set(file, mod); mod.filename = file;
    mod.require = id => {
      if (id === 'react') return react;
      if (id === 'lucide-react') return new Proxy({}, { get: () => () => null });
      if (id.startsWith('@/')) return load(path.join(root, 'src', id.slice(2)) + '.ts');
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }
  const Calendar = load(path.join(root, 'src/components/booking/BookingCalendar.tsx')).default;
  const changes = [];
  const options = { mode: 'range', value: null, cursor: { year: 2099, month: 0 }, minISO: '2099-01-01', onCursorChange() {}, ...props,
    onSelect(value) { changes.push(value); options.value = value; } };
  function render() { cursor = 0; return Calendar(options); }
  function panel(node = render()) {
    if (!node || typeof node !== 'object') return null;
    if (node.type?.name === 'MonthPanel') return node.props;
    return React.Children.toArray(node.props?.children).map(child => panel(child)).find(Boolean);
  }
  return { options, changes, panel, select: iso => panel().onSelectDay(iso) };
}

test('first date selects only check-in and waits for an explicit check-out', () => {
  const c = calendar(); c.select('2099-01-19');
  assert.deepEqual(c.changes.at(-1), { start: '2099-01-19', end: '' });
  assert.equal(c.panel().selectedStart, '2099-01-19');
  assert.equal(c.panel().selectedEnd, null);
  assert.equal(c.panel().rangeNights.size, 0);
  c.select('2099-01-21');
  assert.deepEqual(c.changes.at(-1), { start: '2099-01-19', end: '2099-01-21' });
  assert.equal(c.panel().rangeNights.size, 2);
});

test('changing a complete range starts a new check-in without inventing checkout', () => {
  const c = calendar({ value: { start: '2099-01-10', end: '2099-01-12' } });
  c.select('2099-01-20');
  assert.equal(c.panel().selectedEnd, null);
  c.select('2099-01-18');
  assert.deepEqual(c.changes.at(-1), { start: '2099-01-18', end: '' });
  c.options.value = null;
  assert.equal(c.panel().selectedStart, null);
});

test('full checkout day is permitted but a stay cannot cross a sold-out night', () => {
  const c = calendar({ dayStatus: { '2099-01-20': { tone: 'full' } } });
  c.select('2099-01-19');
  assert.equal(c.panel().isDisabled('2099-01-20'), false);
  assert.equal(c.panel().isDisabled('2099-01-21'), true);
});

test('room calendar can include today but never a date before its minimum', () => {
  const c = calendar({ minISO: '2099-01-19' });
  assert.equal(c.panel().isDisabled('2099-01-18'), true);
  assert.equal(c.panel().isDisabled('2099-01-19'), false);
});
