# Docker Configuration Changes

## Summary of Changes

This document outlines the differences between the old and new Docker configurations for ytBOT.

## Dockerfile Changes

### Old Configuration Issues:
1. **Bloated image**: Installed GitHub CLI and Copilot CLI (not needed for ytBOT)
2. **Confusing purpose**: Referenced "coderbot" instead of ytBOT
3. **Chromium dependencies**: Included Puppeteer dependencies not needed
4. **No build optimization**: Single-stage build with all dependencies
5. **Complex startup scripts**: Multiple wrapper scripts unnecessary for ytBOT
6. **Wrong entry point**: Tried to run `@tommertom/coderbot` instead of ytBOT

### New Configuration Improvements:
1. **Multi-stage build**: Separate builder and runtime stages
2. **Minimal dependencies**: Only Node.js, Python 3, yt-dlp, and build tools
3. **Optimized layers**: Production dependencies only in final image
4. **Python virtual environment**: Avoids system package conflicts
5. **Clear purpose**: Focused solely on ytBOT functionality
6. **Correct entry point**: Runs built application directly (`node dist/app.js`)

### Size Comparison:
- **Old image**: ~2-3 GB (with Chromium, GitHub CLI, etc.)
- **New image**: ~500-800 MB (minimal dependencies only)

## docker-compose.yml Changes

### Old Configuration:
```yaml
volumes:
  - ytbot-media:/tmp/ytBOT_media  # Unclear naming
  - ./.env:/app/.env:ro           # Good practice

healthcheck:
  test: ["CMD", "node", "-e", "process.exit(0)"]  # Too frequent
  interval: 60s
```

### New Configuration:
```yaml
volumes:
  - ytbot_downloads:/tmp/ytBOT_media  # Clear naming
  - ./logs:/app/logs                   # Persistent logs

healthcheck:
  test: ["CMD", "node", "-e", "process.exit(0)"]
  interval: 60s
  timeout: 10s
  retries: 3
  start_period: 30s  # More robust

logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"  # Log rotation
```

### Key Improvements:
1. ✅ **Clearer volume naming**: `ytbot_downloads` vs `ytbot-media`
2. ✅ **Log persistence**: Bind mount for logs directory
3. ✅ **Log rotation**: Prevents disk space issues
4. ✅ **Better health checks**: Added timeout, retries, start period
5. ✅ **Security**: Maintained `no-new-privileges` flag
6. ✅ **Resource limits**: Kept sensible defaults (2 CPU, 2GB RAM)

## Dependency Analysis

### Required for ytBOT:

| Dependency | Purpose | Status |
|------------|---------|--------|
| Node.js 22 | Runtime | ✅ Included |
| Python 3 | For yt-dlp | ✅ Included |
| yt-dlp | YouTube downloader | ✅ Included (in venv) |
| build-essential | Compile node-pty | ✅ Included |
| Grammy dependencies | None (pure Node) | ✅ N/A |

### NOT Required (Removed from Old Config):

| Dependency | Why Removed |
|------------|-------------|
| GitHub CLI | Not used by ytBOT |
| GitHub Copilot CLI | Not used by ytBOT |
| Chromium/Puppeteer libs | Puppeteer used for screenshot, uses bundled Chromium |
| Various X11 libs | Not needed for headless operation |
| GPG/software-properties-common | Only needed for GitHub CLI install |

## Volume Strategy

### Download Directory

**Old**: Named volume `ytbot-media`
```yaml
volumes:
  ytbot-media:
    driver: local
```

**New**: Named volume `ytbot_downloads` with optional bind mount
```yaml
volumes:
  ytbot_downloads:
    driver: local
  # Commented alternative for bind mount:
  # - ./downloads:/tmp/ytBOT_media
```

**Rationale**:
- Named volumes are managed by Docker (easier cleanup)
- Bind mount option available if host access needed
- Underscore naming follows Docker conventions

### Logs Directory

**Old**: Not mounted (logs lost on container restart)

**New**: Bind mount to `./logs`
```yaml
volumes:
  - ./logs:/app/logs
```

**Rationale**:
- Persistent logs across container restarts
- Easy access from host for debugging
- Automatic creation if directory doesn't exist

## Environment Variables

No changes to required environment variables:
- `TELEGRAM_BOT_TOKENS`
- `ALLOWED_USER_IDS`
- `ADMIN_USER_ID`
- `MESSAGE_DELETE_TIMEOUT`

Additional environment variables set in Dockerfile:
- `NODE_ENV=production`
- `DOWNLOAD_DIR=/tmp/ytBOT_media`

## Security Enhancements

Both configurations include:
- ✅ Non-root user execution
- ✅ `no-new-privileges` security option
- ✅ Resource limits

New configuration adds:
- ✅ Multi-stage build (reduces attack surface)
- ✅ Minimal base image (fewer vulnerabilities)
- ✅ Python virtual environment (package isolation)

## Performance Improvements

1. **Faster builds**: Multi-stage build caches dependencies
2. **Smaller images**: ~60-70% size reduction
3. **Faster startup**: No unnecessary tool installations
4. **Better resource usage**: Only what's needed for ytBOT

## Migration Path

To migrate from old to new configuration:

1. **Stop old container**:
   ```bash
   docker compose down
   ```

2. **Backup data** (optional):
   ```bash
   docker volume ls  # Check volume names
   ```

3. **Use new configuration**:
   ```bash
   docker compose build
   docker compose up -d
   ```

4. **Verify**:
   ```bash
   docker compose logs -f ytbot
   ```

5. **Clean up old volumes** (optional):
   ```bash
   docker volume rm ytbot_ytbot-media  # Old volume name
   ```

## Testing Checklist

- [x] Docker compose config validates
- [x] Build completes successfully
- [x] Container starts without errors
- [x] yt-dlp is accessible
- [x] Node.js version is correct
- [x] Health checks pass
- [x] Volumes mount correctly
- [x] Logs persist across restarts

## Conclusion

The new Docker configuration is:
- **Focused**: Only ytBOT-specific dependencies
- **Optimized**: Smaller, faster, more efficient
- **Secure**: Minimal attack surface, proper isolation
- **Maintainable**: Clear purpose, good documentation
- **Production-ready**: Health checks, log rotation, resource limits

---

Generated: 2025-11-01
