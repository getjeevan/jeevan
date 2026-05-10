#!/bin/bash
# Sets up Cloudflare Tunnel on 192.168.1.168 (Ubuntu).
# Run as root or with sudo.
#
# What this does:
#   1. Installs cloudflared
#   2. Authenticates with your Cloudflare account
#   3. Creates a tunnel named "asheindallas"
#   4. Writes /etc/cloudflared/config.yml
#   5. Installs and starts the systemd service
#   6. Prints the DNS records to add in Cloudflare dashboard
#
# Usage:
#   sudo bash setup/install-cloudflared.sh
set -e

TUNNEL_NAME="asheindallas"
CONFIG_DIR="/etc/cloudflared"
CONFIG_FILE="${CONFIG_DIR}/config.yml"

log()  { echo ""; echo "▶ $*"; }
ok()   { echo "  ✅ $*"; }
info() { echo "  ℹ  $*"; }

# ── 1. Install cloudflared ────────────────────────────────────────────────────
log "Installing cloudflared..."

if command -v cloudflared &>/dev/null; then
  ok "cloudflared already installed: $(cloudflared --version | head -1)"
else
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/cloudflared.list

  apt-get update -qq
  apt-get install -y cloudflared
  ok "cloudflared installed: $(cloudflared --version | head -1)"
fi

# ── 2. Authenticate ───────────────────────────────────────────────────────────
log "Authenticating with Cloudflare..."
info "A URL will appear below. Copy it, open it on your Mac, and authorise the tunnel."
info "Select asheindallas.com when prompted."
echo ""

cloudflared tunnel login

ok "Authenticated."

# ── 3. Create tunnel (idempotent) ─────────────────────────────────────────────
log "Creating tunnel '${TUNNEL_NAME}'..."

EXISTING_ID=$(cloudflared tunnel list --output json 2>/dev/null \
  | python3 -c "import sys,json; tuns=json.load(sys.stdin); \
    match=[t['id'] for t in tuns if t['name']=='${TUNNEL_NAME}']; \
    print(match[0] if match else '')" 2>/dev/null || true)

if [ -n "$EXISTING_ID" ]; then
  TUNNEL_ID="$EXISTING_ID"
  ok "Tunnel already exists — ID: ${TUNNEL_ID}"
else
  cloudflared tunnel create "${TUNNEL_NAME}"
  TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null \
    | python3 -c "import sys,json; tuns=json.load(sys.stdin); \
      match=[t['id'] for t in tuns if t['name']=='${TUNNEL_NAME}']; \
      print(match[0] if match else '')" 2>/dev/null)
  ok "Tunnel created — ID: ${TUNNEL_ID}"
fi

if [ -z "$TUNNEL_ID" ]; then
  echo "ERROR: could not read tunnel ID. Run 'cloudflared tunnel list' manually."
  exit 1
fi

# Credentials file is written to ~/.cloudflared/<id>.json by cloudflared
CREDS_FILE="${HOME}/.cloudflared/${TUNNEL_ID}.json"

# ── 4. Write config ───────────────────────────────────────────────────────────
log "Writing ${CONFIG_FILE}..."
mkdir -p "${CONFIG_DIR}"

cat > "${CONFIG_FILE}" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}

ingress:
  # Coder IDE
  - hostname: coder.asheindallas.com
    service: http://localhost:7080

  # Coder workspace app previews (wildcard)
  - hostname: "*.coder.asheindallas.com"
    service: http://localhost:7080

  # VPNWatch
  - hostname: vpnwatch.asheindallas.com
    service: http://localhost:3225

  # Infra Dashboard
  - hostname: dashboard.asheindallas.com
    service: http://localhost:4000

  # Excalidraw diagrams
  - hostname: diagrams.asheindallas.com
    service: http://localhost:3333

  # Catch-all
  - service: http_status:404
EOF

ok "Config written."

# ── 5. Install systemd service ────────────────────────────────────────────────
log "Installing cloudflared as a system service..."

cloudflared service install

systemctl enable cloudflared
systemctl restart cloudflared

sleep 3
STATUS=$(systemctl is-active cloudflared || true)
if [ "$STATUS" = "active" ]; then
  ok "cloudflared service is running."
else
  echo "  ⚠️  Service status: ${STATUS}"
  echo "  Check logs with: journalctl -u cloudflared -n 50"
fi

# ── 6. Print DNS records ──────────────────────────────────────────────────────
TUNNEL_HOSTNAME="${TUNNEL_ID}.cfargotunnel.com"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  Tunnel is running.  Now add these DNS records in Cloudflare:"
echo "══════════════════════════════════════════════════════════════════"
echo ""
printf "  %-8s %-15s %-52s %s\n" "Type" "Name" "Content" "Proxy"
printf "  %-8s %-15s %-52s %s\n" "────" "────────────" "──────────────────────────────────────────────────" "─────"
printf "  %-8s %-15s %-52s %s\n" "CNAME"  "coder"     "${TUNNEL_HOSTNAME}" "ON (orange)"
printf "  %-8s %-15s %-52s %s\n" "CNAME"  "*.coder"   "${TUNNEL_HOSTNAME}" "ON (orange)"
printf "  %-8s %-15s %-52s %s\n" "CNAME"  "vpnwatch"  "${TUNNEL_HOSTNAME}" "ON (orange)"
printf "  %-8s %-15s %-52s %s\n" "CNAME"  "dashboard" "${TUNNEL_HOSTNAME}" "ON (orange)"
printf "  %-8s %-15s %-52s %s\n" "CNAME"  "diagrams"  "${TUNNEL_HOSTNAME}" "ON (orange)"
echo ""
echo "  Your tunnel target:  ${TUNNEL_HOSTNAME}"
echo ""
echo "  After adding DNS records, test with:"
echo "    curl -I https://coder.asheindallas.com/healthz"
echo "══════════════════════════════════════════════════════════════════"
