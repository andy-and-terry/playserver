"""
GPU detection via nvidia-smi.
Returns graceful fallback when NVIDIA tooling is unavailable so the server
works on any machine (DGX, regular Linux, macOS, Windows).
"""

import shutil
import subprocess
from typing import Any


def get_gpu_info() -> dict[str, Any]:
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return {"gpus": [], "nvidia_available": False}

    try:
        result = subprocess.run(
            [
                nvidia_smi,
                "--query-gpu=name,memory.total,memory.used,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return {
                "gpus": [],
                "nvidia_available": False,
                "error": result.stderr.strip(),
            }

        gpus = []
        for line in result.stdout.strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 4:
                continue

            def _to_int(val: str):
                try:
                    return int(val)
                except ValueError:
                    return val

            gpus.append(
                {
                    "name": parts[0],
                    "memory_total_mb": _to_int(parts[1]),
                    "memory_used_mb": _to_int(parts[2]),
                    "utilization_pct": _to_int(parts[3]),
                }
            )
        return {"gpus": gpus, "nvidia_available": True}

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
        return {"gpus": [], "nvidia_available": False, "error": str(exc)}
