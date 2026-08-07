const assert = require('node:assert/strict');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const os = require('os');
const path = require('path');
const test = require('node:test');

test('card, tag, report, config, migration, symbol, and set routes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-routes-'));
  t.after(() => fs.remove(directory));

  const cards = path.join(directory, 'Cards');
  const images = path.join(cards, 'Images');
  const groupsFile = path.join(directory, 'groups.md');
  const typesFile = path.join(directory, 'types.md');
  const collectionsFile = path.join(directory, 'collections.md');
  const configFile = path.join(directory, 'config.json');
  await fs.ensureDir(images);
  await Promise.all([groupsFile, typesFile, collectionsFile].map(file => fs.writeFile(file, '')));
  await fs.writeJson(configFile, {
    vaultPath: cards,
    imagesPath: images,
    groupsFile,
    typesFile,
    collectionsFile,
    obsidianVaultPath: directory,
    baseFile: '',
    schemaVersion: 2,
    typeMapping: {}
  });

  process.env.CONFIG_FILE = configFile;
  const { startServer } = require('../index');
  const server = await startServer(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(url, options = {}) {
    const response = await fetch(`${base}${url}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json();
    return { response, body };
  }

  const config = await request('/api/config');
  assert.equal(config.response.status, 200);
  assert.equal(config.body.vaultPath, cards);

  const addGroup = await request('/api/tags/groups', {
    method: 'POST', body: JSON.stringify({ tag: 'Commander' })
  });
  assert.equal(addGroup.response.status, 200);

  const save = await request('/api/cards/save', {
    method: 'POST',
    body: JSON.stringify({
      card: {
        id: '11111111-1111-4111-8111-111111111111',
        oracle_id: '22222222-2222-4222-8222-222222222222',
        name: 'Route Test Card',
        set: 'tst',
        set_name: 'Test Set',
        collector_number: '7',
        type_line: 'Creature — Test',
        oracle_text: 'Route test text.',
        layout: 'normal'
      },
      groups: ['Commander']
    })
  });
  assert.equal(save.response.status, 200);
  assert.match(save.body.filename, /route-test-card-tst-7-/);

  const list = await request('/api/cards');
  assert.equal(list.body.length, 1);
  assert.deepEqual(list.body[0].Groups, ['Commander']);

  const update = await request(`/api/cards/${encodeURIComponent(save.body.filename)}`, {
    method: 'PUT', body: JSON.stringify({ updates: { Groups: ['Favorites'], Type: 'Creature' } })
  });
  assert.equal(update.response.status, 200);
  const updatedNote = grayMatter(await fs.readFile(path.join(cards, save.body.filename), 'utf8'));
  assert.deepEqual(updatedNote.data.Groups, ['Favorites']);

  const impact = await request('/api/tags/groups/impact?tag=Favorites');
  assert.equal(impact.body.count, 1);

  const rename = await request('/api/tags/groups', {
    method: 'PUT', body: JSON.stringify({ oldTag: 'Favorites', newTag: 'Keepers', updateCards: true })
  });
  assert.equal(rename.body.affectedCards, 1);

  const rebuild = await request('/api/tags/rebuild/groups', { method: 'POST' });
  assert.equal(rebuild.body.count, 1);

  const tags = await request('/api/tags');
  assert.deepEqual(tags.body.groups, ['Keepers']);

  const report = await request('/api/reports/cards');
  assert.equal(report.body.summary.totalCards, 1);

  const migration = await request('/api/migrations/card-schema/status');
  assert.equal(migration.response.status, 200);
  assert.ok(Array.isArray(migration.body.migrations));
  assert.equal(migration.body.legacyFiles, 0);

  const symbols = await request('/api/symbols');
  assert.equal(symbols.response.status, 200);
  assert.ok(Array.isArray(symbols.body));

  const invalidSet = await request('/api/sets/not-valid!/icon');
  assert.equal(invalidSet.response.status, 400);
  assert.equal(invalidSet.body.error.code, 'INVALID_SET_CODE');

  const remove = await request(`/api/cards/${encodeURIComponent(save.body.filename)}`, { method: 'DELETE' });
  assert.equal(remove.response.status, 200);
  assert.equal(await fs.pathExists(path.join(cards, save.body.filename)), false);
});
