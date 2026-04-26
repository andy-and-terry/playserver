#!/usr/bin/env bash
# install.sh — create a Python venv and install dependencies for the DGX server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DGX_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== DGX Server Tools — Python installer ==="

# Create virtual environment
python3 -m venv "$DGX_DIR/.venv"
echo "✓ Virtual environment created at $DGX_DIR/.venv"

# Upgrade pip and install dependencies
"$DGX_DIR/.venv/bin/pip" install --upgrade pip -q
"$DGX_DIR/.venv/bin/pip" install -r "$DGX_DIR/requirements.txt" -q
echo "✓ Python dependencies installed"

# Copy .env.example → .env if not already present
if [ ! -f "$DGX_DIR/.env" ]; then
    cp "$DGX_DIR/.env.example" "$DGX_DIR/.env"
    echo "✓ Created .env from .env.example — edit it to customise settings"
fi

echo ""
echo "Optional: install Ghostscript for better PDF compression:"
echo "  Ubuntu/Debian : sudo apt install ghostscript"
echo "  macOS         : brew install ghostscript"
echo "  Windows       : https://www.ghostscript.com/download/gsdnld.html"
echo ""
echo "Set a strong API token before exposing this service to a network:"
echo "  echo DGX_API_TOKEN=your-secret >> $DGX_DIR/.env"
echo ""
echo "Done! Run ./scripts/run.sh to start the Python server."
