from fastapi import FastAPI
import uvicorn

from .config import get_settings
from .middleware.firewall import FirewallMiddleware
from .routers import system, pdf, ollama


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="DGX Server Tools",
        description=(
            "PDF processor + Ollama proxy for DGX Spark/Station/H100 "
            "and any Linux/Windows/macOS machine."
        ),
        version="1.0.0",
    )

    # Firewall must be the outermost middleware
    app.add_middleware(FirewallMiddleware, settings=settings)

    app.include_router(system.router, tags=["System"])
    app.include_router(pdf.router, tags=["PDF"])
    app.include_router(ollama.router, tags=["Ollama"])

    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
