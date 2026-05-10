# Self-Hosted Platform — asheindallas.com

On-prem server: **192.168.1.168**  
Domain: **asheindallas.com** (Hostinger → Cloudflare)

---

## Architecture

```
MacBook / Browser
      │  HTTPS
      ▼
Cloudflare (SSL termination)
      │  encrypted tunnel
      ▼
cloudflared daemon — running on 192.168.1.168
      │  HTTP (internal)
      ▼
Services on 192.168.1.168

  Port 7080  Coder IDE           coder.asheindallas.com
  Port 3225  VPNWatch            vpnwatch.asheindallas.com
  Port 4000  Infra Dashboard     dashboard.asheindallas.com
  Port 3333  Excalidraw          diagrams.asheindallas.com
  Port 8080  Kali MCP            (internal only)
  Port 8081  Jupyter MCP         (internal only)
```

---

## Step 1 — Point asheindallas.com to Cloudflare

Hostinger DNS → change nameservers to Cloudflare's:

1. Log in to Hostinger → Domains → asheindallas.com → DNS / Nameservers
2. Set custom nameservers:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
3. Wait 5–30 min for propagation.
4. In Cloudflare dashboard → your zone → SSL/TLS → set to **Full (strict)**

---

## Step 2 — Create Cloudflare Tunnel

On **192.168.1.168**:

```bash
# Install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Authenticate (opens browser)
cloudflared tunnel login

# Create the tunnel
cloudflared tunnel create asheindallas

# Note the tunnel ID shown — you'll need it below
```

---

## Step 3 — Configure Tunnel Routes

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /root/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  # Coder IDE — main entry point
  - hostname: coder.asheindallas.com
    service: http://localhost:7080

  # Coder workspace app previews (port forwarding)
  - hostname: "*.coder.asheindallas.com"
    service: http://localhost:7080

  # Supporting services
  - hostname: vpnwatch.asheindallas.com
    service: http://localhost:3225

  - hostname: dashboard.asheindallas.com
    service: http://localhost:4000

  - hostname: diagrams.asheindallas.com
    service: http://localhost:3333

  # Catch-all
  - service: http_status:404
```

---

## Step 4 — DNS Records in Cloudflare

Add these CNAME records in Cloudflare → DNS (Proxy = orange cloud ON):

| Type  | Name        | Target                                | Proxy |
|-------|-------------|---------------------------------------|-------|
| CNAME | coder       | `<TUNNEL-ID>.cfargotunnel.com`        | ✅    |
| CNAME | *.coder     | `<TUNNEL-ID>.cfargotunnel.com`        | ✅    |
| CNAME | vpnwatch    | `<TUNNEL-ID>.cfargotunnel.com`        | ✅    |
| CNAME | dashboard   | `<TUNNEL-ID>.cfargotunnel.com`        | ✅    |
| CNAME | diagrams    | `<TUNNEL-ID>.cfargotunnel.com`        | ✅    |

> The `*.coder` wildcard is required for workspace port forwarding  
> (e.g. `3000--myapp--admin.coder.asheindallas.com` previews port 3000).

---

## Step 5 — Run the Tunnel as a Service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Test:
```bash
curl -I https://coder.asheindallas.com/healthz
# should return HTTP 200
```

---

## Step 6 — First Deploy

```bash
cd /opt/jeevan   # wherever you cloned the repo

# One-time: create Coder's PostgreSQL database
sudo bash setup/init-coder-db.sh

# Build and start everything
bash deploy.sh

# One-time: push the workspace template into Coder
bash setup/push-coder-template.sh
```

---

## Step 7 — Create Your First Workspace

1. Open **https://coder.asheindallas.com**
2. Create admin account
3. Go to Templates → `docker-dev` → Create Workspace
4. Fill in:
   - **GitHub Token** — `ghp_xxxx` (repo + workflow scopes)
   - **Anthropic API Key** — `sk-ant-xxxx`
   - **Repo URL** — (optional) `https://github.com/you/yourrepo`
5. Click Create — workspace spins up in ~60s
6. Click **VS Code** button → full browser IDE opens

---

## Port Reference

| Port | Service | External URL |
|------|---------|-------------|
| 7080 | Coder | coder.asheindallas.com |
| 3225 | VPNWatch | vpnwatch.asheindallas.com |
| 4000 | Infra Dashboard | dashboard.asheindallas.com |
| 3333 | Excalidraw | diagrams.asheindallas.com |
| 8080 | Kali MCP | internal only |
| 8081 | Jupyter MCP | internal only |
| 5432 | PostgreSQL | internal only |
| 6379 | Redis | internal only |
| 6333 | Qdrant | internal only |

---

## vast.ai GPU Burst (Phase 5)

When you need GPU power from a workspace:

```bash
# Inside any Coder workspace — the Jupyter MCP is already connected
claude mcp add jupyter --transport sse http://192.168.1.168:8081/sse

# Then ask Claude to run code on the GPU node:
# "Run this PyTorch training loop on the Jupyter server"
```

For automated GPU bursting via n8n, configure a webhook that provisions a  
new vast.ai instance and updates the `JUPYTER_URL` env var.
