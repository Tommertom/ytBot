import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DownloadOptions, DownloadResult, VideoInfo } from './youtube.types.js';

export class YouTubeService {
    private ytDlpPath: string;
    private maxFileSize: number; // in MB
    private defaultQuality: string;
    private fileDetectionWindow: number; // in milliseconds

    constructor(ytDlpPath: string = '/usr/local/bin/yt-dlp', maxFileSize: number = 50) {
        this.ytDlpPath = ytDlpPath;
        this.maxFileSize = maxFileSize;
        this.defaultQuality = 'best';
        this.fileDetectionWindow = 180000; // 3 minutes (increased from 60 seconds)
    }

    /**
     * Check if a URL is a YouTube URL
     */
    isYouTubeUrl(url: string): boolean {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;
        return youtubeRegex.test(url);
    }

    /**
     * Extract YouTube URLs from text
     */
    extractYouTubeUrls(text: string): string[] {
        const urlRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[^\s]+/gi;
        const matches = text.match(urlRegex);
        return matches ? matches.filter(url => this.isYouTubeUrl(url)) : [];
    }

    /**
     * Get video information without downloading
     */
    async getVideoInfo(url: string): Promise<VideoInfo | null> {
        try {
            const args = [
                '--dump-json',
                '--no-playlist',
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
     * Download YouTube video with automatic quality fallback
     */
    async downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult> {
        try {
            // First try with best audio quality
            let result = await this.attemptDownload(url, options, '0');

            if (!result.success && result.error?.includes('too large')) {
                console.log('File too large, trying lower audio quality (192kbps)...');

                // Try with 192kbps
                result = await this.attemptDownload(url, options, '192K');

                if (!result.success && result.error?.includes('too large')) {
                    console.log('Still too large, trying 128kbps...');

                    // Try with 128kbps
                    result = await this.attemptDownload(url, options, '128K');

                    if (!result.success && result.error?.includes('too large')) {
                        console.log('Still too large, trying 96kbps...');

                        // Try with 96kbps (lowest acceptable quality)
                        result = await this.attemptDownload(url, options, '96K');
                    }
                }
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

        const args = [
            '-x', // Extract audio
            '--audio-format', 'mp3', // Convert to MP3
            '--audio-quality', audioBitrate, // Audio quality/bitrate
            '--no-playlist',
            '--output', outputTemplate,
            '--max-filesize', `${this.maxFileSize}M`,
            '--print', 'after_move:filepath', // Print final file path
            '--no-warnings',
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
                    detectedFilePath = trimmedLine;
                    console.log(`[YouTubeService] Detected file from yt-dlp output: ${detectedFilePath}`);
                    break;
                }
            }

            // If we got the file path from yt-dlp, use it directly
            if (detectedFilePath && fs.existsSync(detectedFilePath)) {
                const stats = fs.statSync(detectedFilePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                
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
                        error: 'File too large'
                    };
                }

                return {
                    success: true,
                    filePath: detectedFilePath,
                    fileName: path.basename(detectedFilePath),
                    fileSize: stats.size
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
                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                
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
                        error: 'File too large'
                    };
                }

                return {
                    success: true,
                    filePath,
                    fileName: files[0],
                    fileSize: stats.size
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
