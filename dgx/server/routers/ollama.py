import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..auth import require_auth
from ..config import get_settings

router = APIRouter()

_UNAVAILABLE = {
    "detail": "Ollama not configured. Set OLLAMA_BASE_URL in .env"
}


def _unavailable():
    return JSONResponse(_UNAVAILABLE, status_code=503)


@router.get("/ollama/models")
async def list_models(_: None = Depends(require_auth)):
    settings = get_settings()
    if not settings.OLLAMA_BASE_URL:
        return _unavailable()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
        return r.json()


@router.post("/ollama/pull")
async def pull_model(request: Request, _: None = Depends(require_auth)):
    settings = get_settings()
    if not settings.OLLAMA_BASE_URL:
        return _unavailable()
    body = await request.body()

    async def _stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_BASE_URL}/api/pull", content=body
            ) as r:
                async for chunk in r.aiter_bytes():
                    yield chunk

    return StreamingResponse(_stream(), media_type="application/x-ndjson")


@router.post("/ollama/generate")
async def generate(request: Request, _: None = Depends(require_auth)):
    settings = get_settings()
    if not settings.OLLAMA_BASE_URL:
        return _unavailable()
    body = await request.body()

    async def _stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_BASE_URL}/api/generate", content=body
            ) as r:
                async for chunk in r.aiter_bytes():
                    yield chunk

    return StreamingResponse(_stream(), media_type="application/x-ndjson")


@router.post("/ollama/chat")
async def chat(request: Request, _: None = Depends(require_auth)):
    settings = get_settings()
    if not settings.OLLAMA_BASE_URL:
        return _unavailable()
    body = await request.body()

    async def _stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_BASE_URL}/api/chat", content=body
            ) as r:
                async for chunk in r.aiter_bytes():
                    yield chunk

    return StreamingResponse(_stream(), media_type="application/x-ndjson")
