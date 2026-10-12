const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
let query;
let sent;
const db = require.resolve('../../src/config/database.ts');
require.cache[db] = { id: db, filename: db, loaded: true, exports: { __esModule: true, default: { query: (...args) => query(...args) } } };
const mail = require.resolve('../../src/services/mail.service.ts');
require.cache[mail] = { id: mail, filename: mail, loaded: true, exports: { sendReviewReminderEmail: async params => { sent = params; } } };
const { sendPendingReviewReminders } = require('../../src/services/review-reminder.service.ts');

test('review reminder links to the embedded dashboard reviews with or without a trailing slash', async () => {
  const previous = process.env.FRONTEND_URL;
  try {
    for (const base of ['https://example.com', 'https://example.com/']) {
      process.env.FRONTEND_URL = base;
      sent = null;
      query = async sql => sql.startsWith('UPDATE') ? { rows: [{ room_booking_id: 1 }], rowCount: 1 } : { rows: [{ room_booking_id: 1, email: 'test@example.com', check_in: '2026-01-01', check_out: '2026-01-02', room_name: 'TEST', type_name: 'Standard' }] };
      await sendPendingReviewReminders();
      assert.equal(sent.reviewUrl, 'https://example.com/dashboard?tab=reviews');
    }
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  }
});
