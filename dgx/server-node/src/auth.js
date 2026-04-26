/**
 * auth.js — Express middleware that enforces X-API-Token header.
 *
 * Developer convenience: when API_TOKEN is "changeme" and the request
 * originates from localhost, the check is skipped so you can test without
 * a token.
 */

const config = require('./config');

function requireAuth(req, res, next) {
  const token = config.API_TOKEN;

  // Skip auth for localhost when using the default dev token
  if (token === 'changeme') {
    const raw = req.ip || (req.connection && req.connection.remoteAddress) || '';
    const clientIp = raw.replace(/^::ffff:/, '');
    if (clientIp === '127.0.0.1' || clientIp === '::1') {
      return next();
    }
  }

  const provided = req.headers['x-api-token'];
  if (!provided || provided !== token) {
    return res.status(401).json({ detail: 'Invalid or missing X-API-Token header' });
  }
  next();
}

module.exports = { requireAuth };
