# ytBOT - Quick Reference

## 🚀 Quick Start

### NPX (Quickest)
```bash
npx @tommertom/ytbot@latest
```

### Docker Setup
```bash
npx @tommertom/ytbot@latest --docker
# Creates Dockerfile and docker-compose.yml
# Then: docker-compose up -d
```

## 📝 CLI Flags

| Flag | Description |
|------|-------------|
| (none) | Start the bot normally |
| `--docker` | Generate Dockerfile and docker-compose.yml in current directory |

## 🐳 Docker Flag Feature

**Usage**: `npx @tommertom/ytbot@latest --docker`

**What it does**:
- Creates `Dockerfile` in current directory
- Creates `docker-compose.yml` in current directory  
- Prompts before overwriting existing files
- Exits after file generation (does not start bot)

**Example**:
```bash
$ npx @tommertom/ytbot@latest --docker
✅ Created Dockerfile
✅ Created docker-compose.yml

Next: docker-compose up -d
```

---

# YouTube Download Fix - Quick Reference

## 🚀 What Was Fixed

The bot was giving "Downloaded file not found" errors. Now it works reliably.

## 📊 What Changed

### Main Fix
- **Detection window**: 60s → 180s (3 minutes)
- **File tracking**: Now reads exact path from yt-dlp output
- **Size validation**: Checks final MP3 size, not just source video
- **Quality fallback**: Uses audio bitrate (192K, 128K, 96K) instead of video resolution

### User Experience
- Better error messages tell you exactly what went wrong
- Automatic quality reduction for large files
- Oversized files are automatically cleaned up

## ✅ Testing Results

**Short video (3:33)**: ✅ Works perfectly
- File: 6.72 MB
- Time: 15 seconds
- Quality: Best

**Long video (60:17)**: ⚠️ Too large (expected)
- Shows proper fallback behavior
- Clear error message to user
- Suggests trying shorter video

## 📏 Size Limits

| Video Length | Best Quality | Will Work? |
|--------------|--------------|------------|
| < 10 min     | ~14 MB       | ✅ Always  |
| 10-20 min    | ~28 MB       | ✅ Always  |
| 20-30 min    | ~41 MB       | ✅ Usually |
| 30-45 min    | ~62 MB       | ⚠️ Lower quality |
| > 45 min     | ~83+ MB      | ⚠️ May fail |

## 🔧 How to Deploy

```bash
cd /home/tom/ytBOT
npm run build
pm2 restart ytBOT  # or your deployment method
```

## 📝 What to Tell Users

"The bot now handles YouTube downloads better:
- Works reliably for videos under 30 minutes
- Longer videos automatically use lower quality to fit
- Clear error messages if video is too long
- Maximum file size: 50 MB (Telegram limit)"

## 🐛 If Issues Persist

Check console logs - they now show detailed information:
- File detection method used
- File size at each step
- Why a file was rejected
- Download duration vs detection window

Example log:
```
[YouTubeService] Detected file from yt-dlp output: /tmp/...
[YouTubeService] File size: 6.72 MB
[YouTubeBot] Successfully downloaded: song.mp3 (6.72 MB)
```

## 📚 Documentation

- **Full details**: `/docs/youtube-download-fix.md`
- **Implementation**: `/docs/IMPLEMENTATION_SUMMARY.md`
- **This guide**: `/docs/QUICK_REFERENCE.md`

## ✨ Key Benefits

1. No more "file not found" errors for normal videos
2. Better handling of large files
3. Clear feedback to users
4. Automatic quality adjustment
5. Comprehensive logging for debugging
