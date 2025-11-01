# Docker Deployment Guide for ytBOT

This guide explains the Docker setup for ytBOT, a YouTube to Podcast converter Telegram bot.

## 📋 Overview

The Docker configuration uses **npx** to run the latest published version of ytbot:
- **Dockerfile**: Lightweight runtime image with npx execution
- **docker-compose.yml**: Complete deployment configuration with volumes and resource limits

## 🏗️ Dockerfile Architecture

### NPX-Based Runtime

The Dockerfile uses npx to always run the latest published version of ytbot from npm.

**Entry Point**: `npx -y @tommertom/ytbot@latest`

**Why NPX?**
- ✅ Always gets the latest published version
- ✅ No source code or build process needed
- ✅ Smaller Docker image (~300-400 MB)
- ✅ Automatic updates on container restart
- ✅ Same experience as running locally with npx

### Image Contents

**Base**: `node:22-slim`

**Includes**:
- Python 3 + pip + venv
- yt-dlp (YouTube downloader) in virtual environment
- Node.js runtime
- Minimal system dependencies (curl, ca-certificates)

**Runtime User**: `node` (non-root for security)

## 📦 Volumes - IMPORTANT

### Critical: .env File Mount

The bot **requires** a `.env` file to be mounted into the container:

```yaml
volumes:
  - ./.env:/app/.env:ro  # REQUIRED - must exist on host
```

**⚠️ The container will exit immediately if .env is missing!**

### All Volumes

| Volume | Purpose | Type | Required |
|--------|---------|------|----------|
| `./.env:/app/.env:ro` | Bot configuration | Bind mount (read-only) | ✅ YES |
| `./logs:/app/logs` | Bot logs | Bind mount | Recommended |
| `ytbot_downloads:/tmp/ytBOT_media` | Downloaded videos | Named volume | Yes |

## 🚀 Quick Start

### 1. Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### 2. Create .env File

**CRITICAL**: Create the `.env` file BEFORE starting the container:

```bash
cat > .env << 'EOF'
TELEGRAM_BOT_TOKENS=your_bot_token_here
ALLOWED_USER_IDS=your_telegram_user_id
ADMIN_USER_ID=your_telegram_user_id
MESSAGE_DELETE_TIMEOUT=10000
EOF
```

Verify it exists:
```bash
ls -la .env
```

### 3. Build and Start

```bash
# Build the image
docker compose build

# Start in background
docker compose up -d

# View logs to confirm it started
docker compose logs -f ytbot
```

### 4. Verify

```bash
# Check container is running
docker compose ps

# View logs (should see "Bot started successfully")
docker compose logs ytbot | tail -20

# Verify .env is mounted
docker compose exec ytbot ls -la /app/.env
```

## 🔄 Updates

The bot uses npx, so updates are automatic:

```bash
# Simply restart to get latest version
docker compose restart ytbot

# Or rebuild to get updated base image + latest ytbot
docker compose build
docker compose up -d

# View logs
docker compose logs -f ytbot
```

No source code rebuild needed!

## 🔧 Management Commands

```bash
# Start
docker compose start

# Stop
docker compose stop

# Restart (also updates to latest ytbot version)
docker compose restart

# View logs
docker compose logs -f ytbot

# Access shell
docker compose exec ytbot bash

# Verify .env inside container
docker compose exec ytbot cat /app/.env

# Check yt-dlp version
docker compose exec ytbot yt-dlp --version

# Stop and remove
docker compose down

# Stop, remove, and delete volumes
docker compose down -v
```

## 🐛 Troubleshooting

### Container Exits Immediately

**Check logs first:**
```bash
docker compose logs ytbot
```

**Common issues:**

1. **Missing .env file**
   ```
   Error: .env file not found
   ```
   **Fix**: Create `.env` in project root

2. **Invalid .env mount**
   ```bash
   # Verify on host
   ls -la .env
   
   # Verify inside container
   docker compose exec ytbot ls -la /app/.env
   ```

3. **Wrong permissions**
   ```bash
   chmod 644 .env
   ```

### .env Not Accessible in Container

```bash
# Check volume mounts
docker inspect ytbot | grep -A 20 Mounts

# Should show:
# "Source": "/path/to/.env"
# "Destination": "/app/.env"
# "RW": false (read-only)
```

### NPX Taking Too Long

**First start**: npx downloads package (30-60 seconds)
**Subsequent starts**: Uses cache (faster)

Monitor progress:
```bash
docker compose logs -f ytbot
```

### Downloads Failing

```bash
# Test yt-dlp
docker compose exec ytbot yt-dlp --version

# Check download directory
docker compose exec ytbot ls -la /tmp/ytBOT_media

# Test manual download
docker compose exec ytbot yt-dlp --help
```

## 📊 Resource Limits

Default limits in docker-compose.yml:

| Resource | Limit | Reservation |
|----------|-------|-------------|
| CPU | 2.0 cores | 0.25 cores |
| Memory | 2 GB | 256 MB |

Adjust in `docker-compose.yml` if needed:

```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 4G
```

## 🔒 Security Features

- ✅ Non-root user (`node`)
- ✅ Read-only .env mount
- ✅ No new privileges flag
- ✅ Resource limits
- ✅ Minimal base image
- ✅ Python virtual environment isolation

## 🧹 Cleanup

```bash
# Remove containers (keeps volumes)
docker compose down

# Remove containers and volumes
docker compose down -v

# Clean up Docker system
docker system prune -a --volumes
```

## 📝 Environment Variables

### Required in .env

| Variable | Example | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKENS` | `123:ABC...` | Bot token(s) from @BotFather |
| `ALLOWED_USER_IDS` | `123,456` | Allowed Telegram user IDs |
| `ADMIN_USER_ID` | `123` | Admin user ID |
| `MESSAGE_DELETE_TIMEOUT` | `10000` | Auto-delete timeout (ms) |

### Set by Dockerfile

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DOWNLOAD_DIR` | `/tmp/ytBOT_media` |

## 🚢 Production Tips

1. **Auto-restart**: Already enabled (`restart: unless-stopped`)
2. **Log rotation**: Configured (10MB, 3 files)
3. **Health checks**: Enabled (every 60s)
4. **Updates**: Restart weekly for latest version
5. **Cleanup**: Automate download cleanup with cron

### Auto-update Script

```bash
#!/bin/bash
# update-ytbot.sh
cd /path/to/ytBOT
docker compose restart ytbot
```

Add to crontab for weekly updates:
```
0 3 * * 0 /path/to/update-ytbot.sh
```

## 📚 Resources

- [ytBOT GitHub](https://github.com/Tommertom/ytBOT)
- [Docker Docs](https://docs.docker.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Need help?** [Open an issue](https://github.com/Tommertom/ytBOT/issues)
