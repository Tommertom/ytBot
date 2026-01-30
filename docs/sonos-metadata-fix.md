# Sonos Metadata Fix

## Problem

Sonos app was displaying "No Content" instead of showing the title and album cover for MP3 files downloaded by ytBOT.

## Root Cause

The `--metadata` flag in yt-dlp was not properly writing ID3 tags. Specifically:
- `--metadata 'album:%(title)s'` was being rejected with error "Could not interpret 'title' as 'album:%(title)s'"
- Album and album_artist tags were missing from the final MP3 file
- This caused Sonos to not display the metadata properly

## Solution

Changed from `--metadata` to `--parse-metadata` with proper format:

### Before
```typescript
'--metadata', 'title:%(title)s',
'--metadata', 'artist:%(title)s',
'--metadata', 'album:%(title)s',  // This failed
'--metadata', 'album_artist:%(title)s',  // This failed
```

### After
```typescript
'--parse-metadata', 'title:%(meta_title)s',
'--parse-metadata', 'title:%(meta_artist)s',
'--parse-metadata', 'title:%(meta_album)s',
'--parse-metadata', 'title:%(album_artist)s',
```

## What Gets Embedded

All MP3 files now include:
- **Title**: Video title (e.g., "Primus - Wynonna's Big Brown Beaver")
- **Artist**: Video title
- **Album**: Video title
- **Album Artist**: Video title
- **Album Art**: Embedded JPEG thumbnail (1280x720, from YouTube)
- **Genre**: "Music" (auto-set by yt-dlp)
- **Date**: Video upload year

## Verification

You can verify the tags using ffprobe:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams "file.mp3"
```

Look for:
- `format.tags.album`: Should be set to video title
- `format.tags.album_artist`: Should be set to video title
- `streams[1].disposition.attached_pic: 1`: Confirms album art is embedded

## Sonos Compatibility

Sonos requires:
- ✅ ID3v2 tags (title, artist, album, album_artist)
- ✅ Embedded album art as APIC frame
- ✅ JPEG format for album art
- ✅ Proper MIME type for album art

All requirements are now met with this fix.

## Testing

Tested with: `https://www.youtube.com/watch?v=aYDfwUJzYQg`

Result:
- All ID3 tags properly embedded
- Album art present (1280x720 JPEG, ~100KB)
- Sonos should now display title and album cover correctly
