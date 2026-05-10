#!/bin/bash
# One-shot deploy for the self-hosted Replit stack on 192.168.1.168
#
# Usage (first time):
#   sudo bash setup/init-coder-db.sh     # create coder postgres DB
#   bash deploy.sh                       # build + start everything
#   bash setup/push-coder-template.sh    # push workspace template into Coder
#
# Subsequent deploys:
#   bash deploy.sh
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

log() { echo "[deploy] $*"; }

# ── Pull latest ───────────────────────────────────────────────────────────────
log "Pulling latest code..."
git pull origin claude/connect-onprem-server-Yh5G5 2>/dev/null || true

# ── Build + start ─────────────────────────────────────────────────────────────
log "Building and starting all services..."
DOCKER_BUILDKIT=0 docker compose up -d --build --remove-orphans

log "Waiting for services to initialise (30s)..."
sleep 30

# ── Health checks ─────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
DOMAIN="asheindallas.com"

ok()  { printf "  \033[32m[OK]\033[0m  %-22s %s\n" "$1" "$2"; }
wait(){ printf "  \033[33m[..]\033[0m  %-22s %s  (still starting)\n" "$1" "$2"; }

check() {
  local label=$1 url=$2
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then ok "$label" "$url"
  else wait "$label" "$url"; fi
}

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  Platform — 192.168.1.168"
echo "══════════════════════════════════════════════════════════════════"
check "Coder IDE"         "http://localhost:7080/healthz"
check "VPNWatch"          "http://localhost:3225/api/stats"
check "Infra Dashboard"   "http://localhost:4000/api/health"
check "Kali MCP"          "http://localhost:8080/health"
check "Jupyter MCP"       "http://localhost:8081/health"
echo ""
echo "  Public URLs (via Cloudflare Tunnel):"
echo "    https://coder.${DOMAIN}           ← main IDE"
echo "    https://vpnwatch.${DOMAIN}"
echo "    https://dashboard.${DOMAIN}"
echo ""
echo "  Local URLs:"
echo "    http://${SERVER_IP}:7080          ← Coder"
echo "    http://${SERVER_IP}:3225          ← VPNWatch"
echo "    http://${SERVER_IP}:4000          ← Infra Dashboard"
echo "    http://${SERVER_IP}:3333          ← Excalidraw"
echo ""
echo "  Next steps (first deploy only):"
echo "    1. Open https://coder.${DOMAIN} and create admin account"
echo "    2. bash setup/push-coder-template.sh"
echo "    3. Create your first workspace from the 'docker-dev' template"
echo ""
echo "  MCP servers for Claude Code:"
echo "    claude mcp add kali-linux --transport sse http://${SERVER_IP}:8080/sse"
echo "    claude mcp add jupyter    --transport sse http://${SERVER_IP}:8081/sse"
echo "══════════════════════════════════════════════════════════════════"
