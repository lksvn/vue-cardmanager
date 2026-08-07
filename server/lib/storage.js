const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function resolveInside(baseDirectory, candidate) {
  if (!baseDirectory) throw new ApiError(400, 'PATH_NOT_CONFIGURED', 'Storage path is not configured');
  if (typeof candidate !== 'string' || !candidate || path.isAbsolute(candidate)) {
    throw new ApiError(400, 'INVALID_FILENAME', 'A relative filename is required');
  }
  const base = path.resolve(baseDirectory);
  const resolved = path.resolve(base, candidate);
  const prefix = `${base}${path.sep}`;
  if (resolved !== base && !resolved.toLowerCase().startsWith(prefix.toLowerCase())) {
    throw new ApiError(400, 'PATH_TRAVERSAL', 'The requested path is outside the configured directory');
  }
  return resolved;
}

function isInside(parent, child) {
  if (!parent || !child) return false;
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slugify(value, fallback = 'card') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*#%&{}'@!`~$+(),\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .toLowerCase();
  return (slug || fallback).slice(0, 100);
}

function cardStorageKey(card) {
  const set = slugify(card.set || card.SetCode, 'set');
  const number = slugify(card.collector_number || card.CollectorNumber || card.Number, 'number');
  const name = slugify(card.name || card.Name);
  const id = slugify(card.id || card.ScryfallId, '').slice(0, 12);
  return [name, set, number, id].filter(Boolean).join('-');
}

async function atomicWrite(filePath, content, encoding = 'utf8') {
  await fs.ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, encoding);
    await fs.move(temporary, filePath, { overwrite: true });
  } catch (error) {
    await fs.remove(temporary).catch(() => {});
    throw error;
  }
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function checksum(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function errorPayload(error) {
  return {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Unexpected server error',
      ...(error.details ? { details: error.details } : {})
    }
  };
}

module.exports = {
  ApiError,
  atomicWrite,
  atomicWriteJson,
  cardStorageKey,
  checksum,
  errorPayload,
  isInside,
  resolveInside,
  slugify
};
