#!/usr/bin/env bash
# run_node.sh — start the Node.js / Express DGX server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DGX_DIR="$(dirname "$SCRIPT_DIR")"
NODE_DIR="$DGX_DIR/server-node"

# Load .env if present
if [ -f "$DGX_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$DGX_DIR/.env"
    set +a
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

if [ ! -d "$NODE_DIR/node_modules" ]; then
    echo "ERROR: node_modules not found. Run ./scripts/install_node.sh first."
    exit 1
fi

echo "Starting DGX Server Tools (Node.js/Express) on http://$HOST:$PORT"
cd "$NODE_DIR"
node src/index.js
