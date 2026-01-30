#!/usr/bin/env python3
import sys

try:
    from soco import SoCo
except Exception as exc:
    print(f"Failed to import soco: {exc}", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 3:
    print("Usage: sonos_play.py <sonos_ip> <media_url>", file=sys.stderr)
    sys.exit(1)

sonos_ip = sys.argv[1]
media_url = sys.argv[2]

try:
    device = SoCo(sonos_ip)
    device.play_uri(media_url)
    print("OK")
except Exception as exc:
    print(f"Failed to play URI: {exc}", file=sys.stderr)
    sys.exit(1)
