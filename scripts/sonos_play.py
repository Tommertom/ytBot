#!/usr/bin/env python3
import sys
import json

try:
    from soco import SoCo
    from soco.data_structures import DidlMusicTrack, DidlObject
except Exception as exc:
    print(f"Failed to import soco: {exc}", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 3:
    print("Usage: sonos_play.py <sonos_ip> <media_url> [metadata_json]", file=sys.stderr)
    sys.exit(1)

sonos_ip = sys.argv[1]
media_url = sys.argv[2]
metadata_json = sys.argv[3] if len(sys.argv) > 3 else None

try:
    device = SoCo(sonos_ip)
    
    # If metadata provided, create DIDL-Lite metadata for proper display
    if metadata_json:
        try:
            metadata = json.loads(metadata_json)
            title = metadata.get('title', 'Unknown Track')
            artist = metadata.get('artist', 'Unknown Artist')
            album = metadata.get('album', 'Unknown Album')
            album_art_uri = metadata.get('album_art_uri', '')
            
            # Create DIDL-Lite metadata
            didl = DidlMusicTrack(
                title=title,
                parent_id='',
                item_id='',
                creator=artist,
                album=album,
                uri=media_url
            )
            
            # Add album art if provided
            if album_art_uri:
                didl.album_art_uri = album_art_uri
            
            # Play with metadata
            device.play_uri(media_url, meta=didl.to_dict())
        except (json.JSONDecodeError, Exception) as e:
            # Fall back to playing without metadata if there's an error
            print(f"Warning: Failed to parse metadata, playing without: {e}", file=sys.stderr)
            device.play_uri(media_url)
    else:
        device.play_uri(media_url)
    
    print("OK")
except Exception as exc:
    print(f"Failed to play URI: {exc}", file=sys.stderr)
    sys.exit(1)
