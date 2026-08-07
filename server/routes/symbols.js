const path = require('path');
const express = require('express');
const fs = require('fs-extra');
const axios = require('axios');
const { atomicWriteJson } = require('../lib/storage');
const { downloadImage } = require('../lib/download');

module.exports = function createSymbolsRouter(symbolsDir) {
  const router = express.Router();
  router.get('/', async (req, res, next) => {
    try {
      const symbolsFile = path.join(symbolsDir, 'symbols.json');
      res.json(await fs.pathExists(symbolsFile) ? await fs.readJson(symbolsFile) : []);
    } catch (error) {
      Object.assign(error, { status: 500, code: 'SYMBOLS_READ_FAILED' });
      next(error);
    }
  });
  router.post('/sync', async (req, res, next) => {
    try {
      const response = await axios.get('https://api.scryfall.com/symbology');
      const symbology = response.data.data;
      for (const item of symbology) {
        if (item.svg_uri) await downloadImage(item.svg_uri, path.join(symbolsDir, `${item.symbol.replace(/[/{}]/g, '')}.svg`));
      }
      const mapping = symbology.map(item => ({
        symbol: item.symbol,
        loose_variant: item.loose_variant,
        english: item.english,
        local_path: `/symbols/${item.symbol.replace(/[/{}]/g, '')}.svg`
      }));
      await atomicWriteJson(path.join(symbolsDir, 'symbols.json'), mapping);
      res.json({ message: 'Symbology synced successfully', count: mapping.length });
    } catch (error) {
      Object.assign(error, { status: 500, code: 'SYMBOLS_SYNC_FAILED' });
      next(error);
    }
  });
  return router;
};
