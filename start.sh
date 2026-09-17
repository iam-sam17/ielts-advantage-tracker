#!/bin/bash
# IELTS Advantage Vault - Local Server Launcher
# Double-click to start, or run: bash start.sh

# Get the directory where this script is located
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IELTS Advantage Vault - Local Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Opening: http://localhost:8080"
echo ""
echo "  Press CTRL+C to stop the server."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Open browser after a short delay
(sleep 1.5 && xdg-open "http://localhost:8080" 2>/dev/null || open "http://localhost:8080" 2>/dev/null) &

# Start the server
cd "$DIR"
python3 -m http.server 8080
