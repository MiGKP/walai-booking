const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
const nodemailer = require('nodemailer');
const mail = require('../../src/services/mail.service.ts');

test('booking messages separate requests from approvals and include escaped rejection reasons', async t => {
  const keys = ['MAIL_PROVIDER', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM', 'FRONTEND_URL'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const original = nodemailer.createTransport;
  const captured = [];
  nodemailer.createTransport = () => ({ sendMail: async data => captured.push(data) });
  Object.assign(process.env, { MAIL_PROVIDER: 'smtp', MAIL_HOST: 'smtp.example.test', MAIL_PORT: '587', MAIL_USER: 'test@example.test', MAIL_PASS: 'TEST', MAIL_FROM: 'test@example.test', FRONTEND_URL: 'https://example.test/' });
  t.after(() => { nodemailer.createTransport = original; for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
  for (const bookingType of ['room', 'kayak']) {
    const base = { to: 'recipient@example.test', customerName: 'TEST', bookingType, bookingId: 1, details: 'TEST', dateInfo: 'TEST', totalPrice: 100 };
    await mail.sendBookingConfirmationEmail(base);
    const request = captured.at(-1);
    assert.match(request.html, /ยังไม่ใช่การยืนยัน/);
    assert(request.html.includes('https://example.test/dashboard?tab=bookings'));
    await mail.sendBookingStatusEmail({ ...base, status: 'approved' });
    assert.match(captured.at(-1).html, /ยืนยันการจองสำเร็จ/);
    await mail.sendBookingStatusEmail({ ...base, status: 'rejected', rejectReason: '<เหตุผลทดสอบ>' });
    const rejected = captured.at(-1);
    assert.match(rejected.html, /&lt;เหตุผลทดสอบ&gt;/);
    assert.doesNotMatch(rejected.html, /แนบสลิปใหม่/);
    assert.doesNotMatch(rejected.html, /<เหตุผลทดสอบ>/);
  }
});
