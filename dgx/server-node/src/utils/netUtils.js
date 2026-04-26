/**
 * netUtils.js — lightweight IPv4/IPv6 CIDR helpers (no external deps).
 */

'use strict';

/**
 * Returns true if *ip* (IPv4 string) falls within *cidr*.
 * Also handles plain IPs without a prefix (exact match).
 */
function isIPv4InCIDR(ip, cidr) {
  if (!cidr.includes('/')) return ip === cidr;

  const [network, prefixStr] = cidr.split('/');
  const prefixLen = parseInt(prefixStr, 10);
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null) return false;

  const mask = prefixLen === 0 ? 0 : ((0xffffffff << (32 - prefixLen)) >>> 0);
  return (ipInt & mask) === (netInt & mask);
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Returns true if *ip* matches *cidr*.
 * Handles IPv4, IPv4-mapped IPv6 (::ffff:x.x.x.x), and plain-IP rules.
 */
function isInCIDR(ip, cidr) {
  // Normalise IPv4-mapped IPv6 addresses
  const normalised = ip.replace(/^::ffff:/i, '');
  return isIPv4InCIDR(normalised, cidr);
}

module.exports = { isInCIDR };
