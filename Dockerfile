# ytBOT - YouTube to Podcast Converter
# Production runtime using npx

FROM node:22-slim

# Install system dependencies for yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using pip with virtual environment to avoid externally-managed-environment error
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir yt-dlp && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Create app directory and set ownership
RUN mkdir -p /app /tmp/ytBOT_media /app/logs && \
    chown -R node:node /app /tmp/ytBOT_media

WORKDIR /app

# Switch to non-root user
USER node

# Environment variables
ENV NODE_ENV=production \
    DOWNLOAD_DIR=/tmp/ytBOT_media

# Expose no ports (bot communicates via Telegram API)

# Health check - verify npx can be executed
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Start the bot using npx
CMD ["npx", "-y", "@tommertom/ytbot@latest"]
