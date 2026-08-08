const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const path = require('path');
const { ApiError, cardStorageKey, resolveInside } = require('./storage');
const { isManagedNote } = require('./managed-files');

function coverFilename(value) {
  const match = typeof value === 'string' && value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  return match ? path.basename(match[1]) : '';
}

function addIssue(card, code, message) {
  if (!card.issues.some(issue => issue.code === code)) card.issues.push({ code, message });
}

async function auditCards(config) {
  if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) throw new ApiError(400, 'VAULT_PATH_REQUIRED', 'Configured card path was not found');
  const files = (await fs.readdir(config.vaultPath))
    .filter(file => file.toLowerCase().endsWith('.md') && !isManagedNote(config, file));
  const cards = [];

  for (const filename of files) {
    const card = { filename, name: path.basename(filename, '.md'), issues: [], identity: {} };
    try {
      const parsed = grayMatter(await fs.readFile(resolveInside(config.vaultPath, filename), 'utf8'));
      const data = parsed.data;
      card.name = data.Name || card.name;
      card.identity = {
        scryfallId: data.ScryfallId || '', oracleId: data.OracleId || '',
        setCode: data.SetCode || '', collectorNumber: String(data.CollectorNumber ?? data.Number ?? '')
      };
      if (!data.ScryfallId) addIssue(card, 'MISSING_SCRYFALL_ID', 'Scryfall ID is missing');
      if (!data.OracleId) addIssue(card, 'MISSING_ORACLE_ID', 'Oracle ID is missing');
      if (!data.SetCode || !card.identity.collectorNumber) addIssue(card, 'MISSING_PRINT_IDENTITY', 'Set code or collector number is missing');
      if (data.SchemaVersion !== 2 || data.Group !== undefined || !Array.isArray(data.Groups)) addIssue(card, 'LEGACY_SCHEMA', 'Card does not use the complete schema-v2 fields');

      const cover = coverFilename(data.Cover);
      if (!cover) addIssue(card, 'MISSING_COVER', 'Cover link is missing or invalid');
      else if (!config.imagesPath || !await fs.pathExists(resolveInside(config.imagesPath, cover))) addIssue(card, 'MISSING_IMAGE', `Image file not found: ${cover}`);

      if (data.Name && data.SetCode && card.identity.collectorNumber && data.ScryfallId) {
        const expected = `${cardStorageKey(data)}.md`;
        if (filename.toLowerCase() !== expected.toLowerCase()) addIssue(card, 'FILENAME_MISMATCH', `Expected filename: ${expected}`);
      }
    } catch (error) {
      addIssue(card, 'PARSE_ERROR', error.message || 'Could not parse card note');
    }
    cards.push(card);
  }

  const duplicate = (key, code, label) => {
    const groups = new Map();
    for (const card of cards) {
      const value = key(card);
      if (!value) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(card);
    }
    for (const [value, matches] of groups) if (matches.length > 1) {
      for (const card of matches) addIssue(card, code, `${label} is shared by ${matches.length} notes: ${value}`);
    }
  };
  duplicate(card => card.identity.scryfallId, 'DUPLICATE_SCRYFALL_ID', 'Scryfall ID');
  duplicate(card => card.identity.setCode && card.identity.collectorNumber ? `${card.identity.setCode.toLowerCase()}:${card.identity.collectorNumber.toLowerCase()}` : '', 'DUPLICATE_PRINT_IDENTITY', 'Set/collector identity');

  const issueCounts = {};
  for (const issue of cards.flatMap(card => card.issues)) issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    summary: { totalCards: cards.length, affectedCards: cards.filter(card => card.issues.length).length, totalIssues: Object.values(issueCounts).reduce((sum, count) => sum + count, 0), issueCounts },
    cards: cards.filter(card => card.issues.length)
  };
}

module.exports = { auditCards };
