// UI contracts only: every API request is mocked, so no production data is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.TEST_FRONTEND_URL || 'http://localhost:3010';
const artifacts = process.env.TEST_ARTIFACT_DIR || require('node:os').tmpdir();
const summary = { total_count: 4, approved_count: 1, pending_count: 1, paid_count: 1, cancelled_count: 1, rejected_count: 0, revenue: 2700, awaiting_approval_amount: 500 };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const watch = page => page.on('pageerror', error => errors.push(error.message));
  const noOverflow = async (page, name) => {
    if (page.viewportSize().width < 768 && await page.locator('aside').count()) {
      await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().width === 80);
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 45), right: el.getBoundingClientRect().right }))));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: page overflow`);
  };
  try {
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const authRequests = [];
    await guest.route('**/api/**', route => {
      authRequests.push({ url: route.request().url(), body: route.request().postDataJSON() });
      return route.fulfill({ json: { success: true }, headers: { 'access-control-allow-origin': '*' } });
    });
    const recovery = await guest.newPage(); watch(recovery);
    await recovery.goto(`${baseURL}/auth/forgot-password`);
    await recovery.getByLabel('ประเภทบัญชี').selectOption('staff');
    await recovery.getByLabel('อีเมล', { exact: true }).fill('TEST-staff@example.test');
    await noOverflow(recovery, 'staff recovery mobile');
    await recovery.getByRole('button', { name: /ส่ง OTP/ }).click();
    await recovery.waitForURL('**/auth/reset-password?**');
    assert.equal(new URL(recovery.url()).searchParams.get('account_type'), 'staff');
    assert.equal(authRequests.find(r => r.url.includes('/forgot-password')).body.account_type, 'staff');
    await recovery.locator('#reset-otp').fill('123456');
    await recovery.locator('#new-password').fill('TEST-local-password');
    await recovery.locator('#confirm-password').fill('TEST-local-password');
    await noOverflow(recovery, 'staff reset mobile');
    await recovery.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }).click();
    await recovery.waitForURL('**/auth/login');
    assert.equal(authRequests.find(r => r.url.includes('/reset-password')).body.account_type, 'staff');
    await guest.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => localStorage.setItem('token', 'TEST_LOCAL_ONLY'));
    let role = 'room_staff';
    let profile = { id: 9001, first_name: 'TEST', last_name: 'Staff', email: 'staff@example.test', phone: '0812345678', address: '', line_id: '', facebook: '' };
    const memberQueries = []; const reportQueries = []; const saves = [];
    await context.route('**/api/**', async route => {
      const req = route.request(); const url = new URL(req.url()); const endpoint = url.pathname;
      let body = { success: true, data: [] };
      if (endpoint.endsWith('/auth/profile')) {
        if (req.method() === 'PUT') { saves.push(req.postDataJSON()); profile = { ...profile, ...req.postDataJSON() }; }
        body.data = { ...profile, role };
      } else if (endpoint.endsWith('/settings/notifications/pending')) {
        body.data = { counts: { room_slips: 0, boat_slips: 0, total_urgent: 0 }, recent_items: [] };
      } else if (endpoint.endsWith('/settings/stats')) {
        reportQueries.push(url.searchParams.toString());
        const room = role !== 'boat_staff'; const boat = role !== 'room_staff';
        body.data = { start: '2026-10-01', end: '2026-10-31',
          ...(room ? { room_summary: summary, room_chart: [{ day: '2026-10-12', revenue: 2700 }],
            packages: [{ id: 1, name: '=TEST,"package"', code: 'TEST_A', booking_count: 1, revenue: 2700, peak_dates: '2026-10-12' }],
            room_inventory: Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, type_name: 'TEST ห้อง', total: 3, booked: 1, available: 2 })) } : {}),
          ...(boat ? { kayak_summary: summary, kayak_chart: [{ day: '2026-10-12', revenue: 40 }],
            boat_inventory: [{ date: '2026-10-12', type_name: 'TEST เรือ', start_time: '15:00', end_time: '15:30', total: 4, booked: 1, available: 3 }] } : {}),
          ...(role === 'admin' ? { total_members: 25 } : {}) };
      } else if (endpoint.endsWith('/members')) {
        memberQueries.push(url.searchParams.toString());
        body.data = [{ member_id: 9001, first_name: 'TEST', last_name: 'Member', email: 'test@example.test', phone: '0812345678', is_active: true, created_at: '2026-10-12', room_booking_count: 2, boat_booking_count: 1 }];
        body.pagination = { page: Number(url.searchParams.get('page')), total: 25, totalPages: 3 };
        body.summary = { total: 25, active: 25, inactive: 0 };
      }
      await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    });
    const page = await context.newPage(); watch(page);
    for (const [staffRole, section] of [['room_staff', 'rooms'], ['boat_staff', 'boats'], ['admin', null]]) {
      role = staffRole;
      const prefix = section ? `/staff/${section}` : '/admin';
      await page.goto(`${baseURL}${prefix}/profile`);
      await page.waitForFunction(() => document.querySelector('input[aria-label="ชื่อ"]')?.value.startsWith('TEST'));
      await page.getByLabel('ชื่อ', { exact: true }).fill('TEST Updated');
      await page.getByLabel('ที่อยู่', { exact: true }).fill('TEST complete address');
      await page.getByLabel('LINE ID', { exact: true }).fill('TEST-line');
      await page.getByLabel('Facebook', { exact: true }).fill('TEST-facebook');
      const saved = page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/auth/profile'));
      await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
      await saved;
      await page.getByText('บันทึกข้อมูลสำเร็จ', { exact: true }).waitFor();
      await page.reload();
      await page.waitForFunction(() => document.querySelector('textarea[aria-label="ที่อยู่"]')?.value === 'TEST complete address');
      assert.equal(await page.getByLabel('ที่อยู่', { exact: true }).inputValue(), 'TEST complete address');
      assert.equal(await page.getByLabel('LINE ID', { exact: true }).inputValue(), 'TEST-line');
      assert.equal(await page.getByLabel('Facebook', { exact: true }).inputValue(), 'TEST-facebook');
      await page.getByLabel('อีเมล', { exact: true }).fill(`TEST-${staffRole}@example.test`);
      await page.getByLabel('รหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนอีเมล').fill('TEST-local-password');
      const emailSaved = page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/auth/profile'));
      await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
      await emailSaved;
      await page.getByText('บันทึกข้อมูลสำเร็จ', { exact: true }).waitFor();
      assert.equal(saves.at(-1).current_password, 'TEST-local-password');
      await noOverflow(page, `${staffRole} profile desktop`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.getByLabel('ชื่อ', { exact: true }).waitFor();
      await noOverflow(page, `${staffRole} profile mobile`);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${baseURL}${prefix}/stats`);
      await page.getByRole('heading', { name: 'รายงานสถิติ', exact: true }).waitFor();
      const expectedTitle = staffRole === 'boat_staff' ? 'สรุปการจองและชำระเงินเรือ' : 'สรุปการจองและชำระเงินห้องพัก';
      await page.getByRole('heading', { name: expectedTitle, exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'สรุปการจองและชำระเงินห้องพัก', exact: true }).count(), staffRole === 'boat_staff' ? 0 : 1);
      assert.equal(await page.getByRole('heading', { name: 'สรุปการจองและชำระเงินเรือ', exact: true }).count(), staffRole === 'room_staff' ? 0 : 1);
      await page.getByLabel('ช่วงรายงาน').selectOption('day');
      await page.getByLabel('วันที่หรือเดือนรายงาน').fill('2026-10-12');
      await page.getByRole('heading', { name: expectedTitle, exact: true }).waitFor();
      assert(reportQueries.some(q => q.includes('period=day') && q.includes('date=2026-10-12')));
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'ส่งออก CSV' }).click();
      const download = await downloadPromise;
      const csv = await fs.readFile(await download.path(), 'utf8');
      if (staffRole !== 'boat_staff') {
        assert(csv.includes("'=TEST,"));
        assert(csv.includes('""package""'));
        assert(csv.includes('30 ต.ค.')); // All rows exported, including beyond page 1.
      } else assert.equal(csv.includes('TEST ห้อง'), false);
      await noOverflow(page, `${staffRole} reports desktop`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.getByRole('heading', { name: expectedTitle, exact: true }).waitFor();
      await noOverflow(page, `${staffRole} reports mobile`);
      await page.screenshot({ path: path.join(artifacts, `scope-${staffRole}-mobile.png`), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto(`${baseURL}/admin/members`);
    await page.getByLabel('สถานะการจองของสมาชิก').selectOption('paid');
    const filtered = page.waitForResponse(res => res.url().includes('/members?') && res.url().includes('booking_service=boat'));
    await page.getByLabel('บริการที่สมาชิกจอง').selectOption('boat');
    await filtered;
    assert(memberQueries.some(q => q.includes('booking_status=paid') && q.includes('booking_service=boat') && q.includes('page=1')));
    await noOverflow(page, 'member filters desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByLabel('สถานะการจองของสมาชิก').waitFor();
    await noOverflow(page, 'member filters mobile');
    await page.screenshot({ path: path.join(artifacts, 'scope-members-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: staff recovery payloads, profiles/reload, role reports, CSV and member filters at desktop/mobile widths');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
