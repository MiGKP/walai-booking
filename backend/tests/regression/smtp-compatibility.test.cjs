const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
const nodemailer = require('nodemailer');
const { sendPasswordResetEmail } = require('../../src/services/mail.service.ts');

test('password reset SMTP path creates a valid message with the upgraded mailer without network delivery', async t => {
  const keys = ['MAIL_PROVIDER', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM', 'APP_NAME'];
  const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalCreateTransport = nodemailer.createTransport;
  const transport = originalCreateTransport({ streamTransport: true, buffer: true });
  const messages = [];
  nodemailer.createTransport = options => {
    assert.equal(options.host, 'smtp.example.com');
    assert.equal(options.auth.user, 'qa@example.com');
    return { sendMail: async message => {
      const info = await transport.sendMail(message);
      messages.push({ info, message });
      return info;
    } };
  };
  Object.assign(process.env, { MAIL_PROVIDER: 'smtp', MAIL_HOST: 'smtp.example.com', MAIL_PORT: '587', MAIL_USER: 'qa@example.com', MAIL_PASS: 'TEST-only', MAIL_FROM: 'Walai TEST <qa@example.com>', APP_NAME: 'Walai TEST' });
  t.after(() => {
    nodemailer.createTransport = originalCreateTransport;
    transport.close();
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  await sendPasswordResetEmail({ to: 'recipient@example.com', recipientName: '<TEST>', otpCode: '123456' });
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].info.envelope.to, ['recipient@example.com']);
  assert.match(messages[0].message.text, /123456/);
  assert.match(messages[0].message.html, /&lt;TEST&gt;/);
  assert.doesNotMatch(messages[0].message.html, /<TEST>/);
  const mime = messages[0].info.message.toString();
  assert.match(mime, /To: recipient@example\.com/);
  assert.match(mime, /multipart\/alternative/);
  assert.match(mime, /Content-Type: text\/html/);
});
