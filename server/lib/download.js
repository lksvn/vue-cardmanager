const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

async function downloadImage(url, filepath) {
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  const temporary = `${filepath}.${process.pid}.tmp`;
  await fs.ensureDir(path.dirname(filepath));
  return new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(temporary))
      .on('error', async error => {
        await fs.remove(temporary).catch(() => {});
        reject(error);
      })
      .on('finish', async () => {
        try {
          await fs.move(temporary, filepath, { overwrite: true });
          resolve();
        } catch (error) {
          await fs.remove(temporary).catch(() => {});
          reject(error);
        }
      });
  });
}

module.exports = { downloadImage };
