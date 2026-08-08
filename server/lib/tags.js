const path = require('path');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const { atomicWrite, resolveInside } = require('./storage');
const { updateGroupView } = require('./base-file');
const { readConfig } = require('./config');
const { isManagedNote } = require('./managed-files');

const rebuildableTags = {
  collections: { fileKey: 'collectionsFile', label: 'Collections', getValues: data => data.Collection },
  groups: { fileKey: 'groupsFile', label: 'Groups', getValues: data => data.Groups ?? data.Group },
  types: { fileKey: 'typesFile', label: 'Types', getValues: data => data.Type }
};

async function readTagFile(filePath) {
  if (!filePath || !await fs.pathExists(filePath)) return [];
  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

async function writeTagFile(filePath, tags) {
  if (filePath) await atomicWrite(filePath, `${tags.join('\n')}\n`);
}

async function appendTagIfMissing(filePath, tag) {
  if (!filePath || !tag) return;
  const tags = await readTagFile(filePath);
  if (!tags.includes(tag)) {
    tags.push(tag);
    await writeTagFile(filePath, tags);
  }
}

async function ensureGroup(config, group) {
  await appendTagIfMissing(config.groupsFile, group);
  await updateGroupView(config.baseFile, 'add', group);
}

function applyTypeMapping(typeLine, typeMapping = {}) {
  if (!typeLine) return typeLine;
  const mapping = new Map(Object.entries(typeMapping).map(([source, target]) => [source.toLowerCase(), target]));
  return mapping.get(typeLine.toLowerCase()) || typeLine
    .split(/(\s+|—|\/\/)/)
    .map(part => mapping.get(part.trim().toLowerCase()) || part)
    .join('');
}

async function rebuildTagFile(type) {
  const tagConfig = rebuildableTags[type];
  if (!tagConfig) throw Object.assign(new Error('Invalid tag type'), { status: 400 });
  const config = await readConfig();
  if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) {
    throw Object.assign(new Error('Vault path not configured'), { status: 400 });
  }
  if (!config[tagConfig.fileKey]) {
    throw Object.assign(new Error(`Path for ${type} not configured`), { status: 400 });
  }
  const files = await fs.readdir(config.vaultPath);
  const mdFiles = files.filter(file => file.endsWith('.md') && !isManagedNote(config, file));
  const tags = new Set();
  for (const file of mdFiles) {
    const { data } = grayMatter(await fs.readFile(path.join(config.vaultPath, file), 'utf8'));
    const value = tagConfig.getValues(data);
    for (const tag of Array.isArray(value) ? value : [value]) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
    }
  }
  await writeTagFile(config[tagConfig.fileKey], [...tags].sort((a, b) => a.localeCompare(b)));
  return { message: `${tagConfig.label} rebuilt successfully`, count: tags.size };
}

async function updateTagInCards(type, oldTag, newTag) {
  const config = await readConfig();
  if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) return 0;
  const field = type === 'collections' ? 'Collection' : type === 'types' ? 'Type' : 'Groups';
  const files = (await fs.readdir(config.vaultPath)).filter(file => file.endsWith('.md') && !isManagedNote(config, file));
  const changed = [];
  for (const file of files) {
    const filePath = resolveInside(config.vaultPath, file);
    const parsed = grayMatter(await fs.readFile(filePath, 'utf8'));
    const value = field === 'Groups' ? (parsed.data.Groups ?? parsed.data.Group ?? []) : parsed.data[field];
    let nextValue = value;
    if (field === 'Groups') {
      const groups = Array.isArray(value) ? value : [value];
      nextValue = groups.flatMap(item => item === oldTag ? (newTag ? [newTag] : []) : [item]);
    } else if (value === oldTag) nextValue = newTag || '';
    if (JSON.stringify(value) !== JSON.stringify(nextValue)) changed.push({ filePath, parsed, field, nextValue });
  }
  if (!changed.length) return 0;
  const backupRoot = resolveInside(config.vaultPath, path.join('.tag-backups', new Date().toISOString().replace(/[:.]/g, '-')));
  await fs.ensureDir(backupRoot);
  for (const item of changed) {
    await fs.copy(item.filePath, resolveInside(backupRoot, path.basename(item.filePath)), { overwrite: false });
    item.parsed.data[item.field] = item.nextValue;
    if (item.field === 'Groups') delete item.parsed.data.Group;
    await atomicWrite(item.filePath, grayMatter.stringify(item.parsed.content, item.parsed.data));
  }
  return changed.length;
}

module.exports = {
  appendTagIfMissing, applyTypeMapping, ensureGroup, readTagFile, rebuildTagFile, updateTagInCards, writeTagFile
};
