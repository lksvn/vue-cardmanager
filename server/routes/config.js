const express = require('express');
const validate = require('../lib/validation');
const { readConfig, writeConfig, initialConfig } = require('../lib/config');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try { res.json(await readConfig()); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    await writeConfig({ ...initialConfig, ...validate.config(req.body) });
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) { next(error); }
});

module.exports = router;
