import { Bot } from "grammy";
import { ConfigService } from './services/config.service.js';
import { YouTubeService } from './features/youtube/youtube.service.js';
import { YouTubeBot } from './features/youtube/youtube.bot.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

console.log('[ytBot] Starting ytBot...');

dotenv.config();

// Initialize config service
const configService = new ConfigService();

try {
    configService.validate();
    console.log('[ytBot] Configuration loaded successfully');
    console.log(configService.getDebugInfo());
} catch (error) {
    console.error('[ytBot] Configuration error:', error);
    process.exit(1);
}

// Get the first bot token
const tokens = configService.getTelegramBotTokens();
if (tokens.length === 0) {
    console.error('[ytBot] No bot tokens found in configuration');
    process.exit(1);
}

const botToken = tokens[0];
console.log(`[ytBot] Initializing with token: ${botToken.substring(0, 10)}...`);

// Create bot instance
const bot = new Bot(botToken);

// Initialize services
const youtubeService = new YouTubeService();

// Set global error handler to prevent crashes
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[ytBot] Error while handling update ${ctx.update.update_id}:`, err.error);
});

// Set config service for access control
AccessControlMiddleware.setConfigService(configService);

// Set bot instance for access control (needed for admin notifications)
AccessControlMiddleware.setBot(bot);

// Initialize the YouTube bot
const youtubeBot = new YouTubeBot(botToken, youtubeService, configService);

// Register handlers
youtubeBot.registerHandlers(bot);

async function startBot() {
    try {
        console.log('[ytBot] Starting initialization...');

        // Clean up media directory if configured
        if (configService.shouldCleanUpMediaDir()) {
            const botMediaPath = path.join(configService.getMediaTmpLocation(), 'bot-1');
            if (fs.existsSync(botMediaPath)) {
                console.log(`[ytBot] Cleaning up media directory: ${botMediaPath}`);
                fs.rmSync(botMediaPath, { recursive: true, force: true });
                console.log('[ytBot] ✅ Media directory cleaned');
            }
        }

        // Get bot info
        try {
            const me = await bot.api.getMe();
            const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
            console.log(`[ytBot] Bot info: ${fullName} (@${me.username})`);
        } catch (error) {
            console.error('[ytBot] Failed to get bot info:', error);
        }

        // Start the bot
        await bot.start();
        console.log('[ytBot] ✅ Bot started successfully');
    } catch (error) {
        console.error('[ytBot] Failed to start:', error);
        process.exit(1);
    }
}

let shuttingDown = false;

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        console.log('[ytBot] Shutdown already in progress...');
        return;
    }

    shuttingDown = true;
    console.log(`[ytBot] Received ${signal}, shutting down gracefully...`);

    try {
        // Stop bot
        await bot.stop();

        console.log('[ytBot] ✅ Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[ytBot] Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ytBot] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[ytBot] Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the bot
startBot().catch((error) => {
    console.error('[ytBot] Fatal error:', error);
    process.exit(1);
});
