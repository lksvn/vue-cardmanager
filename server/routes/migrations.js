const express = require('express');
const { applyMigration, buildPreview, migrationStatus, rollbackMigration } = require('../lib/migration');
const { readConfig, writeConfig } = require('../lib/config');

const router = express.Router();

router.post('/card-schema/preview', async (req, res, next) => {
  try {
    const preview = await buildPreview(await readConfig());
    const { actions, replacements, linkFiles, ...publicPreview } = preview;
    res.json(publicPreview);
  } catch (error) { next(error); }
});

router.post('/card-schema/apply', async (req, res, next) => {
  try {
    const config = await readConfig();
    const result = await applyMigration(config, req.body);
    await writeConfig({ ...config, schemaVersion: 2 });
    res.json(result);
  } catch (error) { next(error); }
});

router.get('/card-schema/status', async (req, res, next) => {
  try { res.json(await migrationStatus(await readConfig())); } catch (error) { next(error); }
});

router.post('/card-schema/:migrationId/rollback', async (req, res, next) => {
  try {
    const config = await readConfig();
    const result = await rollbackMigration(config, req.params.migrationId);
    await writeConfig({ ...config, schemaVersion: 1 });
    res.json(result);
  } catch (error) { next(error); }
});

module.exports = router;
