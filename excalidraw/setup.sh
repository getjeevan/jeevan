#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Starting Excalidraw diagram viewer..."
docker-compose up -d

echo -n "==> Waiting for Excalidraw..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:3333 > /dev/null 2>&1; then
    echo " READY"
    break
  fi
  sleep 2
  echo -n "."
done

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "======================================================"
echo "  Excalidraw is ready — diagram loads automatically"
echo "======================================================"
echo ""
echo "  Open:  http://${SERVER_IP}:3333"
echo ""
