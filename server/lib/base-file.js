const fs = require('fs-extra');
const yaml = require('js-yaml');
const { ApiError, atomicWrite } = require('./storage');

function groupExpression(group) {
  return `Groups.contains(${JSON.stringify(group)})`;
}

function expressionGroup(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^Groups\.contains\(("(?:[^"\\]|\\.)*")\)$/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function generatedGroup(view) {
  const filters = view?.filters?.and;
  if (!Array.isArray(filters) || filters.length !== 1) return null;
  return expressionGroup(filters[0]);
}

async function updateGroupView(baseFile, action, group, newGroup) {
  if (!baseFile) return { synced: false, reason: 'Base file path not configured' };
  if (!await fs.pathExists(baseFile)) throw new ApiError(400, 'BASE_FILE_NOT_FOUND', `Base file not found: ${baseFile}`);
  const document = yaml.safeLoad(await fs.readFile(baseFile, 'utf8')) || {};
  if (!Array.isArray(document.views)) document.views = [];
  const index = document.views.findIndex(view => generatedGroup(view) === group);

  if (action === 'add' && index === -1) {
    const template = document.views.find(view => view.type === 'cards') || {};
    document.views.push({
      type: 'cards',
      name: group,
      filters: { and: [groupExpression(group)] },
      order: template.order || ['file.name'],
      sort: template.sort || [{ property: 'file.name', direction: 'ASC' }],
      cardSize: template.cardSize || 290,
      image: template.image || 'note.Cover',
      imageAspectRatio: template.imageAspectRatio || 1.35,
      imageFit: template.imageFit || ''
    });
  } else if (action === 'rename' && index !== -1) {
    if (document.views[index].name === group) document.views[index].name = newGroup;
    document.views[index].filters.and[0] = groupExpression(newGroup);
  } else if (action === 'delete' && index !== -1) {
    document.views.splice(index, 1);
  } else {
    return { synced: true, changed: false };
  }

  const output = yaml.safeDump(document, { noRefs: true, lineWidth: -1, sortKeys: false });
  await atomicWrite(baseFile, output);
  return { synced: true, changed: true };
}

module.exports = { updateGroupView };
