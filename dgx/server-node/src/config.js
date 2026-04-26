/**
 * config.js — reads settings from environment / .env file.
 * Loaded once at startup; all modules import this object.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Core
  API_TOKEN: process.env.DGX_API_TOKEN || process.env.API_TOKEN || 'changeme',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || '',
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '../../data'),
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '8000', 10),
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || '200', 10),

  // Firewall
  FIREWALL_ENABLED: process.env.FIREWALL_ENABLED !== 'false',
  ALLOWED_IPS: process.env.ALLOWED_IPS || '',   // comma-separated CIDRs; empty = allow all
  BLOCKED_IPS: process.env.BLOCKED_IPS || '',   // comma-separated IPs/CIDRs to block
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
};

module.exports = config;
