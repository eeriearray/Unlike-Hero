#!/bin/bash
# One command to run the hub for friends: stops an old copy that is still holding the port, installs packages if
# needed, starts the hub, and prints (and copies) the link to share. Run `npm run play`, or double-click
# "Start Hub.command" in Finder. Ctrl+C stops the hub.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-8080}"

# An older hub left running would block the port: stop it. Anything else on the port means use the next one.
for pid in $(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null); do
  if ps -o command= -p "$pid" | grep -q "server/relay.mjs"; then echo "Stopping the old hub (pid $pid)…"; kill "$pid"; sleep 1; fi
done
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do PORT=$((PORT + 1)); done

# Packages: install on first run, or when package-lock.json changed since the last install (e.g. after git pull)
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing packages…"; npm install --no-audit --no-fund || exit 1
fi

# The link to share: a normal Wi-Fi address if there is one (works on every phone); on an IPv6-only hotspot, the
# Mac's .local name (stays valid when the hotspot hands out a new address) with the raw IPv6 address as a fallback.
NAME=$(scutil --get LocalHostName 2>/dev/null)
LOCAL=${NAME:+http://$NAME.local:$PORT}
IP4=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
case "$IP4" in 192.0.0.*|169.254.*) IP4="";; esac
IP6=$(ifconfig 2>/dev/null | awk '/inet6 [23][0-9a-f]+:/ && /autoconf secured/ && !/temporary|clat46|deprecated/ {print $2; exit}')
if [ -n "$IP4" ]; then SHARE="http://$IP4:$PORT"; ALT="$LOCAL"
elif [ -n "$IP6" ]; then SHARE="${LOCAL:-http://[$IP6]:$PORT}"; ALT="http://[$IP6]:$PORT"
else SHARE=""; fi

echo
echo "=================================================================="
if [ -n "$SHARE" ]; then
  echo "  Share this link with friends on the same Wi-Fi or hotspot:"
  echo
  echo "      $SHARE"
  [ -n "$ALT" ] && [ "$ALT" != "$SHARE" ] && echo "      (if it doesn't open: $ALT)"
  echo
  echo "  It's copied to your clipboard, and opens on this Mac in a moment."
  printf '%s' "$SHARE" | pbcopy 2>/dev/null
else
  echo "  This Mac isn't on Wi-Fi, so only it can play: http://localhost:$PORT"
  echo "  Join the same Wi-Fi or phone hotspot as your friends, then run this again."
fi
echo "  Keep this window open while you play. Ctrl+C stops the hub."
echo "=================================================================="
echo

# Open the link here once the hub is listening, so invite links and QR codes use the shared address
( for _ in $(seq 1 40); do lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1 && break; sleep 0.25; done
  open "${SHARE:-http://localhost:$PORT}" 2>/dev/null ) &

PORT="$PORT" exec node server/relay.mjs
