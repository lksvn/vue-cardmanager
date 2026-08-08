const express = require('express');
const validate = require('../lib/validation');
const { readConfig } = require('../lib/config');
const { readQueries, saveQuery } = require('../lib/queries');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try { res.json({ queries: await readQueries(await readConfig()) }); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await saveQuery(await readConfig(), validate.queryBody(req.body))); } catch (error) { next(error); }
});

module.exports = router;
