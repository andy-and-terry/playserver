#!/usr/bin/env bash
# run_docker.sh — build and start all DGX services via docker compose
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DGX_DIR="$(dirname "$SCRIPT_DIR")"

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed. See https://docs.docker.com/get-docker/"
    exit 1
fi

# Copy .env.example → .env if not already present
if [ ! -f "$DGX_DIR/.env" ]; then
    cp "$DGX_DIR/.env.example" "$DGX_DIR/.env"
    echo "Created .env from .env.example — edit it before re-running."
fi

cd "$DGX_DIR"

echo "Starting DGX Server Tools via Docker Compose..."
echo "  Python server  → http://localhost:8000"
echo "  Node.js server → http://localhost:8001"
echo ""
echo "To also start Ollama (requires NVIDIA Container Toolkit):"
echo "  docker compose --profile ollama up --build"
echo ""
docker compose up --build "$@"
