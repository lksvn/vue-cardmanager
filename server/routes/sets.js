const express = require('express');
const fs = require('fs-extra');
const axios = require('axios');
const { ApiError, resolveInside } = require('../lib/storage');
const { downloadImage } = require('../lib/download');

module.exports = function createSetsRouter(setsDir) {
  const router = express.Router();
  router.get('/:code/icon', async (req, res, next) => {
    try {
      const code = String(req.params.code || '').toLowerCase();
      if (!/^[a-z0-9]{1,10}$/.test(code)) throw new ApiError(400, 'INVALID_SET_CODE', 'Invalid set code');
      const iconPath = resolveInside(setsDir, `${code}.svg`);
      if (!await fs.pathExists(iconPath)) {
        const response = await axios.get(`https://api.scryfall.com/sets/${code}`);
        if (!response.data.icon_svg_uri) throw new ApiError(404, 'SET_ICON_NOT_FOUND', 'Icon not found for set');
        await downloadImage(response.data.icon_svg_uri, iconPath);
      }
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      res.sendFile(iconPath);
    } catch (error) {
      if (!error.status) Object.assign(error, { status: 500, code: 'SET_ICON_FAILED' });
      next(error);
    }
  });
  return router;
};
