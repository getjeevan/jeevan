#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p workspace

echo "==> Building Kali MCP image (first run takes ~10 min)..."
DOCKER_BUILDKIT=0 docker-compose build

echo "==> Starting Kali MCP and Jupyter MCP servers..."
docker-compose up -d

wait_healthy() {
  local name=$1
  local port=$2
  echo -n "==> Waiting for ${name} on port ${port}..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
      echo " READY"
      return 0
    fi
    sleep 2
    echo -n "."
  done
  echo " TIMEOUT"
  echo "    Check logs: docker logs ${name}"
  return 1
}

wait_healthy kali-mcp 8080
wait_healthy jupyter-mcp 8081

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "======================================================"
echo "  All MCP servers are running"
echo "======================================================"
echo ""
echo "  Kali Linux tools MCP:"
echo "    http://${SERVER_IP}:8080/sse"
echo ""
echo "  Jupyter (vasi.ai) MCP:"
echo "    http://${SERVER_IP}:8081/sse"
echo ""
echo "Add both to Claude Code on any machine:"
echo ""
echo "    claude mcp add kali-linux --transport sse http://${SERVER_IP}:8080/sse"
echo "    claude mcp add jupyter    --transport sse http://${SERVER_IP}:8081/sse"
echo ""
echo "If Jupyter requires a token, set it before running setup.sh:"
echo "    export JUPYTER_TOKEN=your-token-here"
echo "    bash setup.sh"
echo ""
