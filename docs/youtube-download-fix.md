# YouTube Download Fix - October 2025

## Problem Summary

Users were experiencing "Downloaded file not found" errors when trying to download YouTube videos, specifically when sending URLs like `https://www.youtube.com/watch?v=_NLHFoVNlbg`.

## Root Causes Identified

### 1. **File Detection Window Too Short (Primary Issue)**
- **Problem**: The code only looked for files modified within the last 60 seconds
- **Reality**: Downloads + MP3 conversion took 75-85 seconds for typical videos
- **Impact**: Files were created but appeared "too old" by the time detection ran

### 2. **No Post-Download File Size Validation**
- **Problem**: `--max-filesize` flag only checked source video size, not final MP3
- **Example**: 44.97MB video → 82.91MB MP3 (exceeds 50MB limit)
- **Impact**: Large files downloaded successfully but couldn't be sent via Telegram

### 3. **Ineffective Quality Fallback**
- **Problem**: Quality fallback used video resolution (720p, 480p, etc.) for audio-only downloads
- **Impact**: No file size reduction when downloading audio from long videos

### 4. **Limited Error Visibility**
- **Problem**: Generic error messages didn't explain the actual issue
- **Impact**: Difficult to diagnose whether the issue was file size, timeout, or other

## Implemented Solutions

### 1. Increased File Detection Window
**Changed**: Detection window from 60 seconds to 180 seconds (3 minutes)

```typescript
private fileDetectionWindow: number = 180000; // 3 minutes
```

**Benefits**:
- Accommodates longer downloads (up to 3 minutes)
- Handles slow network connections
- Accounts for MP3 conversion time

### 2. Added yt-dlp Output Parsing
**Changed**: Now reads the actual file path from yt-dlp's output using `--print after_move:filepath`

```typescript
const args = [
    // ... other args
    '--print', 'after_move:filepath', // Print final file path
    // ...
];
```

**Benefits**:
- More reliable file detection
- No dependency on filesystem scanning
- Works regardless of file age

### 3. Post-Download File Size Validation
**Changed**: Added validation of final MP3 file size after conversion

```typescript
const fileSizeMB = stats.size / (1024 * 1024);

if (fileSizeMB > this.maxFileSize) {
    console.log(`Final MP3 exceeds size limit (${fileSizeMB.toFixed(2)} MB > ${this.maxFileSize} MB)`);
    fs.unlinkSync(detectedFilePath); // Clean up oversized file
    return {
        success: false,
        error: 'File too large'
    };
}
```

**Benefits**:
- Prevents sending files that exceed Telegram's limits
- Triggers quality fallback mechanism
- Cleans up oversized files automatically

### 4. Audio Bitrate-Based Quality Fallback
**Changed**: Quality fallback now adjusts audio bitrate instead of video resolution

```typescript
// Before: Used video resolution (720p, 480p, 360p) - didn't work for audio
// After: Uses audio bitrate (192kbps, 128kbps, 96kbps)

async downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult> {
    // Try best quality (0 = best)
    let result = await this.attemptDownload(url, options, '0');
    
    if (!result.success && result.error?.includes('too large')) {
        // Try 192kbps
        result = await this.attemptDownload(url, options, '192K');
        
        if (!result.success && result.error?.includes('too large')) {
            // Try 128kbps
            result = await this.attemptDownload(url, options, '128K');
            
            if (!result.success && result.error?.includes('too large')) {
                // Try 96kbps (lowest acceptable)
                result = await this.attemptDownload(url, options, '96K');
            }
        }
    }
    
    return result;
}
```

**Benefits**:
- Actually reduces file size for audio downloads
- Progressive quality degradation
- Still maintains acceptable audio quality

### 5. Enhanced Logging and Error Messages
**Changed**: Added comprehensive logging throughout the download process

```typescript
console.log(`[YouTubeService] Detected file from yt-dlp output: ${detectedFilePath}`);
console.log(`[YouTubeService] File size: ${fileSizeMB.toFixed(2)} MB`);
console.log(`[YouTubeService] Scanning file: ${f}, Age: ${fileAge}ms, Recent: ${isRecent}, MP3: ${isMp3}`);
```

**Benefits**:
- Easier debugging
- Better visibility into what's happening
- Helps identify issues in production

### 6. ID3 Tagging with Video Title
**Changed**: MP3s now embed ID3 metadata and set both title and artist to the YouTube video title

```typescript
const args = [
    // ... other args
    '--embed-metadata',
    '--metadata', 'title:%(title)s',
    '--metadata', 'artist:%(title)s',
    // ...
];
```

**Benefits**:
- Consistent metadata across all downloads
- Better playback display in media players
- No manual tag edits required

### 7. Improved User-Facing Error Messages
**Changed**: More descriptive error messages for end users

```typescript
let userMessage = '❌ Failed to download the audio.';

if (errorMsg.includes('File too large')) {
    userMessage += '\n\n⚠️ The file exceeds the maximum size limit (50 MB). Please try a shorter video.';
} else {
    userMessage += `\n\nError: ${errorMsg}`;
}
```

**Benefits**:
- Users understand what went wrong
- Actionable feedback (e.g., "try a shorter video")
- Better user experience

## File Size Reference

For reference, here's how audio bitrate affects file size for a 60-minute video:

| Bitrate | File Size | Quality     | Status vs 50MB Limit |
|---------|-----------|-------------|----------------------|
| Best    | ~83 MB    | Excellent   | ❌ Too large         |
| 192kbps | ~83 MB    | Excellent   | ❌ Too large         |
| 128kbps | ~55 MB    | Very Good   | ❌ Too large         |
| 96kbps  | ~41 MB    | Good        | ✅ Within limit      |

For shorter videos (e.g., 10-15 minutes), higher bitrates will work fine.

## Testing

To test the fixes:

```bash
cd /home/tom/ytBOT
npm run build

# Test with a short video (should work at high quality)
npx tsx test-fix.ts

# Monitor logs for detailed information
```

## Recommendations for Users

1. **Video Length Limits**: For best quality, keep videos under 30 minutes
2. **File Size**: The 50MB limit is a Telegram restriction, not a bot limitation
3. **Quality**: The bot will automatically try lower bitrates if needed

## Future Improvements

1. **Dynamic Bitrate Calculation**: Calculate optimal bitrate based on video duration
2. **Pre-flight Size Estimation**: Estimate final file size before downloading
3. **Progress Indicators**: Show download progress to users
4. **Configurable Limits**: Allow admins to adjust file size limits
5. **Format Options**: Let users choose between quality and file size

## Related Files

- `/src/features/youtube/youtube.service.ts` - Main download logic
- `/src/features/youtube/youtube.bot.ts` - Bot message handlers
- `/src/features/youtube/youtube.types.ts` - Type definitions
- `/test-fix.ts` - Test script
