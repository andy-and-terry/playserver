"""
Firewall middleware for DGX Server Tools.

Features:
- IP blocklist  (BLOCKED_IPS  env var — comma-separated IPs/CIDRs)
- IP allowlist  (ALLOWED_IPS  env var — comma-separated IPs/CIDRs; empty = allow all)
- Per-IP rate limiting (RATE_LIMIT_PER_MINUTE env var; 0 = disabled)
"""

import ipaddress
import threading
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class FirewallMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings):
        super().__init__(app)
        self.settings = settings
        self._rate_data: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_networks(ip_str: str):
        networks = []
        for part in ip_str.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                networks.append(ipaddress.ip_network(part, strict=False))
            except ValueError:
                pass
        return networks

    @staticmethod
    def _ip_in_networks(ip: str, networks) -> bool:
        try:
            addr = ipaddress.ip_address(ip)
            return any(addr in net for net in networks)
        except ValueError:
            return False

    # ── dispatch ─────────────────────────────────────────────────────────────

    async def dispatch(self, request: Request, call_next):
        if not self.settings.FIREWALL_ENABLED:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"

        # 1. Blocklist check
        if self.settings.BLOCKED_IPS:
            blocked = self._parse_networks(self.settings.BLOCKED_IPS)
            if self._ip_in_networks(client_ip, blocked):
                return JSONResponse({"detail": "Forbidden"}, status_code=403)

        # 2. Allowlist check (empty string = allow everyone)
        if self.settings.ALLOWED_IPS:
            allowed = self._parse_networks(self.settings.ALLOWED_IPS)
            if not self._ip_in_networks(client_ip, allowed):
                return JSONResponse({"detail": "Forbidden"}, status_code=403)

        # 3. Rate limiting (sliding-window per IP)
        if self.settings.RATE_LIMIT_PER_MINUTE > 0:
            now = time.monotonic()
            window = 60.0
            with self._lock:
                timestamps = self._rate_data[client_ip]
                timestamps = [t for t in timestamps if now - t < window]
                if len(timestamps) >= self.settings.RATE_LIMIT_PER_MINUTE:
                    self._rate_data[client_ip] = timestamps
                    return JSONResponse(
                        {"detail": "Rate limit exceeded. Try again later."},
                        status_code=429,
                        headers={"Retry-After": "60"},
                    )
                timestamps.append(now)
                self._rate_data[client_ip] = timestamps

        return await call_next(request)
