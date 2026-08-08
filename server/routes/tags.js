const express = require('express');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const validate = require('../lib/validation');
const { ApiError, resolveInside } = require('../lib/storage');
const { readConfig } = require('../lib/config');
const { updateGroupView } = require('../lib/base-file');
const { isManagedNote } = require('../lib/managed-files');
const {
  appendTagIfMissing, readTagFile, rebuildTagFile, updateTagInCards, writeTagFile
} = require('../lib/tags');

const router = express.Router();
const fileKey = type => ({ collections: 'collectionsFile', groups: 'groupsFile', types: 'typesFile' })[type];

router.post('/rebuild', async (req, res, next) => {
  try { res.json(await rebuildTagFile('collections')); } catch (error) { next(error); }
});

router.post('/rebuild/:type', async (req, res, next) => {
  try { res.json(await rebuildTagFile(validate.tagType(req.params.type))); } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const config = await readConfig();
    res.json({
      collections: await readTagFile(config.collectionsFile),
      groups: await readTagFile(config.groupsFile),
      types: await readTagFile(config.typesFile)
    });
  } catch (error) { next(error); }
});

router.get('/:type/impact', async (req, res, next) => {
  try {
    const type = validate.tagType(req.params.type);
    const oldTag = validate.tag(req.query.tag);
    const config = await readConfig();
    if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) return res.json({ count: 0 });
    let count = 0;
    for (const file of (await fs.readdir(config.vaultPath)).filter(item => item.endsWith('.md') && !isManagedNote(config, item))) {
      const data = grayMatter(await fs.readFile(resolveInside(config.vaultPath, file), 'utf8')).data;
      const value = type === 'collections' ? data.Collection : type === 'types' ? data.Type : (data.Groups ?? data.Group ?? []);
      if (Array.isArray(value) ? value.includes(oldTag) : value === oldTag) count++;
    }
    res.json({ count });
  } catch (error) { next(error); }
});

router.post('/:type', async (req, res, next) => {
  try {
    const type = validate.tagType(req.params.type);
    const tag = validate.tag(req.body.tag);
    const config = await readConfig();
    const tagFile = config[fileKey(type)];
    if (!tagFile) throw new ApiError(400, 'PATH_NOT_CONFIGURED', `Path for ${type} not configured`);
    await appendTagIfMissing(tagFile, tag);
    const baseView = type === 'groups' ? await updateGroupView(config.baseFile, 'add', tag) : null;
    res.json({ message: `Tag added to ${type}`, baseView });
  } catch (error) { next(error); }
});

router.put('/:type', async (req, res, next) => {
  try {
    const type = validate.tagType(req.params.type);
    const oldTag = validate.tag(req.body.oldTag);
    const newTag = validate.tag(req.body.newTag);
    const config = await readConfig();
    const tagFile = config[fileKey(type)];
    if (!tagFile) throw new ApiError(400, 'PATH_NOT_CONFIGURED', `Path for ${type} not configured`);
    await writeTagFile(tagFile, (await readTagFile(tagFile)).map(tag => tag === oldTag ? newTag : tag));
    const baseView = type === 'groups' ? await updateGroupView(config.baseFile, 'rename', oldTag, newTag) : null;
    const affectedCards = req.body.updateCards ? await updateTagInCards(type, oldTag, newTag) : 0;
    res.json({ message: `Tag updated in ${type}`, affectedCards, baseView });
  } catch (error) { next(error); }
});

router.delete('/:type', async (req, res, next) => {
  try {
    const type = validate.tagType(req.params.type);
    const tag = validate.tag(req.body.tag);
    const config = await readConfig();
    const tagFile = config[fileKey(type)];
    if (!tagFile) throw new ApiError(400, 'PATH_NOT_CONFIGURED', `Path for ${type} not configured`);
    await writeTagFile(tagFile, (await readTagFile(tagFile)).filter(item => item !== tag));
    const baseView = type === 'groups' ? await updateGroupView(config.baseFile, 'delete', tag) : null;
    const affectedCards = req.body.updateCards ? await updateTagInCards(type, tag, null) : 0;
    res.json({ message: `Tag deleted from ${type}`, affectedCards, baseView });
  } catch (error) { next(error); }
});

module.exports = router;
