export interface DownloadOptions {
    quality?: string;
    outputPath: string;
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
    fileSize?: number;
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
