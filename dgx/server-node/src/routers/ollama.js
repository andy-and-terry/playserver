'use strict';

const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../auth');
const config = require('../config');

const router = express.Router();

function ollamaUnavailable(res) {
  return res.status(503).json({
    detail: 'Ollama not configured. Set OLLAMA_BASE_URL in .env',
  });
}

router.get('/ollama/models', requireAuth, async (req, res) => {
  if (!config.OLLAMA_BASE_URL) return ollamaUnavailable(res);
  try {
    const r = await axios.get(`${config.OLLAMA_BASE_URL}/api/tags`, { timeout: 30_000 });
    res.json(r.data);
  } catch (err) {
    res.status(502).json({ detail: `Ollama error: ${err.message}` });
  }
});

router.post('/ollama/pull', requireAuth, express.json(), async (req, res) => {
  if (!config.OLLAMA_BASE_URL) return ollamaUnavailable(res);
  try {
    const r = await axios.post(`${config.OLLAMA_BASE_URL}/api/pull`, req.body, {
      responseType: 'stream',
      timeout: 0,
    });
    res.setHeader('Content-Type', 'application/x-ndjson');
    r.data.pipe(res);
  } catch (err) {
    res.status(502).json({ detail: `Ollama error: ${err.message}` });
  }
});

router.post('/ollama/generate', requireAuth, express.json(), async (req, res) => {
  if (!config.OLLAMA_BASE_URL) return ollamaUnavailable(res);
  try {
    const r = await axios.post(`${config.OLLAMA_BASE_URL}/api/generate`, req.body, {
      responseType: 'stream',
      timeout: 0,
    });
    res.setHeader('Content-Type', 'application/x-ndjson');
    r.data.pipe(res);
  } catch (err) {
    res.status(502).json({ detail: `Ollama error: ${err.message}` });
  }
});

router.post('/ollama/chat', requireAuth, express.json(), async (req, res) => {
  if (!config.OLLAMA_BASE_URL) return ollamaUnavailable(res);
  try {
    const r = await axios.post(`${config.OLLAMA_BASE_URL}/api/chat`, req.body, {
      responseType: 'stream',
      timeout: 0,
    });
    res.setHeader('Content-Type', 'application/x-ndjson');
    r.data.pipe(res);
  } catch (err) {
    res.status(502).json({ detail: `Ollama error: ${err.message}` });
  }
});

module.exports = router;
