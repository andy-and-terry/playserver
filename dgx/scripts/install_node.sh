#!/usr/bin/env bash
# install_node.sh — install Node.js dependencies for the DGX server-node implementation
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DGX_DIR="$(dirname "$SCRIPT_DIR")"
NODE_DIR="$DGX_DIR/server-node"

echo "=== DGX Server Tools — Node.js installer ==="

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "  Download: https://nodejs.org  (v18 or newer recommended)"
    exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
    echo "WARNING: Node.js $NODE_MAJOR detected; v18+ is recommended."
fi

# Install npm dependencies
cd "$NODE_DIR"
npm install
echo "✓ Node.js dependencies installed"

# Copy .env.example → .env if not already present
if [ ! -f "$DGX_DIR/.env" ]; then
    cp "$DGX_DIR/.env.example" "$DGX_DIR/.env"
    echo "✓ Created .env from .env.example — edit it to customise settings"
fi

echo ""
echo "Done! Run ./scripts/run_node.sh to start the Node.js server."
