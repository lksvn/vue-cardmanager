const assert = require('node:assert/strict');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const os = require('os');
const path = require('path');
const test = require('node:test');

test('saved queries API writes, lists, replaces, and protects its managed note', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-queries-'));
  t.after(() => fs.remove(directory));
  const cards = path.join(directory, 'Cards');
  const images = path.join(cards, 'Images');
  const queriesFile = path.join(cards, 'queries.md');
  const groupsFile = path.join(directory, 'groups.md');
  await fs.ensureDir(images);
  const configFile = path.join(directory, 'config.json');
  const queriesConfig = {
    vaultPath: cards, imagesPath: images, groupsFile, typesFile: '', collectionsFile: '',
    queriesFile, obsidianVaultPath: directory, baseFile: '', schemaVersion: 2, typeMapping: {}
  };
  await fs.writeJson(configFile, queriesConfig);
  process.env.CONFIG_FILE = configFile;
  const { startServer } = require('../index');
  const server = await startServer(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, options = {}) => {
    const response = await fetch(`${base}${url}`, {
      ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    return { response, body: await response.json() };
  };

  await fs.writeFile(queriesFile, '  \n');
  const empty = await request('/api/queries');
  assert.deepEqual(empty.body, { queries: [] });

  const invalid = await request('/api/queries', { method: 'POST', body: JSON.stringify({ name: '', query: '' }) });
  assert.equal(invalid.response.status, 400);

  const created = await request('/api/queries', {
    method: 'POST', body: JSON.stringify({ name: 'Creatures | Recent', query: 'type:creature | name:"Tick ` Test"' })
  });
  assert.equal(created.response.status, 201);
  const content = await fs.readFile(queriesFile, 'utf8');
  const parsed = grayMatter(content);
  assert.equal(parsed.data.CardManagerFile, 'SavedQueries');
  assert.equal(parsed.data.Queries[0].Name, 'Creatures | Recent');
  assert.match(content, /Creatures \\| Recent/);
  assert.match(content, /type:creature \\| name:"Tick \\` Test"/);

  const duplicate = await request('/api/queries', {
    method: 'POST', body: JSON.stringify({ name: 'creatures | recent', query: 'type:creature' })
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, 'QUERY_EXISTS');

  const replaced = await request('/api/queries', {
    method: 'POST', body: JSON.stringify({ name: 'creatures | recent', query: 'type:creature is:commander', replace: true })
  });
  assert.equal(replaced.response.status, 201);
  assert.equal(replaced.body.replaced, true);
  const listed = await request('/api/queries');
  assert.deepEqual(listed.body.queries, [{ name: 'creatures | recent', query: 'type:creature is:commander' }]);

  const cardsResponse = await request('/api/cards');
  assert.deepEqual(cardsResponse.body, []);
  const audit = await request('/api/reports/cards');
  assert.equal(audit.body.summary.totalCards, 0);
  const rebuild = await request('/api/tags/rebuild/groups', { method: 'POST' });
  assert.equal(rebuild.body.count, 0);
  const migration = await request('/api/migrations/card-schema/preview', { method: 'POST' });
  assert.equal(migration.response.status, 409);
  assert.equal(migration.body.error.code, 'MIGRATION_ALREADY_COMPLETE');

  const beforeInterruptedWrite = await fs.readFile(queriesFile, 'utf8');
  const originalMove = fs.move;
  fs.move = async () => { throw new Error('simulated interrupted move'); };
  try {
    const { saveQuery } = require('../lib/queries');
    await assert.rejects(() => saveQuery(queriesConfig, { name: 'Interrupted', query: 'type:land', replace: false }));
  } finally {
    fs.move = originalMove;
  }
  assert.equal(await fs.readFile(queriesFile, 'utf8'), beforeInterruptedWrite);
  assert.deepEqual((await fs.readdir(cards)).filter(file => file.endsWith('.tmp')), []);

  await fs.writeFile(queriesFile, '---\nQueries: [broken\n---\noriginal');
  const malformedBefore = await fs.readFile(queriesFile, 'utf8');
  const malformed = await request('/api/queries', {
    method: 'POST', body: JSON.stringify({ name: 'Do not write', query: 'type:land' })
  });
  assert.equal(malformed.response.status, 422);
  assert.equal(malformed.body.error.code, 'MALFORMED_QUERIES_FILE');
  assert.equal(await fs.readFile(queriesFile, 'utf8'), malformedBefore);
});

test('configuration rejects query files outside the vault or without md extension', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-query-config-'));
  t.after(() => fs.remove(directory));
  const configFile = path.join(directory, 'config.json');
  await fs.writeJson(configFile, {});
  process.env.CONFIG_FILE = configFile;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../routes/config')];
  delete require.cache[require.resolve('../index')];
  const { startServer } = require('../index');
  const server = await startServer(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = value => fetch(`${base}/api/config`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value)
  });
  const vault = path.join(directory, 'Vault');
  await fs.ensureDir(vault);
  assert.equal((await post({ obsidianVaultPath: vault, queriesFile: path.join(directory, 'outside.md') })).status, 400);
  assert.equal((await post({ obsidianVaultPath: vault, queriesFile: path.join(vault, 'queries.txt') })).status, 400);
});
