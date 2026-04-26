from typing import Optional

from fastapi import Header, HTTPException, Request

from .config import get_settings


async def require_auth(
    request: Request,
    x_api_token: Optional[str] = Header(default=None),
) -> None:
    settings = get_settings()
    token = settings.API_TOKEN

    # Developer convenience: skip auth for localhost when using the default token
    if token == "changeme":
        client_host = request.client.host if request.client else ""
        if client_host in ("127.0.0.1", "::1", "localhost"):
            return

    if not x_api_token or x_api_token != token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-API-Token header",
            headers={"WWW-Authenticate": "Token"},
        )
