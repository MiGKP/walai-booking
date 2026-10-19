// Form contract checks only. API calls are intercepted; PostgreSQL behavior is
// independently exercised by backend/tests/integration/promotion-scenarios.test.cjs.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.TEST_FRONTEND_URL || 'http://localhost:3010';
const cases = [
  { code: 'ROOM10PCT', discount_type: 'percent', discount_value: 10 },
  { code: 'ROOM20MAX', discount_type: 'percent', discount_value: 20, min_price: 1000, max_discount: 300, usage_limit: 50 },
  { code: 'STAY2NIGHT', discount_type: 'percent', discount_value: 15, min_nights: 2 },
  { code: 'VIPROOM500', discount_type: 'fixed', discount_value: 500, min_price: 2500 },
  { code: 'ROOMONCE10', discount_type: 'percent', discount_value: 10, usage_limit_per_member: 1 },
  { code: 'ROOMFIRST1', discount_type: 'fixed', discount_value: 300, usage_limit: 1 },
  { code: 'ROOMFREEBOAT', discount_type: 'fixed', discount_value: 0, boat_ticket_count: 1 },
  { code: 'ROOMEXPIRED', discount_type: 'fixed', discount_value: 100, start_date: '2026-09-01', end_date: '2026-09-02' },
  { code: 'ROOMFUTURE', discount_type: 'percent', discount_value: 15, start_date: '2026-11-01' },
  { code: 'ROOMDISABLED', discount_type: 'fixed', discount_value: 100, is_active: false },
];
const fields = { min_price: 'ยอดจองขั้นต่ำ', max_discount: 'ลดได้สูงสุดไม่เกิน', usage_limit: 'สิทธิ์ทั้งหมด', min_nights: 'จองขั้นต่ำ', usage_limit_per_member: 'จำกัดต่อสมาชิก' };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Bangkok' });
    await context.addInitScript(() => localStorage.setItem('token', 'TEST_LOCAL_ONLY'));
    let submitted;
    await context.route('**/api/**', async route => {
      const req = route.request(); const endpoint = new URL(req.url()).pathname;
      let data = []; let status = 200;
      if (endpoint.endsWith('/auth/profile')) data = { id: 9001, role: 'admin', first_name: 'TEST', last_name: 'Admin' };
      else if (endpoint.endsWith('/settings/notifications/pending')) data = { counts: { room_slips: 0, boat_slips: 0, total_urgent: 0 }, recent_items: [] };
      if (endpoint.endsWith('/promotions') && req.method() === 'POST') {
        submitted = req.postDataJSON(); status = 201; data = { id: 9001, ...submitted };
      }
      await route.fulfill({ status, json: { success: true, data }, headers: { 'access-control-allow-origin': '*' } });
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-12T05:00:00Z') });
    const errors = []; page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${baseURL}/admin/promotions`);
    for (const fixture of cases) {
      submitted = undefined;
      await page.getByRole('button', { name: 'เพิ่มโปรโมชั่น', exact: true }).click();
      const form = page.locator('form').filter({ hasText: 'โค้ดส่วนลด' });
      const field = name => form.locator('label').filter({ hasText: name }).first().locator('..');
      await field('โค้ดส่วนลด').locator('input').fill(fixture.code);
      await field('ชื่อโปรโมชั่น').locator('input').fill(`TEST ${fixture.code}`);
      if (fixture.discount_type === 'fixed') {
        await field('ประเภทส่วนลด').getByRole('button').click();
        await form.getByRole('button', { name: 'จำนวนเงิน (฿)', exact: true }).click();
      }
      await field('มูลค่าส่วนลด').locator('input').fill(String(fixture.discount_value));
      for (const [key, label] of Object.entries(fields)) {
        if (fixture[key] != null) await field(label).locator('input').fill(String(fixture[key]));
      }
      for (const [key, label] of [['start_date', 'วันที่เริ่มใช้งาน'], ['end_date', 'วันที่สิ้นสุดการใช้งาน']]) {
        if (!fixture[key]) continue;
        const container = field(label);
        await container.getByRole('button').first().click();
        await container.getByTitle(fixture[key].includes('-09-') ? 'เดือนก่อนหน้า' : 'เดือนถัดไป').click();
        await container.getByRole('button', { name: String(Number(fixture[key].slice(-2))), exact: true }).click();
      }
      if (fixture.boat_ticket_count) {
        await form.getByRole('button', { name: 'ปิด (ไม่เพิ่ม)', exact: true }).click();
        await field('จำนวนบัตรเรือ').locator('input').fill('1');
        await form.getByRole('button', { name: 'ฟรี', exact: true }).click();
      }
      if (fixture.is_active === false) await field('สถานะเปิดใช้งาน').locator('label').last().click();
      const saved = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith('/promotions'));
      await form.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
      await saved;
      await form.waitFor({ state: 'hidden' });
      assert.equal(submitted.code, fixture.code);
      assert.equal(submitted.discount_type, fixture.discount_type);
      assert.equal(submitted.discount_value, fixture.discount_value);
      assert.equal(submitted.applies_to, 'room');
      assert.deepEqual(submitted.room_type_ids, []);
      assert.equal(submitted.boat_ticket_count, fixture.boat_ticket_count ?? 0);
      if (fixture.boat_ticket_count) assert.equal(submitted.boat_addon_mode, 'free');
      assert.equal(submitted.is_active, fixture.is_active !== false);
      for (const key of [...Object.keys(fields), 'start_date', 'end_date']) assert.equal(submitted[key], fixture[key] ?? null, key);
      console.log(`PASS UI form ${fixture.code}: values and blank optional fields submitted correctly`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
