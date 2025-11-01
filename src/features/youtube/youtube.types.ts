export interface DownloadOptions {
    quality?: string;
    outputPath: string;
    statusCallback?: (message: string) => void;
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
