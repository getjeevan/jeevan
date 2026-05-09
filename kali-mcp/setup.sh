#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p workspace

echo "==> Building Kali MCP container (first run takes ~10 min)..."
DOCKER_BUILDKIT=0 docker-compose build

echo "==> Starting Kali MCP server..."
docker-compose up -d

echo "==> Waiting for MCP server to be healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo ""
    echo "==> Kali MCP server is READY"
    echo ""
    echo "    SSE endpoint:  http://$(hostname -I | awk '{print $1}'):8080/sse"
    echo "    Health check:  http://$(hostname -I | awk '{print $1}'):8080/health"
    echo ""
    echo "Add to Claude Code on any machine:"
    echo "    claude mcp add kali-linux --transport sse http://$(hostname -I | awk '{print $1}'):8080/sse"
    echo ""
    exit 0
  fi
  sleep 2
done

echo "ERROR: MCP server did not become healthy. Check logs:"
echo "  docker logs kali-mcp"
exit 1
