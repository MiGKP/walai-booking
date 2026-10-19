const assert = require('node:assert/strict');
const test = require('node:test');
require('ts-node/register/transpile-only');
const { validationResult } = require('express-validator');
const validators = require('../../src/middleware/validators.ts');

async function errors(name, password) {
  const req = { body: { first_name: 'TEST', last_name: 'TEST', name: 'TEST', role: 'room_staff', email: 'test@example.test', otp: '123456', current_password: 'legacy', password, new_password: password } };
  for (const rule of validators[name]) await rule.run(req);
  return validationResult(req).array();
}

for (const name of ['registerValidator', 'resetPasswordValidator', 'changePasswordValidator', 'setPasswordValidator', 'createStaffValidator', 'initAdminValidator']) {
  test(`${name} accepts long passphrases without trimming or composition requirements`, async () => {
    for (const value of ['Stay2026', 'a long quiet stay beside the river', 'พักริมแม่น้ำ2569', 'A7!'.repeat(24)]) assert.deepEqual(await errors(name, value), []);
  });
  test(`${name} rejects weak, non-string and truncated bcrypt inputs`, async () => {
    for (const value of ['12345678', 'PASSWORD', '        ', 'aaaaaaaa', 'A'.repeat(73), 'ก'.repeat(25), ['Stay2026'], 12345678]) {
      assert((await errors(name, value)).length > 0, `${name} accepted ${JSON.stringify(value)}`);
    }
  });
}
test('login accepts existing short passwords and never applies new-password rules', async () => {
  assert.deepEqual(await errors('loginValidator', 'old'), []);
  assert.deepEqual(await errors('loginValidator', 'password'), []);
  assert((await errors('loginValidator', ['password'])).length > 0);
});
