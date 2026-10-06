import { createRequire } from 'node:module';
import crypto from 'node:crypto';

// รันหลังรีสตาร์ต server เท่านั้น เพราะ auth limiter นับคำขอผิดต่อ IP (20 ครั้ง / 15 นาที)
const require = createRequire(process.cwd() + '/package.json');
const { Client } = require('pg');
const API = process.env.TEST_API_URL || 'http://localhost:5055/api';
const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}
async function reset(otp) {
  await db.query(
    "UPDATE members SET reset_token = $1, reset_token_expires_at = NOW() + interval '1 hour', reset_attempts = 0 WHERE member_id = 1",
    [crypto.createHash('sha256').update(otp).digest('hex')],
  );
}
async function submit(otp, newPassword = 'Changed999') {
  const res = await fetch(API + '/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.test', otp, new_password: newPassword }),
  });
  return res.status;
}

const part = process.argv[2] || "wrong";

// 1) ผู้โจมตียิงผิดพร้อมกัน ต้องล็อก token และไม่ให้เดาเกินเกณฑ์
if (part === "wrong") {
await reset('654321');
const wrong = await Promise.all(Array.from({ length: 20 }, () => submit('000000')));
const att = (await db.query('SELECT reset_attempts, reset_token FROM members WHERE member_id = 1')).rows[0];
check('20 parallel wrong guesses lock the token', att.reset_token === null && Number(att.reset_attempts) >= 5, `attempts ${att.reset_attempts}, statuses ${[...new Set(wrong)].join(',')}`);

}

// 2) OTP ที่ถูกต้องส่งพร้อมกันหลายครั้ง ต้องสำเร็จเพียงครั้งเดียว
if (part === "correct") {
await reset('654321');
const good = await Promise.all(Array.from({ length: 5 }, () => submit('654321')));
const successes = good.filter((s) => s === 200).length;
check('5 parallel correct submissions succeed exactly once', successes === 1, `statuses ${good.join(',')}`);

}

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await db.end();
process.exit(failed.length ? 1 : 0);
