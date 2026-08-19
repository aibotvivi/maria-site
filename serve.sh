#!/bin/bash
# Preview the Maria landing page locally.
#   ./serve.sh            -> http://localhost:8799
# Also printed: your LAN address, so you can open it on your phone.
cd "$(dirname "$0")"
PORT="${1:-8799}"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo "Local:  http://localhost:$PORT"
[ -n "$IP" ] && echo "Phone:  http://$IP:$PORT   (same wifi)"
python3 -m http.server "$PORT"
