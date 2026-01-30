import { Bot, Context, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { ConfigService } from '../../services/config.service.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { YouTubeService } from '../youtube/youtube.service.js';
import { SonosDevice } from './sonos.types.js';
import { SonosService } from './sonos.service.js';

export class SonosBot {
    private readonly youtubeService: YouTubeService;
    private readonly configService: ConfigService;
    private readonly sonosService: SonosService;
    private readonly downloadDir: string;
    private readonly userSelectedDevice: Map<number, SonosDevice> = new Map();
    private readonly lastDiscoveryByUser: Map<number, SonosDevice[]> = new Map();

    constructor(
        botId: string,
        youtubeService: YouTubeService,
        configService: ConfigService,
        sonosService: SonosService,
        downloadDir: string
    ) {
        this.youtubeService = youtubeService;
        this.configService = configService;
        this.sonosService = sonosService;
        this.downloadDir = downloadDir;
    }

    registerHandlers(bot: Bot): void {
        bot.command('sonos', AccessControlMiddleware.requireAccess, this.handleSonosCommand.bind(this));
        bot.callbackQuery(/^sonos_select:/, AccessControlMiddleware.requireAccess, this.handleSelectDevice.bind(this));
    }

    private async handleSonosCommand(ctx: Context): Promise<void> {
        if (!ctx.message?.text || !ctx.from) {
            return;
        }

        try {
            const args = this.extractCommandArgs(ctx.message.text);
            if (!args) {
                await this.showDevicePicker(ctx);
                return;
            }

            const urls = this.youtubeService.extractYouTubeUrls(args);
            if (urls.length === 0) {
                await ctx.reply('❌ No YouTube URL detected. Send /sonos to select a device or provide a valid YouTube link.');
                return;
            }

            const selectedDevice = this.userSelectedDevice.get(ctx.from.id);
            if (!selectedDevice) {
                await ctx.reply('❌ No Sonos device selected. Send /sonos to pick a device first.');
                return;
            }

            if (urls.length > 1) {
                await ctx.reply('ℹ️ Multiple YouTube URLs detected. Using the first one.');
            }

            await this.sendToSonos(ctx, urls[0], selectedDevice);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('process Sonos command', error));
        }
    }

    private async showDevicePicker(ctx: Context): Promise<void> {
        try {
            const devices = await this.sonosService.discoverDevices();
            if (!devices.length) {
                await ctx.reply('❌ No Sonos devices found on the network. Make sure they are online and on the same LAN.');
                return;
            }

            this.lastDiscoveryByUser.set(ctx.from!.id, devices);

            const keyboard = new InlineKeyboard();
            devices.forEach((device) => {
                keyboard.text(`${device.name} (${device.ip})`, `sonos_select:${device.ip}`);
                keyboard.row();
            });

            await ctx.reply('Select a Sonos device:', { reply_markup: keyboard });
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('discover Sonos devices', error));
        }
    }

    private async handleSelectDevice(ctx: Context): Promise<void> {
        const data = ctx.callbackQuery?.data;
        if (!data || !ctx.from) {
            return;
        }

        const ip = data.replace('sonos_select:', '').trim();
        if (!ip) {
            await ctx.answerCallbackQuery({ text: 'Invalid device selection.' });
            return;
        }

        const discovered = this.lastDiscoveryByUser.get(ctx.from.id) || [];
        const device = discovered.find((item) => item.ip === ip) || { name: 'Sonos', ip };

        this.userSelectedDevice.set(ctx.from.id, device);

        await ctx.answerCallbackQuery({ text: `Selected ${device.name}` });

        try {
            if (ctx.callbackQuery?.message) {
                await ctx.api.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id);
            }
        } catch (error) {
            console.error('[SonosBot] Failed to delete selection message:', error);
        }

        const selectedMessage = await ctx.reply(`✅ Selected Sonos device: ${device.name} (${device.ip})`);
        try {
            await MessageUtils.scheduleMessageDeletion(ctx, selectedMessage.message_id, 60000);
        } catch (error) {
            console.error('[SonosBot] Failed to schedule selected device message deletion:', error);
        }
    }

    private async sendToSonos(ctx: Context, url: string, device: SonosDevice): Promise<void> {
        await AccessControlMiddleware.notifyAdminOfDownload(ctx, url);

        this.ensureDownloadDir();

        const videoInfo = await this.youtubeService.getVideoInfo(url);
        if (!videoInfo) {
            await ctx.reply('❌ Failed to get video information. Please check the URL and try again.');
            return;
        }

        const downloadMessage = await ctx.reply(`📥 Downloading audio: ${videoInfo.title}\nPlease wait...`);

        try {
            const downloadResult = await this.youtubeService.downloadVideo(url, {
                outputPath: this.downloadDir,
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
                        console.error('[SonosBot] Failed to send status message:', error);
                    }
                }
            });

            if (!downloadResult.success || !downloadResult.filePath) {
                const errorMsg = downloadResult.error || 'Unknown error';
                await ctx.reply(`❌ Failed to download the audio.\n\nError: ${errorMsg}`);
                return;
            }

            await this.sonosService.ensureMediaServer();
            const mediaUrl = this.sonosService.getMediaUrl(downloadResult.filePath);

            await this.sonosService.playUri(device.ip, mediaUrl);

            await ctx.reply(`✅ Sent to Sonos: ${device.name} (${device.ip})`);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('send audio to Sonos', error));
        } finally {
            try {
                await ctx.api.deleteMessage(ctx.chat!.id, downloadMessage.message_id);
            } catch (error) {
                console.error('[SonosBot] Failed to delete download message:', error);
            }
        }
    }

    private ensureDownloadDir(): void {
        fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    private extractCommandArgs(text: string): string {
        const parts = text.trim().split(/\s+/);
        if (parts.length <= 1) {
            return '';
        }
        return parts.slice(1).join(' ').trim();
    }
}
