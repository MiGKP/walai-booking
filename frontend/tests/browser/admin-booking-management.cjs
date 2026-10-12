// All API requests are intercepted; this suite never changes production data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.TEST_FRONTEND_URL || 'http://localhost:3010';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => localStorage.setItem('token', 'TEST_LOCAL_ONLY'));
    let roomSlips = 1;
    let role = 'admin';
    let notificationRequests = 0;
    let holdNotification = false;
    let releaseNotification;
    const listQueries = [];
    const errors = [];
    await context.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      let body = { success: true, data: [] };
      if (path.endsWith('/auth/profile')) body.data = { id: 9001, role, first_name: 'TEST', last_name: 'Admin', email: 'test@example.test' };
      else if (path.endsWith('/settings/notifications/pending')) {
        notificationRequests++;
        body.data = { counts: { room_slips: roomSlips, boat_slips: 0, today_checkins: 0, today_checkouts: 0, today_boat_checkins: 0, total_urgent: roomSlips }, recent_items: [] };
        if (holdNotification) {
          holdNotification = false;
          await new Promise(resolve => { releaseNotification = resolve; });
        }
      } else if (req.method() === 'PUT') {
        assert(path.endsWith('/bookings/9001/status'));
        roomSlips = 0;
      } else if (path.endsWith('/bookings') || path.endsWith('/kayaks/bookings/all')) {
        listQueries.push(url.searchParams.toString());
        const boats = path.includes('/kayaks/');
        const page = Number(url.searchParams.get('page') || 1);
        const limit = Number(url.searchParams.get('limit') || 10);
        const status = url.searchParams.get('status');
        body.data = Array.from({ length: limit }, (_, i) => ({
          id: 9001 + (page - 1) * limit + i, room_booking_id: 9001 + i, boat_booking_id: 9001 + i,
          user_name: `TEST ลูกค้า ${i + 1}`, user_phone: '0000000000', total_price: 1200,
          status: status || (roomSlips ? 'paid' : 'approved'), payment_slip: '/test-slip.png',
          check_in: '2099-11-01', check_out: '2099-11-02', booking_date: '2099-11-01', start_time: '15:00', end_time: '15:30',
          rooms: [{ room_name: 'ห้องธรรมดา', room_number: 'TEST1' }, { room_name: 'ห้องพิเศษ', room_number: 'TEST2' }],
          boats: [{ type_name: 'เรือ TEST', boat_count: 2, num_passengers: 4 }],
        }));
        body.pagination = { page, limit, total: 65, totalPages: Math.ceil(65 / limit) };
        body.summary = { all: 65, has_slip: boats ? 0 : roomSlips, pending: 4, approved: 60, checked_out: 0, totalRevenue: 1200, pendingRevenue: 1200 };
      } else if (path.endsWith('/rooms')) body.data = [{ type_name: 'ห้องธรรมดา' }, { type_name: 'ห้องพิเศษ' }];
      else if (path.endsWith('/kayaks/admin/types')) body.data = [{ name: 'เรือ TEST' }];
      await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    });
    const page = await context.newPage();
    await page.clock.install();
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${baseURL}/admin/rooms`, { waitUntil: 'domcontentloaded' });
    const bell = page.getByRole('button', { name: 'แจ้งเตือนงานค้าง', exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="แจ้งเตือนงานค้าง"]')?.textContent === '1');
    // Hold a stale polling response while approving; the mutation must queue another read.
    holdNotification = true;
    const pollingRequest = page.waitForRequest(req => req.url().includes('/settings/notifications/pending'));
    await page.clock.runFor(15100);
    await pollingRequest;
    const firstRow = page.locator('tbody tr').first();
    await firstRow.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
    const refreshedList = page.waitForResponse(res => res.request().method() === 'GET' && res.url().includes('/bookings?'));
    await page.getByRole('button', { name: 'อนุมัติการจอง', exact: true }).click();
    await refreshedList;
    releaseNotification();
    await page.waitForFunction(() => document.querySelector('[aria-label="แจ้งเตือนงานค้าง"]')?.textContent === '', null, { timeout: 5000 });
    assert(notificationRequests >= 2, 'Successful approval must immediately refresh badges');
    for (const service of ['rooms', 'boats']) {
      await page.goto(`${baseURL}/admin/${service}?page=3`, { waitUntil: 'domcontentloaded' });
      if (service === 'rooms') {
        await page.getByText('ตัวกรองเพิ่มเติม', { exact: true }).click();
        assert.equal(await page.locator('thead th').count(), 8);
        await firstRow.getByText('TEST1', { exact: true }).waitFor();
        await firstRow.getByText('TEST2', { exact: true }).waitFor();
      }
      await page.getByLabel('สถานะการจอง', { exact: true }).selectOption('cancelled');
      await page.waitForURL('**filter=cancelled**');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '1');
      const sortedList = page.waitForResponse(res => res.url().includes('/api/') && res.url().includes('sort=') && res.url().includes('sort_dir=asc'));
      await page.getByLabel('เรียงรายการ').selectOption('service_asc');
      await sortedList;
      await page.getByLabel('รายการต่อหน้า').selectOption('25');
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 25);
      await page.getByRole('button', { name: 'หน้าถัดไป', exact: true }).click();
      await page.waitForURL('**page=2**');
      assert(listQueries.some(q => q.includes('status=cancelled') && q.includes('limit=25')));
      await page.getByLabel('ค้นหาการจอง').fill('TEST2');
      await page.waitForURL('**search=TEST2**');
      assert.equal(new URL(page.url()).searchParams.get('page'), '1');
      await page.getByRole('button', { name: 'รีเซ็ตตัวกรอง', exact: true }).click();
      await page.waitForURL(`${baseURL}/admin/${service}`);
      assert.equal(await page.getByLabel('ค้นหาการจอง').inputValue(), '');
      const before = notificationRequests;
      roomSlips = 3;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => document.querySelector('[aria-label="แจ้งเตือนงานค้าง"]')?.textContent === '3');
      assert(notificationRequests > before);
      // A new booking in another session updates the badge on the timer, retaining filters.
      roomSlips = 4;
      await page.clock.runFor(15100);
      await page.waitForFunction(() => document.querySelector('[aria-label="แจ้งเตือนงานค้าง"]')?.textContent === '4');
      await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR || require('node:os').tmpdir()}/admin-${service}-desktop.png`, fullPage: true });
      roomSlips = 0;
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [staffRole, route] of [['room_staff', '/staff/rooms/dashboard'], ['boat_staff', '/staff/boats/dashboard']]) {
      role = staffRole;
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      if (staffRole === 'room_staff') await page.getByText('ตัวกรองเพิ่มเติม', { exact: true }).click();
      await page.getByLabel('สถานะการจอง', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().width === 80);
      await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR || require('node:os').tmpdir()}/admin-${staffRole}-mobile.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${staffRole}: no page overflow at 390px`);
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: approval badges, focus updates, filters, sorting, page size, pagination, search and reset');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
