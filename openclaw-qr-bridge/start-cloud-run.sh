#!/bin/sh
set -eu
export HOME="${HOME:-/home/node}"
export OPENCLAW_HOME="${OPENCLAW_HOME:-/home/node/.openclaw}"
mkdir -p "$OPENCLAW_HOME"
if [ -d /mnt/openclaw-state/openclaw-state/.openclaw ]; then
  cp -a /mnt/openclaw-state/openclaw-state/.openclaw/. "$OPENCLAW_HOME"/
fi
node dist/index.js plugins install npm:@openclaw/whatsapp --force || true
node dist/index.js gateway --allow-unconfigured --bind lan --port 18789 &
gateway_pid=$!
trap 'kill "$gateway_pid" 2>/dev/null || true' EXIT INT TERM
exec node /opt/openclaw/bridge.mjs
