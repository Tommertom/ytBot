import { Bot, Context, InputFile } from 'grammy';
import * as fs from 'fs';
import { YouTubeService } from './youtube.service.js';
import { ConfigService } from '../../services/config.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';

export class YouTubeBot {
    private youtubeService: YouTubeService;
    private configService: ConfigService;

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

        // Register message handler for YouTube links
        bot.on('message:text', AccessControlMiddleware.requireAccess, this.handleTextMessage.bind(this));
    }

    private async handleStart(ctx: Context): Promise<void> {
        try {
            const helpMessage = [
                '👋 Welcome to YouTube Audio Download Bot!',
                '',
                'Available commands:',
                '/start - Show this help message',
                '/help - Show this help message',
                '',
                'Just send me a message containing a YouTube URL, and I\'ll download the audio as MP3 for you! �'
            ].join('\n');

            await ctx.reply(helpMessage, { parse_mode: 'HTML' });
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('show help message', error));
        }
    }

    private async handleTextMessage(ctx: Context): Promise<void> {
        if (!ctx.message?.text) return;

        try {
            const text = ctx.message.text;
            const youtubeUrls = this.youtubeService.extractYouTubeUrls(text);

            if (youtubeUrls.length === 0) {
                // No YouTube URLs found in the message
                return;
            }

            // Send confirmation message that will be auto-deleted
            const confirmationMessage = await ctx.reply(
                `✅ YouTube link${youtubeUrls.length > 1 ? 's' : ''} detected! Processing ${youtubeUrls.length} video${youtubeUrls.length > 1 ? 's' : ''}...`
            );

            // Schedule confirmation message for deletion
            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0 && confirmationMessage) {
                await MessageUtils.scheduleMessageDeletion(
                    ctx,
                    confirmationMessage.message_id,
                    deleteTimeout
                );
                console.log(`[YouTubeBot] Scheduled message deletion in ${deleteTimeout}ms`);
            }

            // Process each YouTube URL found in the message
            for (const url of youtubeUrls) {
                // Notify admin if non-admin user is downloading
                await AccessControlMiddleware.notifyAdminOfDownload(ctx, url);
                
                // Get video info first
                const videoInfo = await this.youtubeService.getVideoInfo(url);

                if (!videoInfo) {
                    await ctx.reply('❌ Failed to get video information. Please check the URL and try again.');
                    continue;
                }

                // Check video duration and size limits here if needed
                const downloadMessage = await ctx.reply(`📥 Downloading audio: ${videoInfo.title}\nPlease wait...`);

                try {
                    // Download the video audio
                    const downloadResult = await this.youtubeService.downloadVideo(url, {
                        outputPath: this.configService.getMediaTmpLocation(),
                        quality: 'best'
                    });

                    if (downloadResult.success && downloadResult.filePath) {
                        const fileSizeMB = ((downloadResult.fileSize || 0) / 1024 / 1024).toFixed(2);
                        console.log(`[YouTubeBot] Successfully downloaded: ${downloadResult.fileName} (${fileSizeMB} MB)`);
                        
                        // Send the audio file using InputFile
                        await ctx.replyWithAudio(new InputFile(downloadResult.filePath), {
                            caption: `✅ ${videoInfo.title}`,
                            title: videoInfo.title,
                            performer: 'YouTube'
                        });

                        // Delete the download message after successful completion
                        try {
                            await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
                        } catch (error) {
                            console.error('Failed to delete download message:', error);
                        }

                        // Clean up the downloaded file
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

                        // Delete the download message after failure
                        try {
                            await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
                        } catch (error) {
                            console.error('Failed to delete download message:', error);
                        }
                    }
                } catch (error) {
                    await ctx.reply(ErrorUtils.createErrorMessage('download video', error));

                    // Delete the download message after error
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
                    } catch (error) {
                        console.error('Failed to delete download message:', error);
                    }
                }
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('process message', error));
        }
    }
}
