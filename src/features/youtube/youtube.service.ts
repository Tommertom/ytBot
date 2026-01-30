import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import NodeID3 from 'node-id3';
import { DownloadOptions, DownloadResult, VideoInfo, PlaylistInfo, PlaylistVideoInfo, PlaylistDownloadOptions, PlaylistDownloadResult } from './youtube.types.js';

export class YouTubeService {
    private ytDlpPath: string;
    private maxFileSize: number; // in MB
    private defaultQuality: string;
    private fileDetectionWindow: number; // in milliseconds
    private static readonly MAX_URL_LENGTH = 2048;

    constructor(ytDlpPath: string = '/usr/local/bin/yt-dlp', maxFileSize: number = 50) {
        this.ytDlpPath = ytDlpPath;
        this.maxFileSize = maxFileSize;
        this.defaultQuality = 'best';
        this.fileDetectionWindow = 180000; // 3 minutes (increased from 60 seconds)

        this.verifyYtDlpPath();
    }

    /**
     * Verify that ytDlpPath points to a valid yt-dlp executable
     */
    private verifyYtDlpPath(): void {
        if (!fs.existsSync(this.ytDlpPath)) {
            throw new Error(`yt-dlp not found at path: ${this.ytDlpPath}`);
        }

        const stats = fs.statSync(this.ytDlpPath);
        if (!stats.isFile()) {
            throw new Error(`yt-dlp path is not a file: ${this.ytDlpPath}`);
        }
    }

    /**
     * Check if a URL is a YouTube URL
     * Security: Validates URL scheme and length
     */
    isYouTubeUrl(url: string): boolean {
        // Security fix #2: Validate URL length to prevent DoS
        if (url.length > YouTubeService.MAX_URL_LENGTH) {
            console.warn(`[YouTubeService] URL exceeds maximum length: ${url.length} > ${YouTubeService.MAX_URL_LENGTH}`);
            return false;
        }

        // Security fix #1: Require http:// or https:// scheme (prevent file://, data://, etc.)
        if (!/^https?:\/\//i.test(url)) {
            console.warn(`[YouTubeService] URL missing or invalid scheme: ${url}`);
            return false;
        }

        // Validate YouTube domain (including playlists)
        const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|playlist\?list=)|youtu\.be\/)/i;
        return youtubeRegex.test(url);
    }

    /**
     * Extract YouTube URLs from text
     */
    extractYouTubeUrls(text: string): string[] {
        const urlRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|playlist\?list=)|youtu\.be\/)[^\s]+/gi;
        const matches = text.match(urlRegex);
        return matches ? matches.filter(url => this.isYouTubeUrl(url)) : [];
    }

    /**
     * Check if a URL contains a YouTube playlist
     * Security: Validates URL scheme and length
     */
    isPlaylistUrl(url: string): boolean {
        if (url.length > YouTubeService.MAX_URL_LENGTH) {
            return false;
        }

        if (!/^https?:\/\//i.test(url)) {
            return false;
        }

        const playlistRegex = /[?&]list=([a-zA-Z0-9_-]+)/;
        const isPlaylistPage = /youtube\.com\/playlist\?list=/i.test(url);

        return isPlaylistPage || playlistRegex.test(url);
    }

    /**
     * Extract playlist ID from URL
     */
    extractPlaylistId(url: string): string | null {
        const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    /**
     * Get playlist information without downloading
     */
    async getPlaylistInfo(url: string): Promise<PlaylistInfo | null> {
        try {
            const args = [
                '--dump-json',
                '--flat-playlist',
                '--',
                url
            ];

            const output = await this.executeYtDlp(args);
            const lines = output.trim().split('\n');

            const videos: PlaylistVideoInfo[] = [];
            let playlistTitle = 'Unknown Playlist';

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const info = JSON.parse(line);

                    if (info._type === 'playlist' || info.playlist_title) {
                        playlistTitle = info.title || info.playlist_title || playlistTitle;
                    }

                    if (info.id && info._type !== 'playlist') {
                        videos.push({
                            id: info.id,
                            title: info.title || 'Unknown',
                            duration: info.duration || 0,
                            url: `https://www.youtube.com/watch?v=${info.id}`
                        });
                    }
                } catch (e) {
                    console.error('[YouTubeService] Failed to parse playlist item:', e);
                }
            }

            if (videos.length === 0) {
                playlistTitle = 'Unknown Playlist';
            }

            return {
                title: playlistTitle,
                videoCount: videos.length,
                videos: videos
            };
        } catch (error) {
            console.error('[YouTubeService] Failed to get playlist info:', error);
            return null;
        }
    }

    /**
     * Get video information without downloading
     */
    async getVideoInfo(url: string): Promise<VideoInfo | null> {
        try {
            const args = [
                '--dump-json',
                '--no-playlist',
                '--', // Security: Argument separator
                url
            ];

            const output = await this.executeYtDlp(args);
            const info = JSON.parse(output);

            return {
                title: info.title || 'Unknown',
                duration: info.duration || 0,
                fileSize: info.filesize || info.filesize_approx
            };
        } catch (error) {
            console.error('Failed to get video info:', error);
            return null;
        }
    }

    /**
     * Calculate optimal bitrate based on file size ratio
     */
    private calculateNextBitrate(currentBitrate: number, actualSizeMB: number, targetSizeMB: number): number {
        // Calculate the ratio and apply a safety margin (0.95 to stay well under the limit)
        const ratio = (targetSizeMB / actualSizeMB) * 0.95;
        const calculatedBitrate = Math.floor(currentBitrate * ratio);

        // Ensure we don't go below 48kbps (minimum acceptable quality)
        const minBitrate = 48;
        const nextBitrate = Math.max(calculatedBitrate, minBitrate);

        console.log(`[YouTubeService] Bitrate calculation: ${currentBitrate}K @ ${actualSizeMB.toFixed(2)}MB → ${nextBitrate}K (target: ${targetSizeMB}MB, ratio: ${ratio.toFixed(3)})`);

        return nextBitrate;
    }

    /**
     * Download YouTube video with automatic quality fallback
     */
    async downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult> {
        try {
            const statusCallback = options.statusCallback;
            const predefinedQualities = [192, 128, 96, 64, 48]; // Fallback qualities in kbps
            let attemptCount = 0;
            const maxAttempts = 6; // Prevent infinite loops

            // First try with best audio quality
            let result = await this.attemptDownload(url, options, '0');
            attemptCount++;

            // Smart quality fallback with calculated bitrates
            while (!result.success && result.error?.includes('too large') && attemptCount < maxAttempts) {
                let nextBitrate: number;

                if (result.fileSize && attemptCount === 1) {
                    // We have size info from the first "best quality" attempt
                    // Calculate optimal bitrate based on actual file size
                    const actualSizeMB = result.fileSize / (1024 * 1024);

                    // Estimate the bitrate used (assume best quality is around 256kbps for calculation)
                    const estimatedCurrentBitrate = 256;
                    nextBitrate = this.calculateNextBitrate(estimatedCurrentBitrate, actualSizeMB, this.maxFileSize);

                    const msg = `⚠️ File too large (${actualSizeMB.toFixed(1)}MB). Reducing quality... [Attempt ${attemptCount + 1}/${maxAttempts}]`;
                    console.log(msg);
                    if (statusCallback) await statusCallback(msg);
                } else if (result.fileSize && result.currentBitrate) {
                    // We have size and bitrate from previous attempt
                    const actualSizeMB = result.fileSize / (1024 * 1024);
                    nextBitrate = this.calculateNextBitrate(result.currentBitrate, actualSizeMB, this.maxFileSize);

                    const msg = `⚠️ Still too large (${actualSizeMB.toFixed(1)}MB). Trying ${nextBitrate}kbps... [Attempt ${attemptCount + 1}/${maxAttempts}]`;
                    console.log(msg);
                    if (statusCallback) await statusCallback(msg);
                } else {
                    // Fallback to predefined qualities if we don't have size info
                    nextBitrate = predefinedQualities[Math.min(attemptCount - 1, predefinedQualities.length - 1)];

                    const msg = `⚠️ File too large. Trying ${nextBitrate}kbps... [Attempt ${attemptCount + 1}/${maxAttempts}]`;
                    console.log(msg);
                    if (statusCallback) await statusCallback(msg);
                }

                // Attempt download with calculated bitrate
                result = await this.attemptDownload(url, options, `${nextBitrate}K`);
                attemptCount++;
            }

            // If still too large after all attempts
            if (!result.success && result.error?.includes('too large')) {
                const msg = '❌ Unable to reduce file size below 50MB even at lowest quality. Please try a shorter video.';
                console.log(msg);
                if (statusCallback) await statusCallback(msg);
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Attempt to download with specific quality
     */
    private async attemptDownload(url: string, options: DownloadOptions, audioBitrate: string): Promise<DownloadResult> {
        const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s');
        const downloadStartTime = Date.now();

        // Security fix #1: Add '--' separator to prevent URL from being interpreted as argument
        const args = [
            '-x', // Extract audio
            '--audio-format', 'mp3', // Convert to MP3
            '--audio-quality', audioBitrate, // Audio quality/bitrate
            '--embed-metadata', // Embed metadata into the MP3
            '--metadata', 'title:%(title)s', // Set ID3 title to video title
            '--metadata', 'artist:%(title)s', // Set ID3 artist to video title
            '--metadata', 'album:%(title)s', // Set ID3 album to video title (Sonos display)
            '--metadata', 'album_artist:%(title)s', // Set ID3 album artist (Sonos display)
            '--embed-thumbnail', // Embed thumbnail as album art
            '--convert-thumbnails', 'jpg', // Ensure compatible thumbnail format
            '--no-playlist',
            '--output', outputTemplate,
            '--print', 'after_move:filepath', // Print final file path
            '--no-warnings',
            '--', // Argument separator - everything after this is treated as positional arguments
            url
        ];

        try {
            const output = await this.executeYtDlp(args);

            // Try to extract filename from yt-dlp output
            let detectedFilePath: string | null = null;
            const lines = output.trim().split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && fs.existsSync(trimmedLine) && trimmedLine.endsWith('.mp3')) {
                    // Security fix #3: Validate output path to prevent path traversal
                    if (!this.validateOutputPath(trimmedLine, options.outputPath)) {
                        console.error(`[YouTubeService] SECURITY: Path traversal detected - ${trimmedLine}`);
                        throw new Error('Path traversal detected in output file');
                    }

                    detectedFilePath = trimmedLine;
                    console.log(`[YouTubeService] Detected file from yt-dlp output: ${detectedFilePath}`);
                    break;
                }
            }

            // If we got the file path from yt-dlp, use it directly
            if (detectedFilePath && fs.existsSync(detectedFilePath)) {
                const stats = fs.statSync(detectedFilePath);
                const fileSizeMB = stats.size / (1024 * 1024);

                // Parse bitrate to number (remove 'K' suffix if present)
                const bitrateNum = audioBitrate === '0' ? 0 : parseInt(audioBitrate.replace('K', ''));

                console.log(`[YouTubeService] File size: ${fileSizeMB.toFixed(2)} MB`);

                // Validate final file size
                if (fileSizeMB > this.maxFileSize) {
                    console.log(`[YouTubeService] Final MP3 exceeds size limit (${fileSizeMB.toFixed(2)} MB > ${this.maxFileSize} MB)`);
                    // Clean up the oversized file
                    try {
                        fs.unlinkSync(detectedFilePath);
                    } catch (e) {
                        console.error('[YouTubeService] Failed to delete oversized file:', e);
                    }
                    return {
                        success: false,
                        error: 'File too large',
                        fileSize: stats.size,
                        currentBitrate: bitrateNum
                    };
                }

                this.logId3Tags(detectedFilePath);

                return {
                    success: true,
                    filePath: detectedFilePath,
                    fileName: path.basename(detectedFilePath),
                    fileSize: stats.size,
                    qualityUsed: audioBitrate,
                    currentBitrate: bitrateNum
                };
            }

            // Fallback: Find the downloaded file by scanning directory
            console.log(`[YouTubeService] Falling back to directory scan (detection window: ${this.fileDetectionWindow}ms)`);

            const files = fs.readdirSync(options.outputPath)
                .filter(f => {
                    const filePath = path.join(options.outputPath, f);
                    const stat = fs.statSync(filePath);
                    const fileAge = Date.now() - stat.mtimeMs;
                    const isRecent = fileAge < this.fileDetectionWindow;
                    const isMp3 = f.endsWith('.mp3');

                    console.log(`[YouTubeService] Scanning file: ${f}, Age: ${fileAge}ms, Recent: ${isRecent}, MP3: ${isMp3}`);

                    return stat.isFile() && isMp3 && isRecent;
                })
                .sort((a, b) => {
                    const statA = fs.statSync(path.join(options.outputPath, a));
                    const statB = fs.statSync(path.join(options.outputPath, b));
                    return statB.mtimeMs - statA.mtimeMs;
                });

            console.log(`[YouTubeService] Found ${files.length} candidate file(s)`);

            if (files.length > 0) {
                const filePath = path.join(options.outputPath, files[0]);

                // Security fix #3: Validate output path to prevent path traversal
                if (!this.validateOutputPath(filePath, options.outputPath)) {
                    console.error(`[YouTubeService] SECURITY: Path traversal detected - ${filePath}`);
                    return {
                        success: false,
                        error: 'Path traversal detected in output file'
                    };
                }

                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);

                // Parse bitrate to number (remove 'K' suffix if present)
                const bitrateNum = audioBitrate === '0' ? 0 : parseInt(audioBitrate.replace('K', ''));

                console.log(`[YouTubeService] Selected file: ${files[0]}, Size: ${fileSizeMB.toFixed(2)} MB`);

                // Validate final file size
                if (fileSizeMB > this.maxFileSize) {
                    console.log(`[YouTubeService] Final MP3 exceeds size limit (${fileSizeMB.toFixed(2)} MB > ${this.maxFileSize} MB)`);
                    // Clean up the oversized file
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        console.error('[YouTubeService] Failed to delete oversized file:', e);
                    }
                    return {
                        success: false,
                        error: 'File too large',
                        fileSize: stats.size,
                        currentBitrate: bitrateNum
                    };
                }

                this.logId3Tags(filePath);

                return {
                    success: true,
                    filePath,
                    fileName: files[0],
                    fileSize: stats.size,
                    qualityUsed: audioBitrate,
                    currentBitrate: bitrateNum
                };
            }

            const downloadDuration = Date.now() - downloadStartTime;
            console.error(`[YouTubeService] No files found. Download duration: ${downloadDuration}ms, Detection window: ${this.fileDetectionWindow}ms`);

            return {
                success: false,
                error: 'Downloaded file not found'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            console.error('[YouTubeService] Download error:', errorMessage);

            // Check if error is due to file size
            if (errorMessage.includes('File is larger than max-filesize')) {
                return {
                    success: false,
                    error: 'File too large'
                };
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Download entire playlist sequentially
     * Maximum 50 videos (configurable), downloads one at a time
     */
    async downloadPlaylist(
        url: string,
        options: PlaylistDownloadOptions
    ): Promise<PlaylistDownloadResult> {
        const maxPlaylistSize = options.maxPlaylistSize || 50;
        const downloadDelayMs = options.downloadDelayMs || 1000;
        const results: DownloadResult[] = [];

        try {
            const playlistInfo = await this.getPlaylistInfo(url);

            if (!playlistInfo || playlistInfo.videos.length === 0) {
                return {
                    success: false,
                    error: 'Failed to get playlist information or playlist is empty',
                    downloaded: 0,
                    failed: 0,
                    total: 0
                };
            }

            const videosToDownload = playlistInfo.videos.slice(0, maxPlaylistSize);
            const totalVideos = videosToDownload.length;

            if (playlistInfo.videos.length > maxPlaylistSize) {
                const warningMsg = `⚠️ Playlist has ${playlistInfo.videos.length} videos. Downloading first ${maxPlaylistSize} only.`;
                console.log(`[YouTubeService] ${warningMsg}`);
                if (options.statusCallback) {
                    await options.statusCallback(warningMsg);
                }
            }

            for (let i = 0; i < videosToDownload.length; i++) {
                // Check if download was cancelled
                if (options.shouldStop?.()) {
                    console.log(`[YouTubeService] Playlist download stopped by user at video ${i + 1}/${totalVideos}`);
                    break;
                }

                const video = videosToDownload[i];
                const progressMsg = `📥 [${i + 1}/${totalVideos}] Downloading: ${video.title}`;

                console.log(`[YouTubeService] ${progressMsg}`);
                if (options.statusCallback) {
                    await options.statusCallback(progressMsg);
                }

                try {
                    const downloadResult = await this.downloadVideo(video.url, {
                        outputPath: options.outputPath,
                        quality: options.quality,
                        statusCallback: options.videoStatusCallback
                    });

                    results.push(downloadResult);

                    if (downloadResult.success) {
                        const fileSizeMB = downloadResult.fileSize ? (downloadResult.fileSize / (1024 * 1024)).toFixed(1) : '?';
                        const successMsg = `✅ [${i + 1}/${totalVideos}] Complete: ${video.title} (${fileSizeMB}MB)`;
                        console.log(`[YouTubeService] ${successMsg}`);
                        if (options.statusCallback) {
                            await options.statusCallback(successMsg);
                        }
                    } else {
                        const errorMsg = `❌ [${i + 1}/${totalVideos}] Failed: ${video.title} - ${downloadResult.error}`;
                        console.error(`[YouTubeService] ${errorMsg}`);
                        if (options.statusCallback) {
                            await options.statusCallback(errorMsg);
                        }
                    }

                    // Delay between downloads to avoid rate limiting
                    if (i < videosToDownload.length - 1) {
                        await this.delay(downloadDelayMs);
                    }

                } catch (error) {
                    const errorMsg = `❌ [${i + 1}/${totalVideos}] Error: ${video.title} - ${error}`;
                    console.error(`[YouTubeService] ${errorMsg}`);
                    if (options.statusCallback) {
                        await options.statusCallback(errorMsg);
                    }

                    results.push({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            return {
                success: successful > 0,
                downloaded: successful,
                failed: failed,
                total: totalVideos,
                results: results
            };

        } catch (error) {
            console.error('[YouTubeService] Playlist download error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                downloaded: 0,
                failed: 0,
                total: 0,
                results: results
            };
        }
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate that a file path is within the expected output directory
     * Security fix #3: Prevent path traversal attacks
     */
    private validateOutputPath(filePath: string, baseDir: string): boolean {
        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(baseDir);

        const isValid = resolvedPath.startsWith(resolvedBase);

        if (!isValid) {
            console.error(`[YouTubeService] Path validation failed:`);
            console.error(`  File path: ${resolvedPath}`);
            console.error(`  Base dir:  ${resolvedBase}`);
        }

        return isValid;
    }

    /**
     * Log ID3 tags for a downloaded MP3
     */
    private logId3Tags(filePath: string): void {
        try {
            if (!fs.existsSync(filePath)) {
                return;
            }

            const tags = NodeID3.read(filePath);

            console.log('[YouTubeService] ID3 tags:', {
                title: tags?.title ?? null,
                artist: tags?.artist ?? null,
                album: tags?.album ?? null,
                year: tags?.year ?? null,
                genre: tags?.genre ?? null,
                trackNumber: tags?.trackNumber ?? null
            });
        } catch (error) {
            console.error('[YouTubeService] Failed to read ID3 tags:', error);
        }
    }

    /**
     * Execute yt-dlp command
     */
    private executeYtDlp(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const process = spawn(this.ytDlpPath, args);

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }
}
