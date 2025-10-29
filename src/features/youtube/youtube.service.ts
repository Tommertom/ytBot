import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DownloadOptions, DownloadResult, VideoInfo } from './youtube.types.js';

export class YouTubeService {
    private ytDlpPath: string;
    private maxFileSize: number; // in MB
    private defaultQuality: string;

    constructor(ytDlpPath: string = '/usr/local/bin/yt-dlp', maxFileSize: number = 50) {
        this.ytDlpPath = ytDlpPath;
        this.maxFileSize = maxFileSize;
        this.defaultQuality = 'best';
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
            // First try with the specified quality (or best)
            let result = await this.attemptDownload(url, options, this.defaultQuality);

            if (!result.success && result.error?.includes('too large')) {
                console.log('File too large, trying lower quality...');

                // Try with 720p
                result = await this.attemptDownload(url, options, 'best[height<=720]');

                if (!result.success && result.error?.includes('too large')) {
                    console.log('Still too large, trying 480p...');

                    // Try with 480p
                    result = await this.attemptDownload(url, options, 'best[height<=480]');

                    if (!result.success && result.error?.includes('too large')) {
                        console.log('Still too large, trying 360p...');

                        // Try with 360p
                        result = await this.attemptDownload(url, options, 'best[height<=360]');
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
    private async attemptDownload(url: string, options: DownloadOptions, quality: string): Promise<DownloadResult> {
        const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s');

        const args = [
            '-x', // Extract audio
            '--audio-format', 'mp3', // Convert to MP3
            '--audio-quality', '0', // Best audio quality
            '--no-playlist',
            '--output', outputTemplate,
            '--max-filesize', `${this.maxFileSize}M`,
            '--no-warnings',
            url
        ];

        try {
            await this.executeYtDlp(args);

            // Find the downloaded file
            const files = fs.readdirSync(options.outputPath)
                .filter(f => {
                    const stat = fs.statSync(path.join(options.outputPath, f));
                    return stat.isFile() && (Date.now() - stat.mtimeMs) < 60000; // Files created in last minute
                })
                .sort((a, b) => {
                    const statA = fs.statSync(path.join(options.outputPath, a));
                    const statB = fs.statSync(path.join(options.outputPath, b));
                    return statB.mtimeMs - statA.mtimeMs;
                });

            if (files.length > 0) {
                const filePath = path.join(options.outputPath, files[0]);
                const stats = fs.statSync(filePath);

                return {
                    success: true,
                    filePath,
                    fileName: files[0],
                    fileSize: stats.size
                };
            }

            return {
                success: false,
                error: 'Downloaded file not found'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
