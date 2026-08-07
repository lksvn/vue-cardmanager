const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const test = require('node:test');
const yaml = require('js-yaml');
const { updateGroupView } = require('../lib/base-file');

test('group lifecycle synchronizes generated Base views', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-base-'));
  t.after(() => fs.remove(directory));
  const baseFile = path.join(directory, 'Cards List.base');
  await fs.writeFile(baseFile, yaml.safeDump({ views: [{ type: 'cards', name: 'All Cards', cardSize: 290, image: 'note.Cover' }] }));

  await updateGroupView(baseFile, 'add', 'My "Group"');
  let document = yaml.safeLoad(await fs.readFile(baseFile, 'utf8'));
  assert.equal(document.views[1].name, 'My "Group"');
  assert.equal(document.views[1].filters.and[0], 'Groups.contains("My \\"Group\\"")');

  await updateGroupView(baseFile, 'rename', 'My "Group"', 'Renamed');
  document = yaml.safeLoad(await fs.readFile(baseFile, 'utf8'));
  assert.equal(document.views[1].name, 'Renamed');
  assert.equal(document.views[1].filters.and[0], 'Groups.contains("Renamed")');

  await updateGroupView(baseFile, 'delete', 'Renamed');
  document = yaml.safeLoad(await fs.readFile(baseFile, 'utf8'));
  assert.equal(document.views.length, 1);
});
