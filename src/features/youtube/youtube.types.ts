export interface DownloadOptions {
    quality?: string;
    outputPath: string;
    statusCallback?: (message: string) => void | Promise<void>;
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
    fileSize?: number;
    qualityUsed?: string;
    currentBitrate?: number; // Bitrate in kbps for calculating next attempt
}

export interface VideoInfo {
    title: string;
    duration: number;
    fileSize?: number;
}

export interface YouTubeSession {
    userId: string;
    chatId: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface YouTubeConfig {
    allowedUsers: string[];
    downloadPath: string;
    maxFileSize: number;
}

export interface PlaylistVideoInfo {
    id: string;
    title: string;
    duration: number;
    url: string;
}

export interface PlaylistInfo {
    title: string;
    videoCount: number;
    videos: PlaylistVideoInfo[];
}

export interface PlaylistDownloadOptions extends DownloadOptions {
    videoStatusCallback?: (message: string) => void | Promise<void>;
    maxPlaylistSize?: number;
    downloadDelayMs?: number;
    shouldStop?: () => boolean;
}

export interface PlaylistDownloadResult {
    success: boolean;
    downloaded: number;
    failed: number;
    total: number;
    error?: string;
    results?: DownloadResult[];
}
