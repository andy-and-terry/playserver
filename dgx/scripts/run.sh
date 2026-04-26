#!/usr/bin/env bash
# run.sh — activate the Python venv and start the FastAPI server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DGX_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$DGX_DIR/server"

# Load .env if present
if [ -f "$DGX_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$DGX_DIR/.env"
    set +a
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

if [ ! -f "$DGX_DIR/.venv/bin/uvicorn" ]; then
    echo "ERROR: venv not found. Run ./scripts/install.sh first."
    exit 1
fi

echo "Starting DGX Server Tools (Python/FastAPI) on http://$HOST:$PORT"
cd "$SERVER_DIR"
"$DGX_DIR/.venv/bin/uvicorn" main:app --host "$HOST" --port "$PORT" --reload
