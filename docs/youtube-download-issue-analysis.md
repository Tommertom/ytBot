# YouTube Download Issue Analysis

## Problem Summary
URL: https://www.youtube.com/watch?v=6ornm2zEcXA  
Title: "Them Crooked Vultures live @ Royal Albert Hall 2010"  
Duration: 95 minutes (5713 seconds)

## Root Cause

The video's audio file exceeds the 50MB file size limit:
- Actual audio file size: ~58.2 MB (61,014,614 bytes)
- Configured max size: 50 MB (52,428,800 bytes)
- Format: WebM (Opus codec, 127.67 kbps)

## Technical Details

### yt-dlp Behavior
When `--max-filesize 50M` is specified, yt-dlp:
1. Starts downloading the audio
2. Monitors file size during download  
3. **Aborts mid-download** when size exceeds limit
4. Leaves a `.webm.part` partial file
5. Exits with code 0 (success) but **does not output the filepath**

### Bot Detection Logic
The bot tries to find the downloaded file by:
1. Looking for filepath in yt-dlp output (using `--print after_move:filepath`)
2. Scanning the output directory for recent .mp3 files

Both methods fail because:
- No filepath is printed (download was aborted)
- No .mp3 file exists (conversion never happened)
- Only `.webm.part` partial files remain

## Solutions

### Option 1: Increase File Size Limit (Recommended)
Increase `MAX_FILE_SIZE_MB` from 50MB to 100MB or higher.

**Pros:**
- Handles longer videos/concerts
- Simple change
- Most music content under 100MB

**Cons:**
- Larger files for users
- Telegram bot API limit is 50MB for bots, 2GB for users

### Option 2: Better Quality Fallback
The current fallback tries lower bitrates (192K, 128K, 96K), but for a 95-minute video:
- 192 kbps = ~82 MB
- 128 kbps = ~55 MB  
- 96 kbps = ~41 MB ✓

**Issue:** Current implementation uses audio quality `0` (best), not explicit bitrate.

### Option 3: Better Error Detection
Improve error handling to detect when max-filesize is exceeded:
- Check for `.webm.part` or `.m4a.part` files
- Parse yt-dlp stderr for "File is larger than max-filesize"
- Provide clear error message to user

### Option 4: Duration-Based Pre-Check
Before downloading, check video duration and estimate file size:
- Formula: `estimated_size_mb = (duration_seconds * bitrate_kbps) / 8 / 1024`
- For 128kbps: `(5713 * 128) / 8 / 1024 = ~89 MB`
- Warn user if estimated size exceeds limit

## Recommended Implementation

1. **Increase max file size to 100MB** for the download check
2. **Add duration-based warning** for videos > 60 minutes
3. **Improve error messages** to explain file size issues
4. **Clean up `.part` files** after failed downloads

## Test Results

### Video Information
```
Title: Them Crooked Vultures live @ Royal Albert Hall 2010
Duration: 5713 seconds (95.22 minutes)
Uploader: QOTSA Archive 2
View Count: 70,069
```

### Download Attempt (Quality 0 - Best)
```
Format: WebM (Opus)
Bitrate: 127.67 kbps
File Size: 91,174,086 bytes (~87 MB before conversion)
After MP3 conversion: ~58.2 MB
Result: FAILED - Exceeded 50MB limit
```

### File System State
After failed download:
- `Them Crooked Vultures live @ Royal Albert Hall 2010.webm.part` (48.63 MB)
- No `.mp3` file created
- Bot reports: "Downloaded file not found"

## Notes

- The video is a full concert (1h 35m), which is unusually long for YouTube downloads
- Even at lowest quality (96kbps), file would be ~41MB
- Telegram bot API has a 50MB limit for sending files
- For files > 50MB, users need Telegram Premium or different delivery method
