const path = require('path');
const fs = require('fs-extra');
const { atomicWriteJson } = require('./storage');

const CONFIG_FILE = process.env.CONFIG_FILE
  ? path.resolve(process.env.CONFIG_FILE)
  : path.join(__dirname, '..', 'config.json');

const initialConfig = {
  vaultPath: '',
  imagesPath: '',
  groupsFile: '',
  typesFile: '',
  collectionsFile: '',
  queriesFile: '',
  obsidianVaultPath: '',
  baseFile: '',
  schemaVersion: 1,
  typeMapping: {}
};

async function ensureConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) await atomicWriteJson(CONFIG_FILE, initialConfig);
}

async function readConfig() {
  await ensureConfig();
  return { ...initialConfig, ...await fs.readJson(CONFIG_FILE) };
}

async function writeConfig(config) {
  await atomicWriteJson(CONFIG_FILE, { ...initialConfig, ...config });
}

module.exports = { CONFIG_FILE, ensureConfig, initialConfig, readConfig, writeConfig };
