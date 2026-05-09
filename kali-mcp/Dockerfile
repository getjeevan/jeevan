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

# Install MCP server dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy MCP server
COPY mcp-server.mjs ./

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Workspace for shared files
RUN mkdir -p /workspace

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
