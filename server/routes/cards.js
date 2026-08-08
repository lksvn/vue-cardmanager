const path = require('path');
const express = require('express');
const fs = require('fs-extra');
const grayMatter = require('gray-matter');
const validate = require('../lib/validation');
const { ApiError, atomicWrite, cardStorageKey, resolveInside } = require('../lib/storage');
const { readConfig } = require('../lib/config');
const { downloadImage } = require('../lib/download');
const { appendTagIfMissing, applyTypeMapping, ensureGroup } = require('../lib/tags');
const { isManagedNote } = require('../lib/managed-files');
const { replaceReferences, walk } = require('../lib/migration');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const config = await readConfig();
    if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) return res.json([]);
    const mdFiles = (await fs.readdir(config.vaultPath)).filter(file => file.endsWith('.md') && !isManagedNote(config, file));
    const cards = [];
    for (const file of mdFiles) {
      const { data } = grayMatter(await fs.readFile(path.join(config.vaultPath, file), 'utf8'));
      const rawGroups = data.Groups ?? data.Group ?? [];
      const groups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
      cards.push({ filename: file, name: data.Name || file.replace('.md', ''), ...data, Groups: groups, Group: groups });
    }
    res.json(cards);
  } catch (error) {
    Object.assign(error, { code: error.code || 'CARDS_LIST_FAILED' });
    next(error);
  }
});

router.post('/save', async (req, res, next) => {
  try {
    const { card, groups = [], collection: customCollection, type: customType } = validate.saveBody(req.body);
    const config = await readConfig();
    if (!config.vaultPath || !config.imagesPath) throw new ApiError(400, 'PATH_NOT_CONFIGURED', 'Vault path or Images path not configured');
    const storageKey = cardStorageKey(card);
    const imgFilename = `${storageKey}.jpg`;
    const noteFilename = `${storageKey}.md`;
    const collectionName = customCollection || `${card.set_name} (${card.set.toUpperCase()})`;
    const cardType = customType || applyTypeMapping(card.type_line, config.typeMapping);

    await appendTagIfMissing(config.collectionsFile, collectionName);
    for (const group of groups) await ensureGroup(config, group);
    await appendTagIfMissing(config.typesFile, cardType);

    const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
    if (imgUrl) await downloadImage(imgUrl, resolveInside(config.imagesPath, imgFilename));

    const frontmatter = {
      SchemaVersion: 2,
      ScryfallId: card.id,
      OracleId: card.oracle_id,
      SetCode: card.set.toUpperCase(),
      CollectorNumber: card.collector_number,
      Name: card.name,
      Collection: collectionName,
      Type: cardType,
      Groups: groups.map(group => String(group).trim()).filter(Boolean),
      Cover: `[[${imgFilename}]]`,
      Layout: card.layout || 'normal',
      ...(Array.isArray(card.card_faces) ? {
        Faces: card.card_faces.map(face => ({
          Name: face.name || '', ManaCost: face.mana_cost || '', Type: face.type_line || '',
          OracleText: face.oracle_text || '', FlavorText: face.flavor_text || ''
        }))
      } : {})
    };
    const content = card.oracle_text || (card.card_faces || [])
      .map(face => `## ${face.name}\n\n${face.oracle_text || ''}`.trim()).join('\n\n');
    await atomicWrite(resolveInside(config.vaultPath, noteFilename), grayMatter.stringify(content, frontmatter));
    res.json({ message: `Card ${card.name} saved successfully`, filename: noteFilename, scryfallId: card.id });
  } catch (error) {
    Object.assign(error, { code: error.code || 'CARD_SAVE_FAILED' });
    next(error);
  }
});

router.post('/:filename/resolve', async (req, res, next) => {
  try {
    const { card } = validate.resolveBody(req.body);
    const config = await readConfig();
    if (!config.vaultPath || !config.imagesPath) throw new ApiError(400, 'PATH_NOT_CONFIGURED', 'Vault path or Images path not configured');
    const mdPath = resolveInside(config.vaultPath, req.params.filename);
    if (!await fs.pathExists(mdPath)) throw new ApiError(404, 'CARD_NOT_FOUND', 'Card not found');

    const otherFiles = (await fs.readdir(config.vaultPath))
      .filter(file => file !== req.params.filename && file.toLowerCase().endsWith('.md') && !isManagedNote(config, file));
    for (const file of otherFiles) {
      try {
        const { data } = grayMatter(await fs.readFile(resolveInside(config.vaultPath, file), 'utf8'));
        if (String(data.ScryfallId || '').toLowerCase() === card.id.toLowerCase()) {
          throw new ApiError(409, 'CARD_IDENTITY_EXISTS', `This printing is already saved as ${file}`);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
      }
    }

    const parsed = grayMatter(await fs.readFile(mdPath, 'utf8'));
    const storageKey = cardStorageKey(card);
    const noteFilename = `${storageKey}.md`;
    const notePath = resolveInside(config.vaultPath, noteFilename);
    if (notePath !== mdPath && await fs.pathExists(notePath)) {
      throw new ApiError(409, 'CARD_FILENAME_EXISTS', `The target note already exists: ${noteFilename}`);
    }
    const imgFilename = `${storageKey}.jpg`;
    const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
    if (!imgUrl) throw new ApiError(400, 'CARD_IMAGE_MISSING', 'The selected printing does not provide an image');
    await downloadImage(imgUrl, resolveInside(config.imagesPath, imgFilename));

    const rawGroups = parsed.data.Groups ?? parsed.data.Group ?? [];
    const groups = (Array.isArray(rawGroups) ? rawGroups : [rawGroups]).map(value => String(value).trim()).filter(Boolean);
    const frontmatter = {
      ...parsed.data,
      SchemaVersion: 2,
      ScryfallId: card.id,
      OracleId: card.oracle_id,
      SetCode: card.set.toUpperCase(),
      CollectorNumber: card.collector_number,
      Name: card.name,
      Collection: parsed.data.Collection || `${card.set_name} (${card.set.toUpperCase()})`,
      Type: parsed.data.Type || applyTypeMapping(card.type_line, config.typeMapping),
      Groups: groups,
      Cover: `[[${imgFilename}]]`,
      Layout: card.layout || 'normal',
      ...(Array.isArray(card.card_faces) ? {
        Faces: card.card_faces.map(face => ({
          Name: face.name || '', ManaCost: face.mana_cost || '', Type: face.type_line || '',
          OracleText: face.oracle_text || '', FlavorText: face.flavor_text || ''
        }))
      } : {})
    };
    delete frontmatter.Group;
    if (!Array.isArray(card.card_faces)) delete frontmatter.Faces;
    const content = card.oracle_text || (card.card_faces || [])
      .map(face => `## ${face.name}\n\n${face.oracle_text || ''}`.trim()).join('\n\n');
    const noteContent = grayMatter.stringify(content, frontmatter);
    if (notePath === mdPath) {
      await atomicWrite(mdPath, noteContent);
    } else {
      await atomicWrite(notePath, noteContent);
      if (config.obsidianVaultPath && await fs.pathExists(config.obsidianVaultPath)) {
        const replacement = [{
          oldFilename: req.params.filename,
          newFilename: noteFilename,
          oldBasename: path.basename(req.params.filename, '.md'),
          newBasename: path.basename(noteFilename, '.md')
        }];
        for (const markdownPath of await walk(config.obsidianVaultPath, '.md')) {
          if (path.resolve(markdownPath) === path.resolve(mdPath) || path.resolve(markdownPath) === path.resolve(notePath)) continue;
          const original = await fs.readFile(markdownPath, 'utf8');
          const updated = replaceReferences(original, replacement);
          if (updated !== original) await atomicWrite(markdownPath, updated);
        }
      }
      await fs.remove(mdPath);
    }

    const oldImage = parsed.data.Cover?.match(/\[\[([^\]|]+)/)?.[1];
    if (oldImage && path.basename(oldImage) !== imgFilename) {
      const oldImagePath = resolveInside(config.imagesPath, path.basename(oldImage));
      if (await fs.pathExists(oldImagePath)) {
        const markdownFiles = config.obsidianVaultPath && await fs.pathExists(config.obsidianVaultPath)
          ? await walk(config.obsidianVaultPath, '.md') : [];
        const stillUsed = (await Promise.all(markdownFiles.map(file => fs.readFile(file, 'utf8'))))
          .some(markdown => markdown.includes(path.basename(oldImage)));
        if (!stillUsed) await fs.remove(oldImagePath);
      }
    }
    res.json({ message: `Resolved ${card.name} as ${card.set.toUpperCase()} #${card.collector_number}`, filename: noteFilename, scryfallId: card.id });
  } catch (error) {
    Object.assign(error, { code: error.code || 'CARD_RESOLVE_FAILED' });
    next(error);
  }
});

router.put('/:filename', async (req, res, next) => {
  try {
    const updates = validate.updates(req.body.updates);
    const config = await readConfig();
    const mdPath = resolveInside(config.vaultPath, req.params.filename);
    if (!await fs.pathExists(mdPath)) throw new ApiError(404, 'CARD_NOT_FOUND', 'Card not found');
    const parsed = grayMatter(await fs.readFile(mdPath, 'utf8'));
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.Group && !normalizedUpdates.Groups) {
      normalizedUpdates.Groups = Array.isArray(normalizedUpdates.Group) ? normalizedUpdates.Group : [normalizedUpdates.Group];
    }
    delete normalizedUpdates.Group;
    const newData = { ...parsed.data, ...normalizedUpdates };
    if (normalizedUpdates.Groups) delete newData.Group;
    await atomicWrite(mdPath, grayMatter.stringify(parsed.content, newData));
    if (updates.Collection) await appendTagIfMissing(config.collectionsFile, updates.Collection);
    if (updates.Type) await appendTagIfMissing(config.typesFile, updates.Type);
    for (const group of normalizedUpdates.Groups || []) await ensureGroup(config, group);
    res.json({ message: 'Card updated successfully' });
  } catch (error) {
    Object.assign(error, { code: error.code || 'CARD_UPDATE_FAILED' });
    next(error);
  }
});

router.delete('/:filename', async (req, res, next) => {
  try {
    const config = await readConfig();
    const mdPath = resolveInside(config.vaultPath, req.params.filename);
    if (!await fs.pathExists(mdPath)) throw new ApiError(404, 'CARD_NOT_FOUND', 'Card not found');
    try {
      const { data } = grayMatter(await fs.readFile(mdPath, 'utf8'));
      const image = data.Cover?.match(/\[\[(.*?)\]\]/)?.[1];
      if (image) {
        const imgPath = resolveInside(config.imagesPath, image);
        if (await fs.pathExists(imgPath)) await fs.remove(imgPath);
      }
    } catch (error) {
      console.warn('Could not delete associated image:', error.message);
    }
    await fs.remove(mdPath);
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    Object.assign(error, { code: error.code || 'CARD_DELETE_FAILED' });
    next(error);
  }
});

module.exports = router;
