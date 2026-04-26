import platform
import sys
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, Depends

from ..auth import require_auth
from ..utils.gpu import get_gpu_info

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/system/info")
async def system_info(_: None = Depends(require_auth)):
    mem = psutil.virtual_memory()
    return {
        "python_version": sys.version,
        "os": platform.system(),
        "platform": platform.platform(),
        "cpu_count": psutil.cpu_count(logical=True),
        "ram": {
            "total_mb": mem.total // (1024 * 1024),
            "available_mb": mem.available // (1024 * 1024),
        },
        **get_gpu_info(),
    }
