const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Execute the real aggregation with fixture API rows, then use the resulting day in UI tests.
module.exports = function calendarData(roomBookings, kayakBookings = []) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/app/admin/calendar/page.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('  const dailyDataMap = useMemo'), source.indexOf('  // สรุปสถิติประจำเดือน'));
  const js = ts.transpileModule(`${handler}\nreturn dailyDataMap;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function('useMemo', 'roomBookings', 'kayakBookings', 'parseDateToYYYYMMDD', js)(fn => fn(), roomBookings, kayakBookings, d => String(d).slice(0, 10));
};
