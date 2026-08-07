const assert = require('node:assert/strict');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { auditCards } = require('../lib/card-audit');

test('card audit reports missing images, legacy data, and duplicates without writing', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'card-manager-audit-'));
  t.after(() => fs.remove(root));
  const cards = path.join(root, 'Cards'); const images = path.join(cards, 'Images'); await fs.ensureDir(images);
  const shared = { SchemaVersion: 2, ScryfallId: 'same-id', OracleId: 'oracle-id', SetCode: 'TST', CollectorNumber: '1', Name: 'Test Card', Groups: [], Cover: '[[missing.jpg]]' };
  await fs.writeFile(path.join(cards, 'first.md'), grayMatter.stringify('', shared));
  const { Groups, ...legacyFields } = shared;
  await fs.writeFile(path.join(cards, 'second.md'), grayMatter.stringify('', { ...legacyFields, Group: 'Legacy' }));

  const before = await fs.readdir(cards);
  const report = await auditCards({ vaultPath: cards, imagesPath: images });
  assert.equal(report.summary.totalCards, 2);
  assert.equal(report.summary.affectedCards, 2);
  assert.equal(report.summary.issueCounts.MISSING_IMAGE, 2);
  assert.equal(report.summary.issueCounts.DUPLICATE_SCRYFALL_ID, 2);
  assert.equal(report.summary.issueCounts.DUPLICATE_PRINT_IDENTITY, 2);
  assert.equal(report.summary.issueCounts.LEGACY_SCHEMA, 1);
  assert.deepEqual(await fs.readdir(cards), before);
});
