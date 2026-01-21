# VPNWatch - Palo Alto S2S VPN Monitor

## Overview
VPNWatch is a lightweight web application for monitoring Site-to-Site IPsec VPN status from Palo Alto firewalls. It provides real-time visibility into VPN tunnel health, enabling network operations teams to quickly assess and respond to connectivity issues.

## Current State
MVP complete with:
- Dashboard displaying VPN tunnel metrics (total, up, down, flapping)
- Table view of all tunnels with status indicators
- Firewall configuration management (add/edit/delete)
- Filtering by search, firewall, and status
- Manual refresh functionality
- Dark/light mode support
- Auto-polling every 60 seconds
- **Export to CSV** - Download all tunnel data with Phase 1/Phase 2 parameters
- **Phase 1 (IKE) parameters** - Encryption, Authentication, DH Group, Lifetime
- **Phase 2 (IPSec) parameters** - Encryption, Authentication, DH Group, Lifetime, PFS
- **Tunnel details dialog** - Click info icon to see full tunnel parameters
- **Gateway aggregation** - Groups ProxyID entries by gateway name for cleaner display
- **Real Peer IP** - Shows actual gateway IP from IKE-SA (not encryption domain)

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack React Query
- **Routing**: Wouter

### Backend (Node.js + Express)
- **Framework**: Express.js with TypeScript
- **Storage**: In-memory storage (MemStorage)
- **API**: RESTful endpoints

### Key Files
```
client/src/
├── App.tsx                    # Root component with providers
├── pages/
│   └── dashboard.tsx          # Main dashboard page
├── components/
│   ├── header.tsx             # App header with controls
│   ├── metric-card.tsx        # Statistic cards
│   ├── tunnel-table.tsx       # VPN tunnel table
│   ├── filters-panel.tsx      # Search and filters
│   ├── firewall-settings.tsx  # Firewall config sheet
│   ├── status-badge.tsx       # Status indicators
│   └── theme-toggle.tsx       # Dark/light mode toggle
├── lib/
│   ├── theme-provider.tsx     # Theme context provider
│   ├── queryClient.ts         # React Query client
│   └── utils.ts               # Utility functions

server/
├── routes.ts                  # API endpoints
├── storage.ts                 # In-memory data storage
├── index.ts                   # Server entry point

shared/
└── schema.ts                  # Shared TypeScript types and Zod schemas
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Dashboard statistics |
| GET | /api/tunnels | All VPN tunnels |
| GET | /api/firewalls | All configured firewalls |
| GET | /api/firewalls/:id | Single firewall |
| POST | /api/firewalls | Create firewall |
| PATCH | /api/firewalls/:id | Update firewall |
| DELETE | /api/firewalls/:id | Delete firewall |
| POST | /api/refresh | Trigger manual refresh |

## Data Models

### Firewall
- id, name, mgmtIp, apiKey, panosVersion, apiType, pollingInterval, isConnected, lastPolled

### VPNTunnel
- id, firewallId, firewallName, tunnelName, peerIp, ipsecState, ikeState
- **Phase 1**: phase1Encryption, phase1Authentication, phase1DhGroup, phase1Lifetime
- **Phase 2**: phase2Encryption, phase2Authentication, phase2DhGroup, phase2Lifetime, phase2Pfs
- **Legacy**: encryption, authentication, bytesIn, bytesOut, rekeyTimer, lastStateChange, lastChecked

### TunnelState
- "up" | "down" | "flapping"

## Development

### Run the application
```bash
npm run dev
```

The app runs on port 5000 with hot reload enabled.

### Design System
- Font: Roboto (sans) and Roboto Mono (mono)
- Uses shadcn/ui component library
- Follows Material Design principles
- Supports dark and light modes

## Initial State
The application starts with no data. Add firewalls via the Settings panel to begin monitoring VPN tunnels.

## Docker Deployment (On-Prem RHEL)

### Prerequisites
- Docker and Docker Compose installed on RHEL
- Network access from Docker host to Palo Alto firewall management IPs
- Port 3225 available on the host

### Quick Start
```bash
# Clone or copy the project files to your RHEL server
cd /opt/vpnwatch

# Build and start (use DOCKER_BUILDKIT=0 to avoid cache issues)
DOCKER_BUILDKIT=0 docker-compose up -d --build

# Check status
docker-compose ps
docker logs vpnwatch
```

### Access the Application
Open browser to: `http://<your-server-ip>:3225`

### Docker Commands
```bash
# Stop the application
docker-compose down

# Rebuild after code changes
DOCKER_BUILDKIT=0 docker-compose up -d --build

# View logs
docker logs -f vpnwatch

# Check health status
docker inspect vpnwatch --format='{{.State.Health.Status}}'
```

### Configuration
The application uses in-memory storage. Firewall configurations are lost on restart. Add firewalls via the Settings panel (gear icon) after starting.

### Troubleshooting
- **Phase 1/Phase 2 shows "unknown"**: Check server logs for DEBUG output showing actual XML field names from your Palo Alto version
- **Traffic shows "No traffic"**: Palo Alto ipsec-sa may not include traffic counters; this is a known limitation
- **Connection timeout**: Verify network connectivity from Docker container to firewall management IP
- **SSL errors**: The app disables TLS verification (NODE_TLS_REJECT_UNAUTHORIZED=0) for self-signed certs

### Files for Deployment
Copy these files to your RHEL server:
- `Dockerfile`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `client/` (entire directory)
- `server/` (entire directory)
- `shared/` (entire directory)
- `script/` (entire directory)

## Future Enhancements (Phase 2)
- Multi-firewall inventory
- Tunnel flap detection
- Historical uptime tracking
- Email/webhook alerting
- Role-based access control
- Persistent storage (database)
