'use strict';

const express = require('express');
const os = require('os');
const { requireAuth } = require('../auth');
const { getGpuInfo } = require('../utils/gpu');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/system/info', requireAuth, (_req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  res.json({
    node_version: process.version,
    os: os.type(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpu_count: os.cpus().length,
    ram: {
      total_mb: Math.floor(totalMem / (1024 * 1024)),
      available_mb: Math.floor(freeMem / (1024 * 1024)),
    },
    ...getGpuInfo(),
  });
});

module.exports = router;
