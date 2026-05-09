#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Starting Excalidraw..."
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
echo "  Excalidraw is running"
echo "======================================================"
echo ""
echo "  Open in browser:  http://${SERVER_IP}:3333"
echo ""
echo "  To load the architecture diagram:"
echo "    1. Open http://${SERVER_IP}:3333"
echo "    2. Click the folder icon (top left) > Open"
echo "    3. Select:  diagrams/architecture.excalidraw"
echo ""
echo "  Or copy the file to your machine and open directly:"
echo "    scp user@${SERVER_IP}:$(pwd)/diagrams/architecture.excalidraw ."
echo ""
