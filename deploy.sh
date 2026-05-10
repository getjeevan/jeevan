#!/bin/bash
# One-shot deploy for the self-hosted Replit stack on 192.168.1.168
#
# First time:
#   sudo bash setup/init-coder-db.sh   # create Coder PostgreSQL DB
#   bash deploy.sh                     # build + start everything
#   bash setup/push-coder-template.sh  # push workspace template into Coder
#
# Subsequent deploys:
#   cd /opt/jeevan && git pull && bash deploy.sh
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

log() { echo "[deploy] $*"; }

log "Pulling latest code..."
git pull origin claude/connect-onprem-server-Yh5G5 2>/dev/null || true

log "Building and starting all services..."
DOCKER_BUILDKIT=0 docker compose up -d --build --remove-orphans

log "Waiting for services to initialise (30s)..."
sleep 30

# ── Health checks ─────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
DOMAIN="asheindallas.com"

ok()  { printf "  \033[32m[OK]\033[0m  %-20s %s\n" "$1" "$2"; }
wait(){ printf "  \033[33m[..]\033[0m  %-20s %s  (still starting)\n" "$1" "$2"; }

check() {
  local label=$1 url=$2
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then ok "$label" "$url"
  else wait "$label" "$url"; fi
}

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  Platform — ${SERVER_IP}"
echo "══════════════════════════════════════════════════════════════════"
check "Coder IDE"   "http://localhost:7080/healthz"
check "VPNWatch"    "http://localhost:3225/api/stats"
echo ""
echo "  Public URLs (live once DNS propagates):"
echo "    https://coder.${DOMAIN}       ← browser IDE"
echo "    https://vpnwatch.${DOMAIN}"
echo ""
echo "  Local URLs (available now):"
echo "    http://${SERVER_IP}:7080      ← Coder"
echo "    http://${SERVER_IP}:3225      ← VPNWatch"
echo ""
echo "  Next (first deploy only):"
echo "    1. Open http://${SERVER_IP}:7080 — create admin account"
echo "    2. bash setup/push-coder-template.sh"
echo "    3. Create a workspace from the 'docker-dev' template"
echo "══════════════════════════════════════════════════════════════════"
