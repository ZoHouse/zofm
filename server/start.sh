#!/bin/bash
set -e

echo "[start] Launching Zo FM Radio Server..."

# Create directories
mkdir -p /var/log/icecast2 /audio/songs /audio/dj

# Start Icecast in background (run as root in container)
echo "[start] Starting Icecast2 on 0.0.0.0:8000..."
icecast2 -c /etc/icecast2/icecast.xml &

# Wait for Icecast to bind
sleep 3
echo "[start] Icecast started."

# Start the Node.js radio server
echo "[start] Starting radio server..."
exec node /app/index.js
