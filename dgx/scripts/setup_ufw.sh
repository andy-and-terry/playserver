#!/usr/bin/env bash
# setup_ufw.sh — optional OS-level UFW firewall for the DGX server
#
# Usage (must run as root):
#   sudo bash scripts/setup_ufw.sh [PORT] [LAN_CIDR]
#
# Examples:
#   sudo bash scripts/setup_ufw.sh 8000 192.168.1.0/24   # LAN-only
#   sudo bash scripts/setup_ufw.sh 8000                  # all IPs
set -euo pipefail

PORT="${1:-8000}"
LAN_CIDR="${2:-}"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (use sudo)."
    exit 1
fi

if ! command -v ufw &>/dev/null; then
    echo "UFW is not installed. Install it with: sudo apt install ufw"
    exit 1
fi

echo "=== DGX Server Tools — UFW firewall setup ==="

# Make sure SSH is allowed before enabling UFW (prevent lockout)
ufw allow ssh

# Enable UFW non-interactively
ufw --force enable

if [[ -n "$LAN_CIDR" ]]; then
    echo "Restricting port $PORT to LAN CIDR: $LAN_CIDR"
    ufw allow from "$LAN_CIDR" to any port "$PORT" proto tcp
    # Node.js server is one port higher by default
    NODE_PORT=$((PORT + 1))
    ufw allow from "$LAN_CIDR" to any port "$NODE_PORT" proto tcp
else
    echo "Allowing port $PORT from all IPs (pass a CIDR as second arg to restrict)"
    ufw allow "$PORT/tcp"
    NODE_PORT=$((PORT + 1))
    ufw allow "$NODE_PORT/tcp"
fi

ufw reload
ufw status verbose

echo ""
echo "UFW rules applied."
echo "To remove later:"
echo "  sudo ufw delete allow $PORT/tcp"
echo "  sudo ufw delete allow $NODE_PORT/tcp"
