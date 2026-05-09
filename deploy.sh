#!/bin/bash
# Run this once on the on-prem server. It handles everything.
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

log() { echo "[deploy] $*"; }

log "Pulling latest code..."
git pull origin claude/connect-onprem-server-pkiWo 2>/dev/null || true

log "Building and starting all services..."
DOCKER_BUILDKIT=0 docker compose up -d --build

log "Waiting for services to become healthy..."
sleep 10

SERVER_IP=$(hostname -I | awk '{print $1}')

check() {
  local label=$1 url=$2
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    printf "  \033[32m[OK]\033[0m  %-20s %s\n" "$label" "$url"
  else
    printf "  \033[33m[..]\033[0m  %-20s %s  (still starting)\n" "$label" "$url"
  fi
}

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  On-Prem Services"
echo "══════════════════════════════════════════════════════════"
check "VPNWatch"        "http://${SERVER_IP}:3225"
check "Kali MCP"        "http://localhost:8080/health"
check "Jupyter MCP"     "http://localhost:8081/health"
check "Excalidraw"      "http://${SERVER_IP}:3333"
check "Infra Dashboard" "http://${SERVER_IP}:4000/api/health"
echo ""
echo "  Kali OS shell:    docker exec -it kali-os bash"
echo ""
echo "  Add to Claude Code (run on any machine):"
echo "    claude mcp add kali-linux --transport sse http://${SERVER_IP}:8080/sse"
echo "    claude mcp add jupyter    --transport sse http://${SERVER_IP}:8081/sse"
echo ""
echo "  Diagram:    http://${SERVER_IP}:3333"
echo "  Dashboard:  http://${SERVER_IP}:4000"
echo "══════════════════════════════════════════════════════════"
