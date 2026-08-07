const express = require('express');
const { auditCards } = require('../lib/card-audit');
const { readConfig } = require('../lib/config');

const router = express.Router();

router.get('/cards', async (req, res, next) => {
  try { res.json(await auditCards(await readConfig())); } catch (error) { next(error); }
});

module.exports = router;
