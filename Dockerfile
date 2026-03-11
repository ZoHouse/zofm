FROM node:20-bookworm-slim

# Install Icecast2, FFmpeg, yt-dlp, and Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    icecast2 \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy Icecast config
COPY icecast/icecast.xml /etc/icecast2/icecast.xml

# Copy server code
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --production
COPY server/ ./

# Make start script executable
RUN chmod +x /app/start.sh

# Create directories with correct permissions
RUN mkdir -p /audio/songs /audio/dj /var/log/icecast2 \
    && chmod 777 /var/log/icecast2

# Icecast port
EXPOSE 8000

CMD ["/app/start.sh"]
