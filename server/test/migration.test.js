const assert = require('node:assert/strict');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { applyMigration, buildPreview, rollbackMigration } = require('../lib/migration');

test('migration previews, applies, rewrites vault links, and rolls back', async t => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-vault-'));
  t.after(() => fs.remove(vault));
  const cards = path.join(vault, 'Cards'); const images = path.join(cards, 'Images');
  await fs.ensureDir(images);
  await fs.writeFile(path.join(images, 'lea-161-lightning-bolt.jpg'), 'image');
  await fs.writeFile(path.join(cards, 'Lightning Bolt.md'), grayMatter.stringify('Deal 3 damage.', {
    Collection: 'Limited Edition Alpha (LEA)', Type: 'Instant', Number: '161', Group: ['Favorites'], Cover: '[[lea-161-lightning-bolt.jpg]]'
  }));
  await fs.writeFile(path.join(vault, 'Deck.md'), 'Uses [[Lightning Bolt]] and ![[lea-161-lightning-bolt.jpg]].');
  const config = { obsidianVaultPath: vault, vaultPath: cards, imagesPath: images };

  const preview = await buildPreview(config);
  assert.deepEqual(preview.totals, { cards: 1, images: 1, linkFiles: 2, unresolved: 0 });
  const result = await applyMigration(config, { previewId: preview.previewId, confirmedVaultPath: path.resolve(vault) });
  const target = preview.cards[0].to;
  assert.equal(await fs.pathExists(path.join(cards, target)), true);
  assert.match(await fs.readFile(path.join(vault, 'Deck.md'), 'utf8'), new RegExp(path.basename(target, '.md')));
  const migrated = grayMatter(await fs.readFile(path.join(cards, target), 'utf8')).data;
  assert.equal(migrated.SchemaVersion, 2);
  assert.deepEqual(migrated.Groups, ['Favorites']);

  const rollback = await rollbackMigration(config, result.migrationId);
  assert.ok(rollback.restored >= 3);
  assert.equal(await fs.pathExists(path.join(cards, 'Lightning Bolt.md')), true);
  assert.equal(await fs.readFile(path.join(vault, 'Deck.md'), 'utf8'), 'Uses [[Lightning Bolt]] and ![[lea-161-lightning-bolt.jpg]].');
});

test('migration skips unresolved cards without guessing', async t => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-unresolved-'));
  t.after(() => fs.remove(vault));
  const cards = path.join(vault, 'Cards'); const images = path.join(cards, 'Images');
  await fs.ensureDir(images); await fs.writeFile(path.join(cards, 'Unknown.md'), 'No frontmatter');
  const preview = await buildPreview({ obsidianVaultPath: vault, vaultPath: cards, imagesPath: images });
  assert.equal(preview.totals.cards, 0); assert.equal(preview.totals.unresolved, 1);
});

test('schema version 2 blocks repeat migration without legacy files', async t => {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-complete-'));
  t.after(() => fs.remove(vault));
  const cards = path.join(vault, 'Cards'); const images = path.join(cards, 'Images');
  await fs.ensureDir(images);
  await fs.writeFile(path.join(images, 'card-tst-1-id.jpg'), 'image');
  await fs.writeFile(path.join(cards, 'card-tst-1-id.md'), grayMatter.stringify('', {
    SchemaVersion: 2, Name: 'Card', SetCode: 'TST', CollectorNumber: '1', Groups: [], Cover: '[[card-tst-1-id.jpg]]'
  }));
  await assert.rejects(
    buildPreview({ schemaVersion: 2, obsidianVaultPath: vault, vaultPath: cards, imagesPath: images }),
    error => error.code === 'MIGRATION_ALREADY_COMPLETE'
  );
});
