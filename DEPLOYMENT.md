# VPNWatch Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10+ or Podman
- Docker Compose v2 (optional, for docker-compose.yml)
- RHEL 8/9 with container runtime configured

## Quick Start

### Build and Run with Docker Compose

```bash
# Build and start the container
docker compose up -d

# View logs
docker compose logs -f vpnwatch

# Stop the container
docker compose down
```

### Build and Run with Docker CLI

```bash
# Build the image
docker build -t vpnwatch:latest .

# Run the container
docker run -d \
  --name vpnwatch \
  -p 3225:3225 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  vpnwatch:latest

# View logs
docker logs -f vpnwatch

# Stop and remove
docker stop vpnwatch && docker rm vpnwatch
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3225` | HTTP port the application listens on |
| `NODE_ENV` | `production` | Node.js environment mode |
| `DATA_DIR` | `/app/data` | Directory for persistent firewall configuration storage |

### Persistent Storage

Firewall configurations are stored in `$DATA_DIR/firewalls.json` inside the container.  
The `docker-compose.yml` mounts a named Docker volume (`vpnwatch-data`) to `/app/data` so
configurations survive container restarts and upgrades.

**With Docker Compose (recommended)** — volume is managed automatically:

```bash
docker compose up -d
```

**With Docker CLI** — bind-mount a host directory:

```bash
mkdir -p /opt/vpnwatch/data

docker run -d \
  --name vpnwatch \
  -p 3225:3225 \
  -e NODE_ENV=production \
  -e DATA_DIR=/app/data \
  -v /opt/vpnwatch/data:/app/data \
  --restart unless-stopped \
  vpnwatch:latest
```

**With Podman on RHEL** — add the `:Z` SELinux label:

```bash
mkdir -p /opt/vpnwatch/data

podman run -d \
  --name vpnwatch \
  -p 3225:3225 \
  -e DATA_DIR=/app/data \
  -v /opt/vpnwatch/data:/app/data:Z \
  vpnwatch:latest
```

To back up or migrate your firewall list, copy `firewalls.json` from the data directory.

### Changing the Port

```bash
docker run -d \
  --name vpnwatch \
  -p 8080:8080 \
  -e PORT=8080 \
  vpnwatch:latest
```

## RHEL-Specific Notes

### Using Podman (RHEL Default)

```bash
# Build with Podman
podman build -t vpnwatch:latest .

# Run with Podman
podman run -d \
  --name vpnwatch \
  -p 3225:3225 \
  vpnwatch:latest
```

### SELinux Considerations

If you mount volumes on RHEL with SELinux enabled, add the `:Z` flag:

```bash
docker run -d \
  --name vpnwatch \
  -p 3225:3225 \
  -e DATA_DIR=/app/data \
  -v /opt/vpnwatch/data:/app/data:Z \
  vpnwatch:latest
```

### Firewall Configuration

```bash
# Allow port 3225 through firewalld
sudo firewall-cmd --permanent --add-port=3225/tcp
sudo firewall-cmd --reload
```

## Auto Cleanup Service

The docker-compose.yml includes an automatic cleanup service that runs daily to prevent disk space issues:

- Removes build cache older than 3 days
- Removes unused images older than 7 days
- Runs every 24 hours automatically

To check cleanup logs:
```bash
docker compose logs docker-cleanup
```

To run cleanup manually:
```bash
docker exec docker-cleanup docker system prune -a -f
```

To disable auto-cleanup, comment out the `docker-cleanup` service in docker-compose.yml.

## Health Checks

The container includes a health check that verifies the API is responding:

```bash
# Check container health status
docker inspect --format='{{.State.Health.Status}}' vpnwatch

# View health check logs
docker inspect --format='{{json .State.Health}}' vpnwatch | jq
```

## Production Recommendations

1. **Reverse Proxy**: Place behind nginx or Apache for TLS termination
2. **Resource Limits**: Add memory/CPU limits in production

```bash
docker run -d \
  --name vpnwatch \
  -p 3225:3225 \
  --memory=512m \
  --cpus=1 \
  vpnwatch:latest
```

3. **Logging**: Configure log rotation

```bash
docker run -d \
  --name vpnwatch \
  -p 3225:3225 \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  vpnwatch:latest
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs vpnwatch

# Run interactively to debug
docker run -it --rm vpnwatch:latest /bin/bash
```

### Port already in use

```bash
# Find process using port 3225
sudo lsof -i :3225

# Or use a different port
docker run -d -p 8080:3225 vpnwatch:latest
```

### Build fails on RHEL

If npm registry is blocked, configure a local registry:

```bash
docker build \
  --build-arg npm_config_registry=https://your-registry.local/npm \
  -t vpnwatch:latest .
```
