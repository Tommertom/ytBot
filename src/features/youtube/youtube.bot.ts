import { Bot, Context, InputFile, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { YouTubeService } from './youtube.service.js';
import { TRANSCRIPT_DIRECTORY_NAME } from './youtube.types.js';
import { ConfigService } from '../../services/config.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';

export class YouTubeBot {
    private youtubeService: YouTubeService;
    private configService: ConfigService;
    private activePlaylistDownloads: Map<string, { cancelled: boolean }> = new Map();
    private readonly commandPatterns: Map<string, RegExp> = new Map();

    constructor(
        botId: string,
        youtubeService: YouTubeService,
        configService: ConfigService
    ) {
        this.youtubeService = youtubeService;
        this.configService = configService;
    }

    registerHandlers(bot: Bot): void {

        // Register command handlers
        bot.command('start', AccessControlMiddleware.requireAccess, this.handleStart.bind(this));
        bot.command('help', AccessControlMiddleware.requireAccess, this.handleStart.bind(this)); // Wire help to start
        bot.command('text', AccessControlMiddleware.requireAccess, this.handleTranscriptCommand.bind(this));

        // Register callback query handler for stop button
        bot.callbackQuery(/^stop_playlist:/, this.handleStopPlaylist.bind(this));

        // Register message handler for YouTube links
        bot.on('message:text', AccessControlMiddleware.requireAccess, async (ctx, next) => {
            const handled = await this.handleTextMessage(ctx);
            if (!handled) {
                await next();
            }
        });
    }

    private async handleStopPlaylist(ctx: Context): Promise<void> {
        const data = ctx.callbackQuery?.data;
        if (!data) return;

        const downloadId = data.replace('stop_playlist:', '');
        const downloadState = this.activePlaylistDownloads.get(downloadId);

        if (downloadState) {
            downloadState.cancelled = true;
            await ctx.answerCallbackQuery({ text: '🛑 Stopping playlist download...' });
            console.log(`[YouTubeBot] Playlist download ${downloadId} cancelled by user`);
        } else {
            await ctx.answerCallbackQuery({ text: 'Download already finished or not found.' });
        }
    }

    private async handleStart(ctx: Context): Promise<void> {
        try {
            const helpMessage = [
                '👋 Welcome to YouTube Audio Download Bot!',
                '',
                'Available commands:',
                '/start - Show this help message',
                '/help - Show this help message',
                '/text <youtube-url> - Download the English transcript as markdown',
                '/sonos - Select a Sonos device or send a YouTube URL',
                '',
                '📥 Single Videos:',
                'Send me a YouTube video URL and I\'ll download the audio as MP3!',
                '',
                '📝 Transcripts:',
                'Use /text <youtube-url> to get the English transcript as a markdown file.',
                '',
                '🔊 Sonos Playback:',
                'Use /sonos to select a device, then /sonos <youtube-url> to play.',
                '',
                '📋 Playlists:',
                'Send me a playlist URL and I\'ll download up to 50 videos sequentially.',
                '',
                '✨ Features:',
                '• Automatic quality optimization (max 50MB per file)',
                '• Progress updates for playlists',
                '• Error resilience - failed videos won\'t stop the playlist',
                '',
                '🎵 Just send me a YouTube URL to get started!'
            ].join('\n');

            const sentMessage = await ctx.reply(helpMessage);

            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0 && sentMessage) {
                await MessageUtils.scheduleMessageDeletion(
                    ctx,
                    sentMessage.message_id,
                    deleteTimeout
                );
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('show help message', error));
        }
    }

    private async handleTranscriptCommand(ctx: Context): Promise<void> {
        if (!ctx.message?.text) {
            await ctx.reply('Usage: /text <youtube-url>');
            return;
        }

        const args = this.extractCommandArguments(ctx.message.text, 'text');
        const youtubeUrls = this.youtubeService.extractYouTubeUrls(args);

        if (youtubeUrls.length !== 1) {
            await ctx.reply('Please provide exactly one YouTube video URL.\n\nUsage: /text <youtube-url>');
            return;
        }

        const url = youtubeUrls[0];
        if (this.youtubeService.isPlaylistUrl(url)) {
            await ctx.reply('❌ /text supports single YouTube videos only, not playlists.');
            return;
        }

        const statusMessage = await ctx.reply('📝 Downloading the English transcript. Please wait...');
        let transcriptFilePath: string | undefined;

        try {
            const transcriptResult = await this.youtubeService.downloadTranscript(url, {
                outputPath: this.configService.getMediaTmpLocation()
            });

            if (!transcriptResult.success || !transcriptResult.filePath) {
                await ctx.reply(`❌ Failed to download transcript.\n\nError: ${transcriptResult.error || 'Unknown error'}`);
                return;
            }

            transcriptFilePath = transcriptResult.filePath;
            await AccessControlMiddleware.notifyAdminOfDownload(ctx, url);

            await ctx.replyWithDocument(new InputFile(transcriptFilePath), {
                caption: `📝 ${transcriptResult.title || 'English transcript'}`
            });
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('download transcript', error));
        } finally {
            try {
                await ctx.api.deleteMessage(ctx.chat!.id, statusMessage.message_id);
            } catch (error) {
                console.error('Failed to delete transcript status message:', error);
            }

            if (transcriptFilePath) {
                this.cleanupTranscriptSession(transcriptFilePath);
            }
        }
    }

    private async handleTextMessage(ctx: Context): Promise<boolean> {
        if (!ctx.message?.text) return false;

        try {
            const text = ctx.message.text;
            if (text.trim().startsWith('/')) {
                return false;
            }
            const youtubeUrls = this.youtubeService.extractYouTubeUrls(text);

            if (youtubeUrls.length === 0) {
                return false;
            }

            const confirmationMessage = await ctx.reply(
                `✅ YouTube link${youtubeUrls.length > 1 ? 's' : ''} detected! Processing ${youtubeUrls.length} video${youtubeUrls.length > 1 ? 's' : ''}...`
            );

            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0 && confirmationMessage) {
                await MessageUtils.scheduleMessageDeletion(
                    ctx,
                    confirmationMessage.message_id,
                    deleteTimeout
                );
                console.log(`[YouTubeBot] Scheduled message deletion in ${deleteTimeout}ms`);
            }

            for (const url of youtubeUrls) {
                if (this.youtubeService.isPlaylistUrl(url)) {
                    await this.handlePlaylistDownload(ctx, url);
                } else {
                    await this.handleSingleVideoDownload(ctx, url);
                }
            }

            return true;
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('process message', error));
            return true;
        }
    }

    private async handlePlaylistDownload(ctx: Context, url: string): Promise<void> {
        await AccessControlMiddleware.notifyAdminOfDownload(ctx, url);

        const playlistInfo = await this.youtubeService.getPlaylistInfo(url);

        if (!playlistInfo || playlistInfo.videos.length === 0) {
            await ctx.reply('❌ Failed to get playlist information or playlist is empty.');
            return;
        }

        const maxPlaylistSize = this.configService.getMaxPlaylistSize();
        const videosToDownload = Math.min(playlistInfo.videoCount, maxPlaylistSize);

        // Generate unique download ID for this playlist download
        const downloadId = `${ctx.chat!.id}_${Date.now()}`;
        const downloadState = { cancelled: false };
        this.activePlaylistDownloads.set(downloadId, downloadState);

        const confirmationMsg = [
            `📋 Playlist detected: ${playlistInfo.title}`,
            `📊 Total videos: ${playlistInfo.videoCount}`,
            `⬇️ Will download: ${videosToDownload} videos`,
            ``,
            `⏳ This may take a while. Processing sequentially...`,
            `💡 Large files may require multiple quality attempts.`
        ].join('\n');

        // Create stop button
        const stopKeyboard = new InlineKeyboard()
            .text('🛑 Stop Download', `stop_playlist:${downloadId}`);

        const statusMessage = await ctx.reply(confirmationMsg, {
            reply_markup: stopKeyboard
        });

        try {
            const result = await this.youtubeService.downloadPlaylist(url, {
                outputPath: this.configService.getMediaTmpLocation(),
                quality: 'best',
                maxPlaylistSize: maxPlaylistSize,
                downloadDelayMs: this.configService.getPlaylistDownloadDelay(),
                shouldStop: () => downloadState.cancelled,
                statusCallback: async (message: string) => {
                    try {
                        const progressMsg = await ctx.reply(message);

                        // "Downloading:" messages should stay visible until done
                        // Other messages (success, failure, warnings) can be auto-deleted
                        const isDownloadingMessage = message.includes('Downloading:');

                        if (!isDownloadingMessage) {
                            const deleteTimeout = this.configService.getMessageDeleteTimeout();
                            if (deleteTimeout > 0 && progressMsg) {
                                await MessageUtils.scheduleMessageDeletion(
                                    ctx,
                                    progressMsg.message_id,
                                    deleteTimeout
                                );
                            }
                        }
                    } catch (error) {
                        console.error('[YouTubeBot] Failed to send progress message:', error);
                    }
                }
            });

            // Clean up download state
            this.activePlaylistDownloads.delete(downloadId);

            // Remove stop button by editing the message
            try {
                await ctx.api.editMessageReplyMarkup(ctx.chat!.id, statusMessage.message_id, {
                    reply_markup: undefined
                });
            } catch (error) {
                console.error('[YouTubeBot] Failed to remove stop button:', error);
            }

            const wasCancelled = downloadState.cancelled;
            const summaryMsg = wasCancelled ? [
                `🛑 Playlist download stopped by user.`,
                ``,
                `📊 Summary:`,
                `   ✅ Downloaded: ${result.downloaded}`,
                `   ❌ Failed: ${result.failed}`,
                `   ⏹️ Skipped: ${result.total - result.downloaded - result.failed}`,
                `   📝 Total: ${result.total}`
            ].join('\n') : [
                `✅ Playlist download complete!`,
                ``,
                `📊 Summary:`,
                `   ✅ Downloaded: ${result.downloaded}`,
                `   ❌ Failed: ${result.failed}`,
                `   📝 Total: ${result.total}`
            ].join('\n');

            await ctx.reply(summaryMsg);

            if (result.results) {
                for (const videoResult of result.results) {
                    if (videoResult.success && videoResult.filePath) {
                        try {
                            await ctx.replyWithAudio(new InputFile(videoResult.filePath), {
                                caption: `🎧 ${videoResult.fileName}`,
                                performer: 'YouTube Playlist'
                            });

                            fs.unlinkSync(videoResult.filePath);
                            console.log(`[YouTubeBot] Cleaned up: ${videoResult.filePath}`);
                        } catch (error) {
                            console.error('[YouTubeBot] Failed to send file:', error);
                        }
                    }
                }
            }

            try {
                await ctx.api.deleteMessage(ctx.chat!.id, statusMessage.message_id);
            } catch (error) {
                console.error('[YouTubeBot] Failed to delete status message:', error);
            }

        } catch (error) {
            // Clean up download state on error
            this.activePlaylistDownloads.delete(downloadId);

            // Remove stop button
            try {
                await ctx.api.editMessageReplyMarkup(ctx.chat!.id, statusMessage.message_id, {
                    reply_markup: undefined
                });
            } catch (e) {
                console.error('[YouTubeBot] Failed to remove stop button:', e);
            }

            await ctx.reply(ErrorUtils.createErrorMessage('download playlist', error));

            try {
                await ctx.api.deleteMessage(ctx.chat!.id, statusMessage.message_id);
            } catch (error) {
                console.error('[YouTubeBot] Failed to delete status message:', error);
            }
        }
    }

    private async handleSingleVideoDownload(ctx: Context, url: string): Promise<void> {
        await AccessControlMiddleware.notifyAdminOfDownload(ctx, url);

        const videoInfo = await this.youtubeService.getVideoInfo(url);

        if (!videoInfo) {
            await ctx.reply('❌ Failed to get video information. Please check the URL and try again.');
            return;
        }

        const downloadMessage = await ctx.reply(`📥 Downloading audio: ${videoInfo.title}\nPlease wait...`);

        try {
            const downloadResult = await this.youtubeService.downloadVideo(url, {
                outputPath: this.configService.getMediaTmpLocation(),
                quality: 'best',
                statusCallback: async (message: string) => {
                    try {
                        const statusMessage = await ctx.reply(message);
                        const deleteTimeout = this.configService.getMessageDeleteTimeout();
                        if (deleteTimeout > 0 && statusMessage) {
                            await MessageUtils.scheduleMessageDeletion(
                                ctx,
                                statusMessage.message_id,
                                deleteTimeout
                            );
                        }
                    } catch (error) {
                        console.error('[YouTubeBot] Failed to send status message:', error);
                    }
                }
            });

            if (downloadResult.success && downloadResult.filePath) {
                const fileSizeMB = ((downloadResult.fileSize || 0) / 1024 / 1024).toFixed(2);
                const qualityInfo = downloadResult.qualityUsed ? ` at ${downloadResult.qualityUsed} quality` : '';
                console.log(`[YouTubeBot] Successfully downloaded: ${downloadResult.fileName} (${fileSizeMB} MB)${qualityInfo}`);

                await ctx.replyWithAudio(new InputFile(downloadResult.filePath), {
                    caption: `🎧 ${videoInfo.title}`,
                    title: videoInfo.title,
                    performer: 'YouTube'
                });

                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
                } catch (error) {
                    console.error('Failed to delete download message:', error);
                }

                try {
                    fs.unlinkSync(downloadResult.filePath);
                    console.log(`[YouTubeBot] Cleaned up file: ${downloadResult.filePath}`);
                } catch (error) {
                    console.error('Error cleaning up file:', error);
                }
            } else {
                const errorMsg = downloadResult.error || 'Unknown error';
                console.error(`[YouTubeBot] Download failed: ${errorMsg}`);

                let userMessage = '❌ Failed to download the audio.';

                if (errorMsg.includes('File too large')) {
                    userMessage += '\n\n⚠️ The file exceeds the maximum size limit (50 MB). Please try a shorter video.';
                } else {
                    userMessage += `\n\nError: ${errorMsg}`;
                }

                await ctx.reply(userMessage);

                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
                } catch (error) {
                    console.error('Failed to delete download message:', error);
                }
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('download video', error));

            try {
                await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
            } catch (error) {
                console.error('Failed to delete download message:', error);
            }
        }
    }

    private extractCommandArguments(text: string, command: string): string {
        let commandPattern = this.commandPatterns.get(command);
        if (!commandPattern) {
            commandPattern = new RegExp(`^\\/${command}(?:@\\w+)?\\s*`, 'i');
            this.commandPatterns.set(command, commandPattern);
        }

        return text.replace(commandPattern, '').trim();
    }

    private cleanupTranscriptSession(filePath: string): void {
        const transcriptRoot = path.resolve(this.configService.getMediaTmpLocation(), TRANSCRIPT_DIRECTORY_NAME);
        const sessionDir = path.resolve(path.dirname(filePath));
        const relativePath = path.relative(transcriptRoot, sessionDir);

        if (
            relativePath === '' ||
            relativePath.startsWith('..') ||
            path.isAbsolute(relativePath)
        ) {
            console.error(`[YouTubeBot] Refusing to clean up unexpected transcript path: ${sessionDir}`);
            return;
        }

        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}
