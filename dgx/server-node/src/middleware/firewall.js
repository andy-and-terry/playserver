/**
 * firewall.js — Express middleware providing:
 *   1. IP blocklist  (BLOCKED_IPS  env — comma-separated IPs/CIDRs)
 *   2. IP allowlist  (ALLOWED_IPS  env — comma-separated IPs/CIDRs; empty = allow all)
 *   3. Per-IP sliding-window rate limiter (RATE_LIMIT_PER_MINUTE env; 0 = disabled)
 */

'use strict';

const config = require('../config');
const { isInCIDR } = require('../utils/netUtils');

// Map<ip, number[]>  — timestamps (ms) of recent requests
const _rateLimitStore = new Map();

function _parseNetworks(str) {
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function _ipInNetworks(ip, networks) {
  return networks.some((cidr) => isInCIDR(ip, cidr));
}

function _cleanIp(raw) {
  return (raw || '').replace(/^::ffff:/i, '');
}

function firewall(req, res, next) {
  if (!config.FIREWALL_ENABLED) return next();

  const raw = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const clientIp = _cleanIp(raw);

  // 1. Blocklist
  if (config.BLOCKED_IPS) {
    const blocked = _parseNetworks(config.BLOCKED_IPS);
    if (_ipInNetworks(clientIp, blocked)) {
      return res.status(403).json({ detail: 'Forbidden' });
    }
  }

  // 2. Allowlist (empty = allow everyone)
  if (config.ALLOWED_IPS) {
    const allowed = _parseNetworks(config.ALLOWED_IPS);
    if (!_ipInNetworks(clientIp, allowed)) {
      return res.status(403).json({ detail: 'Forbidden' });
    }
  }

  // 3. Rate limiting
  if (config.RATE_LIMIT_PER_MINUTE > 0) {
    const now = Date.now();
    const window = 60_000;
    let timestamps = _rateLimitStore.get(clientIp) || [];
    timestamps = timestamps.filter((t) => now - t < window);

    if (timestamps.length >= config.RATE_LIMIT_PER_MINUTE) {
      _rateLimitStore.set(clientIp, timestamps);
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ detail: 'Rate limit exceeded. Try again later.' });
    }

    timestamps.push(now);
    _rateLimitStore.set(clientIp, timestamps);
  }

  next();
}

module.exports = { firewall };
