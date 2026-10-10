const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/lib/date.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const dateHelpers = {};
vm.runInNewContext(source, { exports: dateHelpers, Date, Intl, isNaN });
for (const timezone of ['Asia/Bangkok', 'Pacific/Kiritimati', 'America/New_York']) test(`calendar dates stay unchanged in ${timezone}`, () => {
  const old = process.env.TZ; process.env.TZ = timezone;
  try {
    assert.equal(dateHelpers.addDaysISO('2026-10-10', 0), '2026-10-10');
    assert.equal(dateHelpers.addDaysISO('2026-12-31', 1), '2027-01-01');
    assert.deepEqual(JSON.parse(JSON.stringify(dateHelpers.monthRangeISO({ year: 2026, month: 9 }))), { start: '2026-10-01', end: '2026-10-31' });
    const grid = dateHelpers.buildMonthGrid({ year: 2026, month: 9 });
    assert.equal(grid.find(Boolean), '2026-10-01');
    assert.equal(grid.filter(Boolean).length, 31);
    assert.equal(grid.indexOf('2026-10-01'), 4);
    assert.equal(dateHelpers.todayISO(), dateHelpers.toISODate(new Date()));
    assert.equal(dateHelpers.toISODate(new Date('2026-10-09T18:00:00Z')), '2026-10-10');
    assert.equal(dateHelpers.nightsBetween('2026-03-07', '2026-03-09'), 2);
  } finally { if(old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
