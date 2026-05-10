#!/bin/bash
# Full Cloudflare Tunnel bootstrap for asheindallas.com
# Paste this entire script into your server terminal and run it.
# Takes ~2 minutes. No interaction needed after paste.
set -e

TUNNEL_NAME="asheindallas"
DOMAIN="asheindallas.com"
CF_DIR="/root/.cloudflared"

log()  { echo ""; echo "▶  $*"; }
ok()   { echo "   ✅ $*"; }
die()  { echo "   ❌ $*"; exit 1; }

# ── 1. Install cloudflared ────────────────────────────────────────────────────
log "Installing cloudflared..."
if command -v cloudflared &>/dev/null; then
  ok "Already installed: $(cloudflared --version | head -1)"
else
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
  ok "Installed: $(cloudflared --version | head -1)"
fi

# ── 2. Place cert.pem ─────────────────────────────────────────────────────────
log "Writing Cloudflare credentials..."
mkdir -p "${CF_DIR}"
cat > "${CF_DIR}/cert.pem" <<'CERT'
-----BEGIN ARGO TUNNEL TOKEN-----
eyJ6b25lSUQiOiIwZmU4ZTE5NGVmMDE2NjBlNGMwNjZjOTY5ZDcyNGU3NiIsImFj
Y291bnRJRCI6IjU5MTVlYTc4MDA0ZWU4NWU3NTRlZjFlYTE3ZGQ0YmM3Iiwic2Vy
dmljZUtleSI6InYxLjAtMjRlMjEwZmE1ZmZiMDBlYjliOTlkMjJmLWMxMGQ3MWM1
NGUyNTg3YWFjMDc5ZTE3ZTE3MzY1Mzk0ODNkZDlmZGJiYmZlMTZhMzA5MTA5MWIx
M2ZjNmJmYWJkZTkzM2JmYWE3Njk2MzYyYzQxMmQxNWM0YzE5NmQxOTA5ZWY2ODAy
MmE2ZjM5NDM4OTIwOGRjNGYzNDMyMTIyZTg3ZTk3YWFhZDdkOTY0MjFiOWVkYTkw
M2UwNDBiODA0NjkxIiwiYXBpVG9rZW4iOiJjZnV0X3RIUTRibmhzYklmbGxrd3JN
WmJZUExjOXlzNENseXFRWFdxdDlqOFo2ZTcxOGRkYyJ9
-----END ARGO TUNNEL TOKEN-----
CERT
chmod 600 "${CF_DIR}/cert.pem"
ok "cert.pem written."

# ── 3. Create tunnel (idempotent) ─────────────────────────────────────────────
log "Creating tunnel '${TUNNEL_NAME}'..."

EXISTING=$(cloudflared tunnel list 2>/dev/null | awk -v n="${TUNNEL_NAME}" '$2==n {print $1}' || true)

if [ -n "$EXISTING" ]; then
  TUNNEL_ID="$EXISTING"
  ok "Tunnel already exists — ID: ${TUNNEL_ID}"
else
  cloudflared tunnel create "${TUNNEL_NAME}" 2>&1
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk -v n="${TUNNEL_NAME}" '$2==n {print $1}')
  ok "Tunnel created — ID: ${TUNNEL_ID}"
fi

[ -z "$TUNNEL_ID" ] && die "Could not get tunnel ID. Run: cloudflared tunnel list"

CREDS_FILE="${CF_DIR}/${TUNNEL_ID}.json"
[ -f "$CREDS_FILE" ] || die "Credentials file not found: ${CREDS_FILE}"

# ── 4. Create DNS routes ──────────────────────────────────────────────────────
log "Creating DNS CNAME records in Cloudflare..."

route() {
  local host=$1
  cloudflared tunnel route dns --overwrite-dns "${TUNNEL_NAME}" "${host}" 2>&1 \
    && ok "DNS: ${host}" \
    || echo "   ⚠️  ${host} (may already exist — OK)"
}

route "coder.${DOMAIN}"
route "*.coder.${DOMAIN}"
route "vpnwatch.${DOMAIN}"
route "dashboard.${DOMAIN}"
route "diagrams.${DOMAIN}"
route "ssh.${DOMAIN}"

# ── 5. Write config ───────────────────────────────────────────────────────────
log "Writing /etc/cloudflared/config.yml..."
mkdir -p /etc/cloudflared

cat > /etc/cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}

ingress:
  - hostname: coder.${DOMAIN}
    service: http://localhost:7080
  - hostname: "*.coder.${DOMAIN}"
    service: http://localhost:7080
  - hostname: vpnwatch.${DOMAIN}
    service: http://localhost:3225
  - hostname: dashboard.${DOMAIN}
    service: http://localhost:4000
  - hostname: diagrams.${DOMAIN}
    service: http://localhost:3333
  - hostname: ssh.${DOMAIN}
    service: ssh://localhost:22
  - service: http_status:404
EOF
ok "Config written."

# ── 6. Install + start service ────────────────────────────────────────────────
log "Installing cloudflared as systemd service..."

# Remove any stale service first
cloudflared service uninstall 2>/dev/null || true
cloudflared service install

systemctl enable cloudflared
systemctl restart cloudflared
sleep 4

STATUS=$(systemctl is-active cloudflared 2>/dev/null || echo "unknown")
if [ "$STATUS" = "active" ]; then
  ok "cloudflared service is running."
else
  echo "   ⚠️  Service status: ${STATUS}"
  echo "   Check logs: journalctl -u cloudflared -n 30 --no-pager"
fi

# ── 7. Summary ────────────────────────────────────────────────────────────────
TUNNEL_HOST="${TUNNEL_ID}.cfargotunnel.com"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  Cloudflare Tunnel is live!"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  Tunnel ID:  ${TUNNEL_ID}"
echo "  Target:     ${TUNNEL_HOST}"
echo ""
echo "  DNS records created (verify in Cloudflare dashboard):"
echo "    coder.${DOMAIN}       → ${TUNNEL_HOST}"
echo "    *.coder.${DOMAIN}     → ${TUNNEL_HOST}"
echo "    vpnwatch.${DOMAIN}    → ${TUNNEL_HOST}"
echo "    dashboard.${DOMAIN}   → ${TUNNEL_HOST}"
echo "    diagrams.${DOMAIN}    → ${TUNNEL_HOST}"
echo "    ssh.${DOMAIN}         → ${TUNNEL_HOST}"
echo ""
echo "  Test (run from your Mac):"
echo "    curl -I https://coder.${DOMAIN}/healthz"
echo ""
echo "  Next: deploy the app stack"
echo "    cd /opt/jeevan && bash deploy.sh"
echo "══════════════════════════════════════════════════════════════════"
