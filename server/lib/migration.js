const crypto = require('crypto');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const path = require('path');
const {
  ApiError, atomicWrite, atomicWriteJson, cardStorageKey, checksum, isInside, resolveInside
} = require('./storage');
const { isManagedNote } = require('./managed-files');

const BACKUP_DIRECTORY = '.card-manager-backups';

async function walk(directory, extension, results = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === BACKUP_DIRECTORY || entry.name === '.trash' || entry.name === '.git') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath, extension, results);
    else if (entry.name.toLowerCase().endsWith(extension)) results.push(fullPath);
  }
  return results;
}

function coverFilename(data) {
  const match = typeof data.Cover === 'string' && data.Cover.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  return match ? path.basename(match[1]) : '';
}

function inferSetCode(data, cover) {
  if (data.SetCode) return String(data.SetCode).toLowerCase();
  const collection = typeof data.Collection === 'string' && data.Collection.match(/\(([a-z0-9]+)\)\s*$/i);
  if (collection) return collection[1].toLowerCase();
  const image = cover.match(/^([a-z0-9]+)-/i);
  return image ? image[1].toLowerCase() : '';
}

function normalizeGroups(data) {
  const value = data.Groups ?? data.Group ?? [];
  return (Array.isArray(value) ? value : [value]).map(String).map(item => item.trim()).filter(Boolean);
}

function replaceReferences(content, replacements) {
  let result = content;
  for (const replacement of replacements) {
    result = result.split(replacement.oldFilename).join(replacement.newFilename);
    result = result.replace(
      new RegExp(`(\\[\\[(?:[^\\]|]+\\/)?)${escapeRegExp(replacement.oldBasename)}(?=(?:\\||\\]\\]))`, 'g'),
      `$1${replacement.newBasename}`
    );
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateConfig(config) {
  if (!config.obsidianVaultPath) throw new ApiError(400, 'VAULT_PATH_REQUIRED', 'Configure the full Obsidian vault path first');
  if (!config.vaultPath || !config.imagesPath) throw new ApiError(400, 'CARD_PATHS_REQUIRED', 'Configure card and image paths first');
  if (!isInside(config.obsidianVaultPath, config.vaultPath) || !isInside(config.obsidianVaultPath, config.imagesPath)) {
    throw new ApiError(400, 'PATH_OUTSIDE_VAULT', 'Card and image paths must be inside the configured Obsidian vault');
  }
}

async function legacyCardFiles(config) {
  if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) return [];
  const files = (await fs.readdir(config.vaultPath))
    .filter(file => file.toLowerCase().endsWith('.md') && !isManagedNote(config, file));
  const legacy = [];
  for (const file of files) {
    const data = grayMatter(await fs.readFile(resolveInside(config.vaultPath, file), 'utf8')).data;
    if (data.SchemaVersion !== 2 || data.Group !== undefined || !data.Name || !data.SetCode || !data.CollectorNumber || !Array.isArray(data.Groups)) legacy.push(file);
  }
  return legacy;
}

async function buildPreview(config) {
  validateConfig(config);
  for (const directory of [config.obsidianVaultPath, config.vaultPath, config.imagesPath]) {
    if (!await fs.pathExists(directory)) throw new ApiError(400, 'DIRECTORY_NOT_FOUND', `Directory not found: ${directory}`);
  }
  if (config.schemaVersion >= 2 && (await legacyCardFiles(config)).length === 0) {
    throw new ApiError(409, 'MIGRATION_ALREADY_COMPLETE', 'Schema migration is already complete and no legacy card files were detected');
  }

  const cardFiles = (await fs.readdir(config.vaultPath))
    .filter(file => file.toLowerCase().endsWith('.md') && !isManagedNote(config, file));
  const actions = [];
  const unresolved = [];
  const targetNames = new Set();

  for (const filename of cardFiles) {
    const sourceNote = resolveInside(config.vaultPath, filename);
    const parsed = grayMatter(await fs.readFile(sourceNote, 'utf8'));
    const cover = coverFilename(parsed.data);
    const set = inferSetCode(parsed.data, cover);
    const number = String(parsed.data.CollectorNumber ?? parsed.data.Number ?? '').trim();
    const name = String(parsed.data.Name || path.basename(filename, '.md')).trim();
    if (!name || !set || !number || !cover) {
      unresolved.push({ filename, reason: 'Missing name, set code, collector number, or Cover image' });
      continue;
    }

    const key = cardStorageKey({
      name,
      set,
      collector_number: number,
      id: parsed.data.ScryfallId || ''
    });
    const noteFilename = `${key}.md`;
    const imageExtension = path.extname(cover) || '.jpg';
    const imageFilename = `${key}${imageExtension.toLowerCase()}`;
    const sourceImage = resolveInside(config.imagesPath, cover);
    const targetNote = resolveInside(config.vaultPath, noteFilename);
    const targetImage = resolveInside(config.imagesPath, imageFilename);
    const collisionKey = noteFilename.toLowerCase();
    if (targetNames.has(collisionKey) || (targetNote !== sourceNote && await fs.pathExists(targetNote))) {
      unresolved.push({ filename, reason: `Target collision: ${noteFilename}` });
      continue;
    }
    if (!await fs.pathExists(sourceImage)) {
      unresolved.push({ filename, reason: `Cover image not found: ${cover}` });
      continue;
    }
    targetNames.add(collisionKey);
    actions.push({
      sourceNote, targetNote, sourceImage, targetImage,
      oldNoteFilename: filename, newNoteFilename: noteFilename,
      oldImageFilename: cover, newImageFilename: imageFilename,
      data: {
        SchemaVersion: 2,
        ScryfallId: parsed.data.ScryfallId || null,
        OracleId: parsed.data.OracleId || null,
        SetCode: set.toUpperCase(),
        CollectorNumber: number,
        Name: name,
        Collection: parsed.data.Collection || '',
        Type: parsed.data.Type || '',
        Groups: normalizeGroups(parsed.data),
        Cover: `[[${imageFilename}]]`
      },
      body: parsed.content
    });
  }

  const replacements = actions.flatMap(action => [
    {
      oldFilename: action.oldNoteFilename,
      newFilename: action.newNoteFilename,
      oldBasename: path.basename(action.oldNoteFilename, '.md'),
      newBasename: path.basename(action.newNoteFilename, '.md')
    },
    {
      oldFilename: action.oldImageFilename,
      newFilename: action.newImageFilename,
      oldBasename: action.oldImageFilename,
      newBasename: action.newImageFilename
    }
  ]);
  const vaultMarkdown = await walk(config.obsidianVaultPath, '.md');
  const linkFiles = [];
  for (const file of vaultMarkdown) {
    const original = await fs.readFile(file, 'utf8');
    if (replaceReferences(original, replacements) !== original) linkFiles.push(file);
  }

  const identity = actions.map(action => ({
    source: path.relative(config.obsidianVaultPath, action.sourceNote),
    target: path.relative(config.obsidianVaultPath, action.targetNote),
    modified: (fs.statSync(action.sourceNote)).mtimeMs
  }));
  const previewId = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return {
    previewId,
    vaultPath: path.resolve(config.obsidianVaultPath),
    totals: { cards: actions.length, images: actions.length, linkFiles: linkFiles.length, unresolved: unresolved.length },
    unresolved,
    cards: actions.map(action => ({ from: action.oldNoteFilename, to: action.newNoteFilename })),
    images: actions.map(action => ({ from: action.oldImageFilename, to: action.newImageFilename })),
    actions,
    replacements,
    linkFiles
  };
}

async function applyMigration(config, request) {
  if (!request || request.confirmedVaultPath !== path.resolve(config.obsidianVaultPath)) {
    throw new ApiError(400, 'VAULT_CONFIRMATION_MISMATCH', 'The confirmed vault path must exactly match the configured vault path');
  }
  const preview = await buildPreview(config);
  if (request.previewId !== preview.previewId) {
    throw new ApiError(409, 'PREVIEW_STALE', 'Vault contents changed; generate and confirm a new preview');
  }

  const migrationId = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = resolveInside(config.obsidianVaultPath, path.join(BACKUP_DIRECTORY, migrationId));
  const filesToBackup = new Set([
    ...preview.actions.flatMap(action => [action.sourceNote, action.sourceImage]),
    ...preview.linkFiles
  ]);
  const manifest = { migrationId, createdAt: new Date().toISOString(), vaultPath: preview.vaultPath, files: [], outputs: [] };

  for (const source of filesToBackup) {
    if (!await fs.pathExists(source)) continue;
    const relative = path.relative(config.obsidianVaultPath, source);
    const backup = resolveInside(backupRoot, relative);
    await fs.ensureDir(path.dirname(backup));
    await fs.copy(source, backup, { overwrite: false });
    manifest.files.push({ relative, checksum: await checksum(source) });
  }

  const actionBySource = new Map(preview.actions.map(action => [path.resolve(action.sourceNote), action]));
  for (const action of preview.actions) {
    let noteContent = grayMatter.stringify(action.body, action.data);
    noteContent = replaceReferences(noteContent, preview.replacements);
    await atomicWrite(action.targetNote, noteContent);
    if (action.targetNote !== action.sourceNote) await fs.remove(action.sourceNote);
    if (action.targetImage !== action.sourceImage) {
      await fs.copy(action.sourceImage, action.targetImage, { overwrite: false });
      await fs.remove(action.sourceImage);
    }
  }

  for (const linkFile of preview.linkFiles) {
    if (actionBySource.has(path.resolve(linkFile))) continue;
    const original = await fs.readFile(linkFile, 'utf8');
    await atomicWrite(linkFile, replaceReferences(original, preview.replacements));
  }

  const outputPaths = new Set([
    ...preview.actions.flatMap(action => [action.targetNote, action.targetImage]),
    ...preview.linkFiles.map(file => actionBySource.get(path.resolve(file))?.targetNote || file)
  ]);
  for (const output of outputPaths) {
    if (await fs.pathExists(output)) {
      manifest.outputs.push({ relative: path.relative(config.obsidianVaultPath, output), checksum: await checksum(output) });
    }
  }
  await atomicWriteJson(resolveInside(backupRoot, 'manifest.json'), manifest);
  return { migrationId, totals: preview.totals, unresolved: preview.unresolved };
}

async function rollbackMigration(config, migrationId) {
  validateConfig(config);
  if (!/^[0-9TZ-]+$/.test(migrationId)) throw new ApiError(400, 'INVALID_MIGRATION_ID', 'Invalid migration ID');
  const backupRoot = resolveInside(config.obsidianVaultPath, path.join(BACKUP_DIRECTORY, migrationId));
  const manifestPath = resolveInside(backupRoot, 'manifest.json');
  if (!await fs.pathExists(manifestPath)) throw new ApiError(404, 'MIGRATION_NOT_FOUND', 'Migration manifest not found');
  const manifest = await fs.readJson(manifestPath);

  for (const output of manifest.outputs) {
    const outputPath = resolveInside(config.obsidianVaultPath, output.relative);
    if (!await fs.pathExists(outputPath) || await checksum(outputPath) !== output.checksum) {
      throw new ApiError(409, 'ROLLBACK_CONFLICT', 'A migrated file changed after migration', { file: output.relative });
    }
  }
  for (const output of manifest.outputs) await fs.remove(resolveInside(config.obsidianVaultPath, output.relative));
  for (const file of manifest.files) {
    const backup = resolveInside(backupRoot, file.relative);
    const destination = resolveInside(config.obsidianVaultPath, file.relative);
    await fs.ensureDir(path.dirname(destination));
    await fs.copy(backup, destination, { overwrite: true });
  }
  return { migrationId, restored: manifest.files.length };
}

async function migrationStatus(config) {
  const legacyFiles = await legacyCardFiles(config);
  if (!config.obsidianVaultPath) return { migrations: [], legacyFiles: legacyFiles.length };
  const root = path.join(config.obsidianVaultPath, BACKUP_DIRECTORY);
  if (!await fs.pathExists(root)) return { migrations: [], legacyFiles: legacyFiles.length };
  const entries = await fs.readdir(root, { withFileTypes: true });
  return { migrations: entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort().reverse(), legacyFiles: legacyFiles.length };
}

module.exports = { applyMigration, buildPreview, migrationStatus, rollbackMigration };
