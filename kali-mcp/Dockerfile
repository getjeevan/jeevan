FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

# Core system + Kali security tools
RUN apt-get update && apt-get install -y \
    curl git wget vim tmux \
    nodejs npm \
    python3 python3-pip \
    nmap netcat-traditional net-tools \
    dnsutils whois traceroute \
    tcpdump tshark \
    hydra john \
    sqlmap nikto \
    gobuster dirb \
    metasploit-framework \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install MCP server dependencies (kali + jupyter servers share the same deps)
COPY package.json ./
RUN npm install --omit=dev

# Copy both MCP servers
COPY mcp-server.mjs ./
COPY jupyter-mcp-server.mjs ./

# Entrypoint starts kali-mcp by default;
# jupyter-mcp overrides CMD in docker-compose
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /workspace

EXPOSE 8080 8081

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "/app/mcp-server.mjs"]
