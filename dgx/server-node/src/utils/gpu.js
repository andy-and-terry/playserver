/**
 * gpu.js — detect NVIDIA GPUs via nvidia-smi subprocess call.
 * Returns a graceful fallback when nvidia-smi is unavailable.
 */

'use strict';

const { execSync } = require('child_process');

function getGpuInfo() {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits',
      { timeout: 10_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();

    const gpus = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((s) => s.trim());
        if (parts.length < 4) return null;
        return {
          name: parts[0],
          memory_total_mb: parseInt(parts[1], 10) || parts[1],
          memory_used_mb: parseInt(parts[2], 10) || parts[2],
          utilization_pct: parseInt(parts[3], 10) || parts[3],
        };
      })
      .filter(Boolean);

    return { gpus, nvidia_available: true };
  } catch {
    return { gpus: [], nvidia_available: false };
  }
}

module.exports = { getGpuInfo };
