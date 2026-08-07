const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const { errorPayload } = require('./lib/storage');
const { ensureConfig } = require('./lib/config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SYMBOLS_DIR = path.join(__dirname, 'public', 'symbols');
const SETS_DIR = path.join(__dirname, 'public', 'sets');
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: [CLIENT_ORIGIN, CLIENT_ORIGIN.replace('localhost', '127.0.0.1')] }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/symbols', express.static(SYMBOLS_DIR, {
  immutable: true,
  maxAge: '30d',
  setHeaders: response => response.setHeader('X-Content-Type-Options', 'nosniff')
}));

app.use('/health', require('./routes/health'));
app.use('/api/config', require('./routes/config'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/images', require('./routes/images'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/migrations', require('./routes/migrations'));
app.use('/api/symbols', require('./routes/symbols')(SYMBOLS_DIR));
app.use('/api/sets', require('./routes/sets')(SETS_DIR));

app.use((error, req, res, next) => {
  console.error(JSON.stringify({
    level: 'error', method: req.method, path: req.path, code: error.code, message: error.message
  }));
  res.status(error.status || 500).json(errorPayload(error));
});

async function initialize() {
  await Promise.all([ensureConfig(), fs.ensureDir(SYMBOLS_DIR), fs.ensureDir(SETS_DIR)]);
}

async function startServer(port = PORT) {
  await initialize();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`Server is running on http://127.0.0.1:${server.address().port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { app, startServer };
