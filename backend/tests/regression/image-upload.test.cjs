const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
require('ts-node/register/transpile-only');
const { createImageUpload } = require('../../src/middleware/image-upload.middleware.ts');

test('multipart rejects user file errors as 400 Thai without reaching the handler', async t => {
  const app = express();
  let accepted = 0;
  app.post('/slip', createImageUpload(1024).single('slip'), (req, res) => { accepted++; res.json({ success: true }); });
  app.use((error, req, res, next) => res.status(error.name === 'MulterError' ? 400 : error.status || 500).json({ success: false, message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const [mime, name, length] of [['application/pdf', 'slip.pdf', 20], ['image/png', 'slip.exe', 20], ['image/png', 'slip.png', 1025]]) {
    const form = new FormData();
    form.append('slip', new Blob([Buffer.alloc(length)], { type: mime }), name);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/slip`, { method: 'POST', body: form });
    assert.equal(response.status, 400);
    if (length <= 1024) assert.match((await response.json()).message, /รูปภาพ/);
  }
  assert.equal(accepted, 0);
});

test('multipart accepts one valid PNG and rejects duplicate slip fields', async t => {
  const app = express();
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh9sAAAAASUVORK5CYII=', 'base64');
  let accepted = 0;
  app.post('/slip', createImageUpload(1024).single('slip'), (req, res) => {
    accepted++;
    assert.deepEqual(req.file.buffer, image);
    res.json({ success: true, filename: req.file.originalname });
  });
  app.use((error, req, res, next) => res.status(error.name === 'MulterError' ? 400 : error.status || 500).json({ success: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/slip`;
  const valid = new FormData();
  valid.append('slip', new Blob([image], { type: 'image/png' }), 'TEST.png');
  const response = await fetch(url, { method: 'POST', body: valid });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, filename: 'TEST.png' });
  const duplicate = new FormData();
  for (let i = 0; i < 2; i++) duplicate.append('slip', new Blob([image], { type: 'image/png' }), `TEST-${i}.png`);
  assert.equal((await fetch(url, { method: 'POST', body: duplicate })).status, 400);
  assert.equal(accepted, 1);
});
