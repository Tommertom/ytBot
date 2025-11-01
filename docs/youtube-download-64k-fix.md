# YouTube Download Fix - 64K Quality Tier & Status Callbacks

**Date:** January 2025  
**Issue:** "Downloaded file not found" error for 95-minute concert video  
**Status:** Implementation complete, testing pending

## Problem Summary

The YouTube bot was failing to download a 95-minute concert video:

**Video:** Them Crooked Vultures live @ Royal Albert Hall 2010  
**URL:** https://www.youtube.com/watch?v=6ornm2zEcXA  
**Duration:** 5713 seconds (95.22 minutes)  
**Error:** "Downloaded file not found"

## Root Cause Discovery

### Initial Investigation
Test downloads revealed file sizes at different quality levels:
- Best quality: 87 MB
- 96K bitrate: 65.38 MB  
- All exceeded Telegram's 50 MB limit

### Critical Discovery: --max-filesize Limitation

**The Problem:**  
yt-dlp's `--max-filesize` parameter checks the **intermediate WebM file size** during download, NOT the final MP3 size after conversion.

**Test Results:**
```bash
# All quality levels failed with --max-filesize 50M
Quality 0:    WebM partial file = 48.63 MB (aborted)
Quality 192K: WebM partial file = 49.09 MB (aborted)  
Quality 128K: WebM partial file = 49.30 MB (aborted)
Quality 96K:  WebM partial file = 49.01 MB (aborted)
Quality 64K:  WebM partial file = 48.99 MB (aborted)
```

yt-dlp aborted all downloads before MP3 conversion could complete, even though the final MP3 files would have been smaller than the intermediate WebM files.

## Solution Implemented

### 1. Removed --max-filesize Parameter

**BEFORE:**
```typescript
const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', audioBitrate,
    '--no-playlist',
    '--output', outputTemplate,
    '--max-filesize', `${this.maxFileSize}M`,  // ❌ REMOVED
    '--print', 'after_move:filepath',
    '--no-warnings',
    url
];
```

**AFTER:**
```typescript
const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', audioBitrate,
    '--no-playlist',
    '--output', outputTemplate,
    // NOTE: Removed --max-filesize because it checks intermediate WebM size, not final MP3
    '--print', 'after_move:filepath',
    '--no-warnings',
    url
];
```

The existing post-download validation still applies:
```typescript
const fileSizeMB = stats.size / (1024 * 1024);

if (fileSizeMB > this.maxFileSize) {
    console.log(`[YouTubeService] Final MP3 exceeds size limit (${fileSizeMB.toFixed(2)} MB > ${this.maxFileSize} MB)`);
    fs.unlinkSync(detectedFilePath);
    return { success: false, error: 'File too large' };
}
```

### 2. Added 64K Quality Tier

Extended quality fallback chain:
- Best (0) → 192K → 128K → 96K → **64K** (new)

### 3. Implemented Status Callbacks

#### Type Definitions (youtube.types.ts)
```typescript
export interface DownloadOptions {
    outputPath: string;
    quality?: string;
    statusCallback?: (message: string) => void;  // NEW
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
    fileSize?: number;
    qualityUsed?: string;  // NEW
}
```

#### Service Implementation (youtube.service.ts)
```typescript
async downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult> {
    const quality = options.quality || this.defaultQuality;
    const callback = options.statusCallback;

    // Try best quality first
    let result = await this.attemptDownload(url, options, '0');

    // Quality fallback chain with user notifications
    if (!result.success && result.error?.includes('too large')) {
        callback?.('⚠️ Still too large, trying 192kbps...');
        result = await this.attemptDownload(url, options, '192K');

        if (!result.success && result.error?.includes('too large')) {
            callback?.('⚠️ Still too large, trying 128kbps...');
            result = await this.attemptDownload(url, options, '128K');

            if (!result.success && result.error?.includes('too large')) {
                callback?.('⚠️ Still too large, trying 96kbps...');
                result = await this.attemptDownload(url, options, '96K');

                if (!result.success && result.error?.includes('too large')) {
                    callback?.('⚠️ Still too large, trying 64kbps...');
                    result = await this.attemptDownload(url, options, '64K');
                }
            }
        }
    }

    return result;
}
```

#### Bot Handler Integration (youtube.bot.ts)
```typescript
const downloadResult = await this.youtubeService.downloadVideo(url, {
    outputPath: this.configService.getMediaTmpLocation(),
    quality: 'best',
    statusCallback: async (message: string) => {
        try {
            await ctx.reply(message);
        } catch (error) {
            console.error('[YouTubeBot] Failed to send status message:', error);
        }
    }
});
```

#### Quality Tracking
```typescript
private async attemptDownload(url: string, options: DownloadOptions, audioBitrate: string): Promise<DownloadResult> {
    // ... download logic ...
    
    return {
        success: true,
        filePath: detectedFilePath,
        fileName: path.basename(detectedFilePath),
        fileSize: stats.size,
        qualityUsed: audioBitrate  // Track which quality was used
    };
}
```

## Expected User Experience

### Quality Fallback Flow

1. User sends YouTube URL
2. Bot: `📥 Downloading audio: Them Crooked Vultures live @ Royal Albert Hall 2010\nPlease wait...`
3. Bot attempts download at best quality
4. Bot: `⚠️ Still too large, trying 192kbps...`
5. Bot: `⚠️ Still too large, trying 128kbps...`
6. Bot: `⚠️ Still too large, trying 96kbps...`
7. Bot: `⚠️ Still too large, trying 64kbps...`
8. Bot sends MP3 file (if successful) or error message

### Success Message
```
✅ Them Crooked Vultures live @ Royal Albert Hall 2010
[Audio file attached]
```

Console log:
```
[YouTubeBot] Successfully downloaded: Them Crooked Vultures... (43.6 MB) at 64K quality
```

## File Size Calculations

Theoretical file sizes for 95-minute (5713 second) video:

| Bitrate | Formula | Calculated Size | Status |
|---------|---------|-----------------|--------|
| 128K    | 5713s × 128kbps ÷ 8 | 87.2 MB | ❌ Too large |
| 96K     | 5713s × 96kbps ÷ 8  | 65.4 MB | ❌ Too large |
| 64K     | 5713s × 64kbps ÷ 8  | 43.6 MB | ✅ Should work |
| 48K     | 5713s × 48kbps ÷ 8  | 32.7 MB | ✅ Should work |

**Maximum video length at 64K:** ~104 minutes (50 MB ÷ 64 kbps × 8)

## Known Limitations

### Very Long Videos
Videos exceeding ~104 minutes will fail even at 64K quality:
- The 50 MB limit is imposed by Telegram Bot API
- Cannot be increased or circumvented
- Users must download such videos manually

### Download Time
Removing `--max-filesize` means:
- Full WebM download completes before size check
- Longer wait time before quality fallback kicks in
- Trade-off: Reliability vs. speed

## Testing Required

### Test Cases
- [x] Build compiles without errors
- [ ] Short video (< 5 min): Should succeed at best quality
- [ ] Medium video (10-30 min): Should succeed at 192K or 128K
- [ ] Long video (90+ min): Should fall back to 64K
- [ ] Very long video (>120 min): Should fail with clear error

### Test URLs
```
# Problematic 95-minute video
https://www.youtube.com/watch?v=6ornm2zEcXA

# Short video for quick testing
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Manual Testing Steps
```bash
# 1. Build project
cd /home/tom/ytBOT
npm run build

# 2. Start bot
npm start

# 3. Send test URL to bot
# 4. Observe status messages
# 5. Verify MP3 is received
# 6. Check console logs for quality used
```

## Files Modified

1. **youtube.service.ts**
   - Removed `--max-filesize` parameter (line ~125)
   - Added 64K quality tier to fallback chain (line ~65-90)
   - Added statusCallback support (line ~60-100)
   - Added qualityUsed tracking (line ~175, ~230)

2. **youtube.types.ts**
   - Added `statusCallback?: (message: string) => void` to DownloadOptions
   - Added `qualityUsed?: string` to DownloadResult

3. **youtube.bot.ts**
   - Wired statusCallback to send Telegram messages (line ~105)
   - Added quality logging to success message (line ~108)

4. **docs/youtube-download-64k-fix.md** (this file)
   - Complete documentation of problem and solution

## Deployment Checklist

- [x] Code changes completed
- [x] TypeScript compilation successful
- [x] No TypeScript errors in modified files
- [ ] Test with problematic video URL
- [ ] Test with short video
- [ ] Test with medium video
- [ ] Verify user notifications appear
- [ ] Verify quality tracking works
- [ ] Verify file cleanup after send
- [ ] Deploy to production
- [ ] Monitor for errors

## Rollback Plan

If issues occur in production:

1. Revert commits:
   ```bash
   git revert HEAD~3..HEAD
   ```

2. Emergency fix (restore --max-filesize):
   ```typescript
   // In attemptDownload(), add back:
   '--max-filesize', `${this.maxFileSize}M`,
   ```

3. Remove 64K quality tier from fallback chain

4. Rebuild and redeploy:
   ```bash
   npm run build
   npm restart
   ```

## Future Enhancements

### Possible Improvements
1. **Pre-download size estimation:** Query video info and estimate MP3 size before downloading
2. **Dynamic bitrate calculation:** `requiredBitrate = (50MB × 8) ÷ duration_seconds × 1000`
3. **Progress indicators:** Show download progress percentage
4. **Chunked audio:** Split very long videos into multiple MP3 files
5. **Cloud storage:** Upload to S3/Drive and send link instead of file

### Not Implemented (Out of Scope)
- Video format downloads (too large)
- Playlist support (too many files)
- Custom bitrate selection (complexity)
- Subtitle extraction (different feature)

---

## Summary

**Problem:** `--max-filesize` checked intermediate WebM, not final MP3  
**Solution:** Remove `--max-filesize`, validate MP3 after conversion  
**Benefit:** Allows quality fallback to work correctly  
**Outcome:** 95-minute videos should now succeed at 64K quality  

**Key Insight:** yt-dlp downloads full WebM → converts to MP3. The WebM is always larger than the final MP3, so checking WebM size prevents successful downloads that would have produced acceptable MP3 files.
