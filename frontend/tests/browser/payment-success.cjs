// UI-only fixtures: intercept every API request; never upload a real payment slip.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.TEST_FRONTEND_URL || 'http://localhost:3010';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDrsAAAAASUVORK5CYII=', 'base64');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const type of ['room', 'kayak']) {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(() => localStorage.setItem('token', 'TEST_LOCAL_ONLY'));
        let uploads = 0;
        await context.route('**/api/**', async route => {
          const req = route.request(); const endpoint = new URL(req.url()).pathname;
          let data = [];
          if (endpoint.endsWith('/auth/profile')) data = { id: 9001, role: 'customer', first_name: 'TEST', last_name: 'Member', email: 'test@example.test' };
          else if (endpoint.endsWith('/payments')) data = { id: 9001, booking_type: type, booking_id: 9001, amount: 2000, booking_status: 'pending', bank_info: {} };
          else if (endpoint.endsWith('/slip')) { uploads++; data = {}; }
          else if (/\/(?:bookings|kayaks\/bookings)\/9001$/.test(endpoint)) data = { created_at: new Date().toISOString(), check_in_date: '2099-01-10', check_out_date: '2099-01-12', booking_date: '2099-01-10', start_time: '15:00', end_time: '15:30', adults: 1, children: 0, num_passengers: 1, rooms: [], boats: [] };
          await route.fulfill({ json: { success: true, data }, headers: { 'access-control-allow-origin': '*' } });
        });
        const page = await context.newPage();
        await page.clock.install();
        const errors = []; page.on('pageerror', err => errors.push(err.message));
        await page.goto(`${baseURL}/payment?booking_type=${type}&booking_id=9001`);
        await page.getByRole('button', { name: 'ถัดไป (ไปหน้าส่งสลิป)' }).click();
        await page.locator('input[type=file]').setInputFiles({ name: 'TEST-slip.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('button', { name: 'ยืนยันการชำระเงิน', exact: true }).click();
        await page.getByRole('heading', { name: 'ส่งสลิปสำเร็จแล้ว!' }).waitFor();
        assert.equal(uploads, 1);
        // Advance beyond the former two-second countdown without slowing the test.
        await page.clock.runFor(6000);
        assert.equal(new URL(page.url()).pathname, '/payment', 'success waits for an explicit click');
        assert.equal(await page.getByText('ส่งหลักฐานการชำระเงินเรียบร้อยแล้ว', { exact: true }).count(), 0, 'no duplicate success toast');
        assert.equal(await page.getByText(/กำลังนำคุณไปยังแท็บ/).count(), 0, 'no countdown');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(require('node:os').tmpdir(), `walai-payment-${type}-${viewport.width}.png`), fullPage: true });
        await page.getByRole('link', { name: 'ดูการจองของฉัน', exact: true }).click();
        await page.waitForURL('**/dashboard?tab=bookings');
        await context.close();
        console.log(`PASS ${type} ${viewport.width}: upload, stable success, no toast, manual navigation`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
