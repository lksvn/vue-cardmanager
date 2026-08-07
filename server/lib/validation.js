const { ApiError } = require('./storage');

const TAG_TYPES = new Set(['collections', 'groups', 'types']);
const CONFIG_FIELDS = new Set([
  'vaultPath', 'imagesPath', 'groupsFile', 'typesFile', 'collectionsFile',
  'obsidianVaultPath', 'baseFile', 'schemaVersion', 'typeMapping'
]);
const UPDATE_FIELDS = new Set(['Collection', 'Type', 'Groups', 'Group']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${name} must be an object`);
  }
  return value;
}

function rejectUnknown(value, allowed, name) {
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new ApiError(400, 'UNKNOWN_FIELDS', `Unknown ${name} fields`, { fields: unknown });
}

function tagType(value) {
  if (!TAG_TYPES.has(value)) throw new ApiError(400, 'INVALID_TAG_TYPE', 'Tag type must be collections, groups, or types');
  return value;
}

function tag(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new ApiError(400, 'INVALID_TAG', 'Tag must contain between 1 and 100 characters');
  }
  return value.trim();
}

function config(value) {
  object(value, 'Configuration');
  rejectUnknown(value, CONFIG_FIELDS, 'configuration');
  for (const field of ['vaultPath', 'imagesPath', 'groupsFile', 'typesFile', 'collectionsFile', 'obsidianVaultPath', 'baseFile']) {
    if (value[field] != null && typeof value[field] !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a string`);
    }
  }
  if (value.schemaVersion != null && (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'schemaVersion must be a positive integer');
  }
  if (value.typeMapping != null) object(value.typeMapping, 'typeMapping');
  return value;
}

function updates(value) {
  object(value, 'updates');
  rejectUnknown(value, UPDATE_FIELDS, 'update');
  if (value.Groups != null && (!Array.isArray(value.Groups) || value.Groups.some(item => typeof item !== 'string'))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Groups must be an array of strings');
  }
  if (value.Group != null && typeof value.Group !== 'string' && !Array.isArray(value.Group)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Group must be a string or array');
  }
  return value;
}

function saveBody(value) {
  object(value, 'Request body');
  object(value.card, 'card');
  for (const field of ['id', 'oracle_id', 'name', 'set', 'collector_number', 'type_line']) {
    if (typeof value.card[field] !== 'string' || !value.card[field]) {
      throw new ApiError(400, 'VALIDATION_ERROR', `card.${field} is required`);
    }
  }
  if (value.groups != null && (!Array.isArray(value.groups) || value.groups.some(item => typeof item !== 'string'))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'groups must be an array of strings');
  }
  return value;
}

module.exports = { config, saveBody, tag, tagType, updates };
