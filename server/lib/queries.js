const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const path = require('path');
const { ApiError, atomicWrite, isInside } = require('./storage');

function queriesPath(config) {
  if (!config.queriesFile) throw new ApiError(400, 'QUERIES_PATH_NOT_CONFIGURED', 'Configure the saved queries file first');
  if (!path.isAbsolute(config.queriesFile) || path.extname(config.queriesFile).toLowerCase() !== '.md') {
    throw new ApiError(400, 'INVALID_QUERIES_PATH', 'Queries file must be an absolute .md path');
  }
  if (!config.obsidianVaultPath || !isInside(config.obsidianVaultPath, config.queriesFile)) {
    throw new ApiError(400, 'QUERIES_PATH_OUTSIDE_VAULT', 'Queries file must be inside the configured Obsidian vault');
  }
  if (!fs.existsSync(path.dirname(config.queriesFile))) {
    throw new ApiError(400, 'QUERIES_DIRECTORY_NOT_FOUND', 'The saved queries directory does not exist');
  }
  return path.resolve(config.queriesFile);
}

function normalizeQueries(data) {
  if (data.CardManagerFile !== 'SavedQueries' || data.SchemaVersion !== 1 || !Array.isArray(data.Queries)) {
    throw new ApiError(422, 'MALFORMED_QUERIES_FILE', 'Saved queries file does not use the supported schema');
  }
  return data.Queries.map((item, index) => {
    if (!item || typeof item.Name !== 'string' || !item.Name.trim() || typeof item.Query !== 'string' || !item.Query.trim()) {
      throw new ApiError(422, 'MALFORMED_QUERIES_FILE', `Saved query at position ${index + 1} is invalid`);
    }
    return { name: item.Name.trim(), query: item.Query.trim() };
  });
}

async function readQueries(config) {
  const filePath = queriesPath(config);
  if (!await fs.pathExists(filePath)) return [];
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return [];
    return normalizeQueries(grayMatter(content).data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'MALFORMED_QUERIES_FILE', 'Saved queries file could not be parsed');
  }
}

function escapeTable(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

function renderQueries(queries) {
  const rows = queries.map(item => `| ${escapeTable(item.name)} | \`${escapeTable(item.query)}\` |`).join('\n');
  const body = `# Saved Queries\n\n> Managed by MTG Card Manager.\n\n| Name | Scryfall query |\n| --- | --- |${rows ? `\n${rows}` : ''}\n`;
  return grayMatter.stringify(body, {
    CardManagerFile: 'SavedQueries',
    SchemaVersion: 1,
    Queries: queries.map(item => ({ Name: item.name, Query: item.query }))
  });
}

async function saveQuery(config, input) {
  const queries = await readQueries(config);
  const index = queries.findIndex(item => item.name.toLowerCase() === input.name.toLowerCase());
  if (index >= 0 && !input.replace) throw new ApiError(409, 'QUERY_EXISTS', `A saved query named "${queries[index].name}" already exists`);
  if (index >= 0) queries[index] = { name: input.name, query: input.query };
  else queries.push({ name: input.name, query: input.query });
  await atomicWrite(queriesPath(config), renderQueries(queries));
  return { query: { name: input.name, query: input.query }, replaced: index >= 0 };
}

module.exports = { readQueries, renderQueries, saveQuery };
