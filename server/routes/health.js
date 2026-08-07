const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ status: 'ok', message: 'MTG Card Manager Server is running' }));

module.exports = router;
