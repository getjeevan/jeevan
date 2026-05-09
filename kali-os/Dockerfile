FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

# Update and install the full default Kali toolset
RUN apt-get update && apt-get install -y \
    kali-linux-default \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Extra utilities
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    nano \
    tmux \
    screen \
    python3 \
    python3-pip \
    python3-venv \
    golang \
    ruby \
    openssh-client \
    net-tools \
    iputils-ping \
    dnsutils \
    whois \
    traceroute \
    tcpdump \
    tshark \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create a non-root operator user
RUN useradd -m -s /bin/bash -G sudo operator && \
    echo "operator:kali" | chpasswd && \
    echo "operator ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

WORKDIR /home/operator
USER operator

ENV HOME=/home/operator
ENV PATH="$HOME/.local/bin:$PATH"

CMD ["/bin/bash"]
