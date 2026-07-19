require('dotenv').config();
const nodemailer = require('nodemailer');

const strip = (value) => String(value || '').replace(/^["']|["']$/g, '').trim();
const user = strip(process.env.MAIL_USER);
const pass = strip(process.env.MAIL_PASS).replace(/\s+/g, '');
const from = strip(process.env.MAIL_FROM || user);
const host = strip(process.env.MAIL_HOST);
const port = strip(process.env.MAIL_PORT);
const secure = strip(process.env.MAIL_SECURE);

const checks = [
  ['MAIL_HOST', host === 'smtp.gmail.com', host || '(missing)'],
  ['MAIL_PORT', Boolean(port), port || '(missing)'],
  ['MAIL_SECURE', secure === 'true' || secure === 'false', secure || '(missing)'],
  ['MAIL_USER', /@gmail\.com$/i.test(user), user || '(missing)'],
  ['MAIL_PASS', pass.length === 16 && /^[a-z0-9]+$/i.test(pass), `len=${pass.length}, alnum=${/^[a-z0-9]+$/i.test(pass)}`],
  ['MAIL_FROM', Boolean(from), from || '(missing)'],
];

console.log('=== Local MAIL_* checklist ===');
for (const [key, ok, detail] of checks) {
  console.log(`${ok ? 'OK' : 'BAD'}  ${key}: ${detail}`);
}

async function tryPort(useSecure) {
  const smtpPort = useSecure ? 465 : 587;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: smtpPort,
    secure: useSecure,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.verify();
    console.log(`OK  SMTP verify port ${smtpPort}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL SMTP verify port ${smtpPort}: ${message}`);
    return false;
  }
}

(async () => {
  console.log('=== Live Gmail SMTP test ===');
  const ok465 = await tryPort(true);
  const ok587 = await tryPort(false);
  process.exit(ok465 || ok587 ? 0 : 1);
})();
