# ytBot - YouTube to Podcast Converter

[![npm version](https://badge.fury.io/js/@tommertom%2Fytbot.svg)](https://www.npmjs.com/package/@tommertom/ytbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Transform your favorite YouTube videos into podcasts and music files for your mobile device - all through a simple Telegram chat interface!**

No complicated interfaces, no desktop apps, no third-party services - just send a YouTube link to your personal Telegram bot running on your own machine, and receive the video ready to play on your phone. You control where it runs, you control your data.

## ✨ Features

- 🎵 **One-Click Conversion** - Just send a YouTube URL, get your media file back
- 📱 **Mobile-First** - Designed for easy use on your phone via Telegram
- 🏠 **Self-Hosted** - Runs on YOUR machine, under YOUR control (laptop, server, Raspberry Pi, or any machine you own)
- 🎧 **Smart Quality Management** - Automatically optimizes file size for mobile
- 📦 **No Hassle** - No sign-ups, no subscriptions, no cloud storage required
- 🔒 **Private** - Your personal bot, your files, your privacy
- ⚡ **Fast** - Direct delivery to your Telegram chat


## Recent Fixes ✅

- 2026-01-30 — Fixed `/start` and `/help`: help message no longer uses HTML parse mode to avoid Telegram errors when containing strings like `<youtube-url>`.


## Using ytBot

Once your bot is running and configured:

1. **Open Telegram** and find your bot
2. **Send a YouTube URL** - Any valid YouTube link or playlist
3. **Wait for download** - The bot will fetch and process the video(s)
4. **Receive your file(s)** - Audio files sent directly to your chat

### Demo

See ytBot in action:

[![Watch Demo Video](https://img.youtube.com/vi/3lQDlkIo-os/0.jpg)](https://youtube.com/shorts/3lQDlkIo-os)

*Click the image above to watch the demo video*

**Single Video Example:**
```
You: https://www.youtube.com/watch?v=dQw4w9WgXcQ

Bot: 🎵 Downloading video...
     Quality: 192kbps
     Size: ~8MB
     
     [Audio file sent]
```

**Playlist Example:**
```
You: https://www.youtube.com/playlist?list=PLxxxxxx

Bot: 📋 Playlist detected: My Awesome Playlist
     📊 Total videos: 25
     ⬇️ Will download: 25 videos
     
     ⏳ This may take a while. Processing sequentially...
     
     📥 [1/25] Video Title 1
     ✅ [1/25] Downloaded: Video Title 1
     [Audio file sent]
     
     📥 [2/25] Video Title 2
     ✅ [2/25] Downloaded: Video Title 2
     [Audio file sent]
     
     ... (continues for all videos)
     
     ✅ Playlist download complete!
     📊 Summary:
        ✅ Downloaded: 23
        ❌ Failed: 2
        📝 Total: 25
```

### Smart Quality Management

If a video file is too large for Telegram (>50MB), ytBot automatically tries lower bitrates:
- Best available → 192kbps → 128kbps → 96kbps → 64kbps → 48kbps

This ensures you always get the audio, even if the original is too large.

**Supported YouTube URLs:**
- Standard videos: `https://www.youtube.com/watch?v=...`
- Short links: `https://youtu.be/...`
- YouTube Shorts: `https://www.youtube.com/shorts/...`
- **Playlists**: `https://www.youtube.com/playlist?list=...`
- **Videos with playlist context**: `https://www.youtube.com/watch?v=...&list=...`

**Playlist Features:**
- ✅ Downloads up to **50 videos** per playlist (configurable)
- ✅ **Sequential downloading** to prevent rate limiting
- ✅ **Progress updates** for each video
- ✅ **Error resilience** - failed videos don't stop the playlist
- ✅ Summary statistics after completion


## ⚠️ Important Legal Notice

**USE AT YOUR OWN RISK**: You using this tool may violate YouTube's Terms of Service.

- **YouTube ToS**: Downloading videos may violate YouTube's Terms of Service, which prohibit downloading content without explicit permission
- **Copyright**: Only download content you have the right to download or that is in the public domain
- **Personal Use**: This tool is intended for personal, educational use only
- **User Responsibility**: You are solely responsible for ensuring your use complies with all applicable laws and service agreements

**The author assumes no liability for any consequences resulting from the use of this software.**

## Quick Installation

Choose the installation method that works best for you:

| Method | Best For | Command |
|--------|----------|---------|
| **npx** | Quick testing, temporary use | `npx @tommertom/ytbot@latest` |
| **Global Install** | Regular use, permanent installation | `npm install -g @tommertom/ytbot` |
| **Docker** | Isolation, Windows, production | `npx @tommertom/ytbot@latest --docker` |

### Method 1: Run with npx (Easiest - No Installation)

Perfect for trying out ytBot or if you don't want to install anything permanently:

```bash
npx @tommertom/ytbot@latest
```

**First Run:** The bot will create a `.env` file automatically and exit with instructions:

```
⚠️  No .env file found in current directory!

📝 Creating .env template...

✅ Created .env file from template

🔧 Please edit .env and configure:
   - TELEGRAM_BOT_TOKENS (required)
   - ALLOWED_USER_IDS (required)

Then run the command again.
```

**Edit the configuration:**

```bash
# Open the .env file that was created
nano .env
```

**Run again to start the bot:**

```bash
npx @tommertom/ytbot@latest
```

### Method 2: Install Globally

Install once and run anytime:

```bash
# Install
npm install -g @tommertom/ytbot

# Run (creates .env on first run)
ytbot
```

**First Run:** Same as npx - creates `.env` file automatically:
1. Bot creates `.env` file and exits
2. You edit `.env` with your tokens
3. Run `ytbot` again to start

## 🚩 CLI Flags

ytBot supports command-line flags to modify its behavior:

### `--docker` Flag

**Purpose:** Generates Docker configuration files in your current directory.

**Usage:**
```bash
npx @tommertom/ytbot@latest --docker
```

**What it does:**
1. Creates a production-ready `Dockerfile` in your current directory
2. Creates a `docker-compose.yml` configured for ytBot
3. Prompts you before overwriting any existing files
4. Exits after file generation (does not start the bot)

**Example output:**
```
🤖 ytBOT - AI-Powered Telegram Terminal Bot
================================================

🐳 Docker Setup Mode

✅ Created Dockerfile at /your/project/Dockerfile
✅ Created docker-compose.yml at /your/project/docker-compose.yml

✅ Docker setup complete!

📝 Next steps:
   1. Create a .env file with your configuration
   2. Run: docker-compose up -d
   3. View logs: docker-compose logs -f
```

**If files already exist:**
```
⚠️  Dockerfile already exists. Overwrite? (y/N): n
❌ Skipping Dockerfile creation.
⚠️  docker-compose.yml already exists. Overwrite? (y/N): yes
✅ Created docker-compose.yml at /your/project/docker-compose.yml
```

**When to use:**
- Setting up ytBot with Docker for the first time
- Updating Docker configurations to latest recommended settings
- Getting production-ready Docker files without manual copying

**Note:** You can respond with `y`, `yes`, `n`, or `no` (case-insensitive) to the overwrite prompts.

### Method 3: Docker (Most Isolated)

Run in a container with all dependencies included. Docker is perfect for:
- **Isolation**: Keeps ytBot separate from your system
- **Consistency**: Same environment on any machine
- **Easy Updates**: Pull latest version with one command
- **Windows Users**: Best option for Windows compatibility

#### Option A: Quick Setup with --docker flag (Recommended)

The easiest way to get started with Docker:

**Step 1: Generate Docker files**
```bash
# Creates Dockerfile and docker-compose.yml in current directory
npx @tommertom/ytbot@latest --docker
```

**What happens:**
- ✅ Production-tested `Dockerfile` is created
- ✅ Pre-configured `docker-compose.yml` is created  
- ✅ You're prompted before overwriting existing files
- ✅ Clear next steps are displayed

**Step 2: Create your configuration**

Create a `.env` file (see Configuration section below) or use the quick method:

```bash
cat > .env << 'EOF'
TELEGRAM_BOT_TOKENS=your_bot_token_here
ALLOWED_USER_IDS=your_telegram_user_id
ADMIN_USER_ID=your_telegram_user_id
MESSAGE_DELETE_TIMEOUT=10000
EOF
```

**Step 3: Start the bot**
```bash
docker-compose up -d      # Start in background
docker-compose logs -f    # View logs (Ctrl+C to exit)
```

**That's it!** Your bot is now running in Docker.

**Managing your Docker bot:**
```bash
docker-compose stop       # Stop the bot
docker-compose start      # Start the bot
docker-compose restart    # Restart the bot
docker-compose down       # Stop and remove container
docker-compose logs -f    # View live logs
```

#### Option B: Manual Docker Setup

**Create `.env` file:**

```bash
cat > .env << 'EOF'
TELEGRAM_BOT_TOKENS=your_bot_token_here
ALLOWED_USER_IDS=your_telegram_user_id
ADMIN_USER_ID=your_telegram_user_id
MESSAGE_DELETE_TIMEOUT=10000
EOF
```

## Configuration

ytBot needs a few settings to work. These are stored in a `.env` file that's **created automatically on first run**.

### Automatic .env Creation

When you run ytBot for the first time:

1. **Bot detects no .env file** and creates one from the template
2. **Bot exits** with a message telling you to edit it
3. **You edit .env** with your bot token and user ID
4. **You run the bot again** - it starts normally

### Required Settings

The `.env` file contains these settings:

Edit the `.env` file with your configuration:

```bash
# Your Telegram bot token from @BotFather
# Get one by messaging @BotFather on Telegram and creating a new bot
TELEGRAM_BOT_TOKENS=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Your Telegram user ID (the bot will tell you this when you first message it)
# Only users in this list can use the bot
ALLOWED_USER_IDS=123456789

# Admin user ID - receives notifications about unauthorized access
ADMIN_USER_ID=123456789

# How long confirmation messages stay visible (in milliseconds)
# 10000 = 10 seconds, set to 0 to keep messages
MESSAGE_DELETE_TIMEOUT=10000
```

### Finding Your Telegram User ID

1. Start the bot (even before configuring ALLOWED_USER_IDS)
2. Send any message to your bot
3. The bot will reply with your User ID
4. Add that ID to `ALLOWED_USER_IDS` in `.env`
5. Restart the bot

### Multiple Users

You can allow multiple people to use your bot:

```bash
# Separate multiple user IDs with commas (no spaces)
ALLOWED_USER_IDS=123456789,987654321,555666777
```

### Multiple Bots

Run multiple bot instances with different tokens:

```bash
# Separate tokens with commas (no spaces)
TELEGRAM_BOT_TOKENS=token1,token2,token3
```

## System Requirements

- **Operating System**: Linux or macOS (Windows not supported)
- **Node.js**: Version 18 or higher
- **Python 3**: For yt-dlp (YouTube downloader)
- **Disk Space**: ~500MB for dependencies

## Installing Dependencies

ytBot requires `yt-dlp` to download YouTube videos:

```bash
# macOS
brew install yt-dlp

# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install yt-dlp

# Or using pip (any OS with Python)
pip3 install yt-dlp

# Verify installation
yt-dlp --version
```

**Note:** Docker installation includes all dependencies automatically.

## Troubleshooting

### First Run - .env File

**Issue**: Bot creates .env and exits immediately

**This is normal!** On first run:
1. Bot creates `.env` file automatically
2. Bot shows you what to configure
3. Bot exits so you can edit the file
4. Edit `.env` with your bot token and user ID
5. Run the bot again

### Bot Not Responding

1. Check the bot is running (check console output or Docker logs)
2. Verify your User ID is in `ALLOWED_USER_IDS`
3. Make sure `TELEGRAM_BOT_TOKENS` is correct
4. Restart the bot

### Downloads Failing

1. Verify yt-dlp is installed: `yt-dlp --version`
2. Check the YouTube URL is valid
3. Try downloading manually to see error: `yt-dlp <URL>`
4. Update yt-dlp: `pip3 install --upgrade yt-dlp`
5. Check you have enough disk space

### File Not Received

1. Check bot console/logs for errors
2. Verify file was downloaded (check download directory)
3. File might be too large even at lowest quality
4. Try a shorter/smaller video

## Privacy & Security

- **Self-Hosted & You're In Control**: Runs on YOUR machine (laptop, server, cloud VPS, Raspberry Pi) - not someone else's cloud
- **Private Bot**: Only users you authorize can use it
- **Local Processing**: Videos are processed on your server, not third-party cloud services
- **Your Data Stays Yours**: No external services involved in the download process
- **Automatic Cleanup**: Downloaded files are managed automatically
- **Access Control**: Unauthorized users are blocked automatically
- **Run Anywhere**: Deploy on any machine you control - home server, work laptop, cloud instance, or edge device

**Admin Notifications**: The admin user receives alerts if unauthorized users try to access the bot.

## Technical Details

- **Runtime**: Node.js with TypeScript
- **Bot Framework**: Grammy (Telegram Bot API)
- **Downloader**: yt-dlp (Python-based)
- **File Watching**: Automatic detection and delivery of downloaded files
- **Multi-Bot Support**: Run multiple bot instances from one installation

## FAQ

**Q: The bot exits immediately after I run it. What's wrong?**  
A: Nothing! On first run, the bot creates a `.env` file and exits so you can configure it. Edit the `.env` file with your bot token and user ID, then run the bot again.

**Q: Where does the bot run?**  
A: On YOUR machine - anywhere you want! Your laptop, home server, Raspberry Pi, or cloud VPS. You have complete control.

**Q: Do I need to trust a third-party service?**  
A: No! The bot runs on your own machine. No data goes to external services except YouTube (for downloading) and Telegram (for messaging).

**Q: Can I download playlists?**  
A: Currently ytBot handles individual videos. Send one URL at a time.

**Q: What video formats are supported?**  
A: ytBot downloads whatever yt-dlp supports - essentially all YouTube videos.

**Q: How long are files kept?**  
A: Files are sent immediately and can be configured to clean up automatically.

**Q: Can multiple people use the same bot?**  
A: Yes! Add multiple user IDs to `ALLOWED_USER_IDS`.

**Q: Is this legal?**  
A: This is for personal use only. Ensure you have the right to download any content. See the Legal Notice above.

**Q: Can I run this on a Raspberry Pi?**  
A: Yes, as long as it runs Node.js 18+ and has enough storage.

**Q: What happens if my machine goes offline?**  
A: The bot stops working until you bring it back online. That's the trade-off for self-hosting and complete control.

---

**⚠️ Legal Disclaimer**: This software is provided "as is" without warranty. The author is not responsible for any misuse or violations of third-party terms of service. Users are solely responsible for ensuring compliance with all applicable laws.

**📱 Enjoy your podcasts on the go!**
