const express = require('express');
const fs = require('fs-extra');
const { ApiError, resolveInside } = require('../lib/storage');
const { readConfig } = require('../lib/config');

const router = express.Router();

router.get('/:filename', async (req, res, next) => {
  try {
    const config = await readConfig();
    if (!config.imagesPath) throw new ApiError(400, 'PATH_NOT_CONFIGURED', 'Images path not configured');
    const imgPath = resolveInside(config.imagesPath, req.params.filename);
    if (!await fs.pathExists(imgPath)) throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    res.sendFile(imgPath);
  } catch (error) { next(error); }
});

module.exports = router;
