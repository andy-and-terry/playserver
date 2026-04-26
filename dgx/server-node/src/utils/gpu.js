/**
 * gpu.js — detect NVIDIA GPUs via nvidia-smi subprocess call.
 * Returns a graceful fallback when nvidia-smi is unavailable.
 */

'use strict';

const { execFileSync } = require('child_process');

function getGpuInfo() {
  try {
    const output = execFileSync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total,memory.used,utilization.gpu', '--format=csv,noheader,nounits'],
      { timeout: 10_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();

    const gpus = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((s) => s.trim());
        if (parts.length < 4) return null;
        const toInt = (s) => { const n = parseInt(s, 10); return isNaN(n) ? null : n; };
        return {
          name: parts[0],
          memory_total_mb: toInt(parts[1]),
          memory_used_mb: toInt(parts[2]),
          utilization_pct: toInt(parts[3]),
        };
      })
      .filter(Boolean);

    return { gpus, nvidia_available: true };
  } catch {
    return { gpus: [], nvidia_available: false };
  }
}

module.exports = { getGpuInfo };
