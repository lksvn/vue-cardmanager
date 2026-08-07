const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { atomicWrite, cardStorageKey, resolveInside } = require('../lib/storage');

test('resolveInside rejects traversal and absolute paths', () => {
  const base = path.join(os.tmpdir(), 'cards');
  assert.throws(() => resolveInside(base, '..\\secret.md'), error => error.code === 'PATH_TRAVERSAL');
  assert.throws(() => resolveInside(base, path.resolve(base, 'absolute.md')), error => error.code === 'INVALID_FILENAME');
  assert.equal(resolveInside(base, 'safe.md'), path.resolve(base, 'safe.md'));
});

test('cardStorageKey distinguishes printings and sanitizes names', () => {
  const first = cardStorageKey({ name: 'Fire // Ice', set: 'MH2', collector_number: '290', id: 'aaaaaaaa-bbbb' });
  const second = cardStorageKey({ name: 'Fire // Ice', set: 'MH2', collector_number: '290', id: 'cccccccc-dddd' });
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /[\\/:*?"<>|]/);
});

test('atomicWrite replaces complete content', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-storage-'));
  t.after(() => fs.remove(directory));
  const file = path.join(directory, 'card.md');
  await atomicWrite(file, 'before');
  await atomicWrite(file, 'after');
  assert.equal(await fs.readFile(file, 'utf8'), 'after');
  assert.deepEqual((await fs.readdir(directory)).filter(name => name.endsWith('.tmp')), []);
});
