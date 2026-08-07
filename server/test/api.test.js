const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const test = require('node:test');

test('API health, config validation, and path containment', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-api-'));
  t.after(() => fs.remove(directory));
  const cards = path.join(directory, 'Cards'); const images = path.join(cards, 'Images');
  await fs.ensureDir(images);
  const configFile = path.join(directory, 'config.json');
  await fs.writeJson(configFile, { vaultPath: cards, imagesPath: images, groupsFile: '', typesFile: '', collectionsFile: '', obsidianVaultPath: directory, schemaVersion: 1, typeMapping: {} });
  process.env.CONFIG_FILE = configFile;
  const { startServer } = require('../index');
  const server = await startServer(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address(); const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`).then(response => response.json());
  assert.equal(health.status, 'ok');

  const symbol = await fetch(`${base}/symbols/2.svg`);
  assert.equal(symbol.status, 200);
  assert.match(symbol.headers.get('content-type'), /^image\/svg\+xml/);
  assert.match(await symbol.text(), /^<svg/);

  const invalidConfig = await fetch(`${base}/api/config`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' }, body: JSON.stringify({ unknown: true })
  });
  assert.equal(invalidConfig.status, 400);
  assert.equal((await invalidConfig.json()).error.code, 'UNKNOWN_FIELDS');

  const traversal = await fetch(`${base}/api/images/${encodeURIComponent('..\\secret.jpg')}`);
  assert.equal(traversal.status, 400);
  assert.equal((await traversal.json()).error.code, 'PATH_TRAVERSAL');
});
