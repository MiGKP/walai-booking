const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function loadConfig(apiUrl) {
  return spawnSync(process.execPath, ['-e', `const c = require('./next.config.js'); c.headers().then(h => console.log(JSON.stringify({ env: c.env, headers: h })));`], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_API_URL: apiUrl },
    encoding: 'utf8',
  });
}

test('build refuses masked and relative API addresses before publishing', () => {
  for (const apiUrl of ['[SENSITIVE]', '/[SENSITIVE]', 'api.example.com/api', 'javascript:alert(1)']) {
    const result = loadConfig(apiUrl);
    assert.notEqual(result.status, 0, apiUrl);
    assert.match(result.stderr, /NEXT_PUBLIC_API_URL/);
  }
});

test('valid API address supplies the client and CSP origin', () => {
  const result = loadConfig('https://walai-booking-api.onrender.com/api');
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.env.NEXT_PUBLIC_API_URL, 'https://walai-booking-api.onrender.com/api');
  const csp = config.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  assert.ok(csp.includes('https://walai-booking-api.onrender.com'));
  assert.ok(!csp.includes('[SENSITIVE]'));
});
