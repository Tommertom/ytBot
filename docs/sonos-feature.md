# Sonos Feature

This feature lets you use `/sonos <youtube-url>` to download a YouTube video as MP3 and stream it to a Sonos device.

## Requirements

- Python 3 available on the host
- SoCo installed in the Python environment used by the bot
- Sonos device(s) and the Raspberry Pi on the same LAN

Install SoCo:

```bash
pip3 install soco
```

## Configuration

Add the following optional environment variables to your .env file:

```dotenv
# Optional: IP address or hostname that Sonos can reach for media
SONOS_MEDIA_HOST=

# Optional: Port for the local HTTP server that serves MP3 files (default: 8787)
SONOS_MEDIA_PORT=8787

# Optional: Python binary to use for SoCo helpers (default: python3)
SONOS_PYTHON_PATH=python3
```

If `SONOS_MEDIA_HOST` is not set, the bot will try to auto-detect the Raspberry Pi's IPv4 address.

## Usage

1. Run `/sonos` to discover devices and pick one from the inline keyboard.
2. Run `/sonos <youtube-url>` to download the MP3 and play it on the selected Sonos.

## Notes

- MP3s are downloaded to the `mp3-download` subfolder inside the configured media temp directory.
- The bot starts a lightweight HTTP server on the Raspberry Pi to serve the MP3 to Sonos.
- Sonos requires HTTP range support for streaming; this is handled automatically by the bot.
- The device picker message is removed after selection, and the confirmation message auto-deletes after 1 minute.
