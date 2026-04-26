'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const config = require('./config');
const { firewall } = require('./middleware/firewall');
const systemRouter = require('./routers/system');
const pdfRouter = require('./routers/pdf');
const ollamaRouter = require('./routers/ollama');

const app = express();

// Trust proxy so req.ip reflects the real client IP behind a reverse proxy
app.set('trust proxy', 1);

// Body parsing (for JSON routes; multer handles multipart separately)
app.use(express.json({ limit: `${config.MAX_UPLOAD_MB}mb` }));

// ── Firewall (runs before every route) ───────────────────────────────────────
app.use(firewall);

// ── Routers ───────────────────────────────────────────────────────────────────
app.use(systemRouter);
app.use(pdfRouter);
app.use(ollamaRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ detail: 'Not Found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ detail: `File exceeds ${config.MAX_UPLOAD_MB} MB limit` });
  }
  console.error(err);
  res.status(500).json({ detail: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.PORT, config.HOST, () => {
  console.log(`DGX Server Tools (Node.js/Express) → http://${config.HOST}:${config.PORT}`);
  console.log(`  Firewall : ${config.FIREWALL_ENABLED ? 'enabled' : 'disabled'}`);
  console.log(`  Ollama   : ${config.OLLAMA_BASE_URL || 'not configured (set OLLAMA_BASE_URL)'}`);
});

module.exports = app;
