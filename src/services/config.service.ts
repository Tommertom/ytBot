/**
 * Configuration Service
 * 
 * Centralizes all environment variable access and provides type-safe
 * configuration management for bot instances.
 */
export class ConfigService {
    // Telegram Configuration
    private readonly telegramBotTokens: string[];
    private readonly allowedUserIds: number[];
    private readonly adminUserId: number | undefined;
    private readonly autoKill: boolean;

    // Media Configuration
    private readonly mediaTmpLocation: string;
    private readonly cleanUpMediaDir: boolean;

    // Message Configuration
    private readonly messageDeleteTimeout: number;

    // Playlist Configuration
    private readonly maxPlaylistSize: number;
    private readonly playlistDownloadDelay: number;

    // Sonos Configuration
    private readonly sonosMediaHost: string | undefined;
    private readonly sonosMediaPort: number;
    private readonly sonosPythonPath: string;

    // System Environment
    private readonly homeDirectory: string;
    private readonly systemEnv: { [key: string]: string };

    constructor() {
        // Load and parse Telegram bot tokens
        this.telegramBotTokens = (process.env.TELEGRAM_BOT_TOKENS || '')
            .split(',')
            .map(token => token.trim())
            .filter(token => token.length > 0);

        // Load and parse allowed user IDs
        const allowedIds = process.env.ALLOWED_USER_IDS || '';
        this.allowedUserIds = allowedIds
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));

        // Load admin user ID
        const adminId = process.env.ADMIN_USER_ID || '';
        this.adminUserId = adminId.trim().length > 0 ? parseInt(adminId.trim(), 10) : undefined;
        if (this.adminUserId && isNaN(this.adminUserId)) {
            this.adminUserId = undefined;
        }

        // Load auto-kill setting
        const autoKillValue = process.env.AUTO_KILL?.toLowerCase();
        this.autoKill = autoKillValue === 'true' || autoKillValue === '1';

        // Load media configuration
        this.mediaTmpLocation = process.env.MEDIA_TMP_LOCATION || '/tmp/ytBOT_media';
        const cleanUpValue = process.env.CLEAN_UP_MEDIADIR?.toLowerCase();
        this.cleanUpMediaDir = cleanUpValue === 'true' || cleanUpValue === '1';

        // Load message configuration
        this.messageDeleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);

        // Load playlist configuration
        this.maxPlaylistSize = parseInt(process.env.MAX_PLAYLIST_SIZE || '50', 10);
        this.playlistDownloadDelay = parseInt(process.env.PLAYLIST_DOWNLOAD_DELAY_MS || '1000', 10);

        // Load Sonos configuration
        const sonosHost = process.env.SONOS_MEDIA_HOST || '';
        this.sonosMediaHost = sonosHost.trim().length > 0 ? sonosHost.trim() : undefined;

        const sonosPort = parseInt(process.env.SONOS_MEDIA_PORT || '8787', 10);
        this.sonosMediaPort = Number.isFinite(sonosPort) && sonosPort > 0 && sonosPort < 65536 ? sonosPort : 8787;

        this.sonosPythonPath = process.env.SONOS_PYTHON_PATH || 'python3';

        // Load system environment
        this.homeDirectory = process.env.HOME || '/tmp';
        this.systemEnv = process.env as { [key: string]: string };
    }

    // Telegram Configuration Getters
    getTelegramBotTokens(): string[] {
        return [...this.telegramBotTokens];
    }

    getAllowedUserIds(): number[] {
        return [...this.allowedUserIds];
    }

    getAdminUserId(): number | undefined {
        return this.adminUserId;
    }

    isAutoKillEnabled(): boolean {
        return this.autoKill;
    }

    // Media Configuration Getters
    getMediaTmpLocation(): string {
        return this.mediaTmpLocation;
    }

    shouldCleanUpMediaDir(): boolean {
        return this.cleanUpMediaDir;
    }

    // Message Configuration Getters
    getMessageDeleteTimeout(): number {
        return this.messageDeleteTimeout;
    }

    // Playlist Configuration Getters
    getMaxPlaylistSize(): number {
        return this.maxPlaylistSize;
    }

    getPlaylistDownloadDelay(): number {
        return this.playlistDownloadDelay;
    }

    // Sonos Configuration Getters
    getSonosMediaHost(): string | undefined {
        return this.sonosMediaHost;
    }

    getSonosMediaPort(): number {
        return this.sonosMediaPort;
    }

    getSonosPythonPath(): string {
        return this.sonosPythonPath;
    }

    // System Environment Getters
    getHomeDirectory(): string {
        return this.homeDirectory;
    }

    getSystemEnv(): { [key: string]: string } {
        return { ...this.systemEnv };
    }

    // Validation
    validate(): void {
        if (this.telegramBotTokens.length === 0) {
            throw new Error('No bot tokens found in TELEGRAM_BOT_TOKENS environment variable');
        }

        if (this.allowedUserIds.length === 0) {
            console.warn('Warning: No allowed user IDs configured. Consider setting ALLOWED_USER_IDS.');
        }
    }

    // Debug information
    getDebugInfo(): string {
        return `ConfigService:
  - Bot Tokens: ${this.telegramBotTokens.length}
  - Allowed Users: ${this.allowedUserIds.length}
  - Admin User ID: ${this.adminUserId || 'Not set'}
  - Auto Kill: ${this.autoKill}
  - Media Location: ${this.mediaTmpLocation}
  - Clean Up Media Dir: ${this.cleanUpMediaDir}
  - Message Delete Timeout: ${this.messageDeleteTimeout}ms
    - Max Playlist Size: ${this.maxPlaylistSize}
    - Playlist Download Delay: ${this.playlistDownloadDelay}ms
    - Sonos Media Host: ${this.sonosMediaHost || 'Auto'}
    - Sonos Media Port: ${this.sonosMediaPort}
    - Sonos Python Path: ${this.sonosPythonPath}`;
    }
}
