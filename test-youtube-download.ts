import { Bot, InputFile } from 'grammy';
import dotenv from 'dotenv';
import { YouTubeService } from './src/features/youtube/youtube.service.js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function testYoutubeDownload() {
    const botToken = process.env.TELEGRAM_BOT_TOKENS?.split(',')[0];
    
    if (!botToken) {
        console.error('❌ No bot token found');
        process.exit(1);
    }

    const bot = new Bot(botToken);
    const userId = 7754947238;
    const youtubeUrl = 'https://youtu.be/q2czJLPJ4nA?si=V-Pu9ObexJlH6SHj';
    const outputPath = '/tmp/ytBOT_media';

    console.log(`\n🧪 Testing YouTube Download Service`);
    console.log(`📺 URL: ${youtubeUrl}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📁 Output Path: ${outputPath}\n`);

    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
        console.log(`📁 Created output directory: ${outputPath}`);
    }

    try {
        // Initialize YouTube service
        const youtubeService = new YouTubeService('/usr/local/bin/yt-dlp', 50);
        
        // Step 1: Verify it's a YouTube URL
        if (!youtubeService.isYouTubeUrl(youtubeUrl)) {
            console.error('❌ Invalid YouTube URL');
            process.exit(1);
        }
        console.log('✅ Valid YouTube URL detected\n');

        // Step 2: Get video info
        console.log('📊 Fetching video information...');
        const videoInfo = await youtubeService.getVideoInfo(youtubeUrl);
        
        if (!videoInfo) {
            console.error('❌ Failed to get video information');
            process.exit(1);
        }
        
        console.log(`✅ Video Info:`);
        console.log(`   Title: ${videoInfo.title}`);
        console.log(`   Duration: ${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')}`);
        if (videoInfo.fileSize) {
            console.log(`   Estimated Size: ${(videoInfo.fileSize / 1024 / 1024).toFixed(2)} MB`);
        }
        console.log('');

        // Step 3: Download the video
        console.log('📥 Starting download...');
        const downloadResult = await youtubeService.downloadVideo(youtubeUrl, {
            outputPath: outputPath,
            quality: 'best'
        });

        if (!downloadResult.success || !downloadResult.filePath) {
            console.error(`❌ Download failed: ${downloadResult.error}`);
            process.exit(1);
        }

        console.log(`✅ Download successful!`);
        console.log(`   File: ${downloadResult.fileName}`);
        console.log(`   Path: ${downloadResult.filePath}`);
        console.log(`   Size: ${((downloadResult.fileSize || 0) / 1024 / 1024).toFixed(2)} MB\n`);

        // Step 4: Send the file to the user
        console.log(`📤 Sending audio file to user ${userId}...`);
        
        await bot.api.sendAudio(userId, new InputFile(downloadResult.filePath), {
            caption: `✅ ${videoInfo.title}`,
            title: videoInfo.title,
            performer: 'YouTube'
        });

        console.log('✅ Audio file sent successfully!\n');

        // Step 5: Clean up
        console.log('🗑️  Cleaning up downloaded file...');
        fs.unlinkSync(downloadResult.filePath);
        console.log('✅ Cleanup complete\n');

        console.log('🎉 Test completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

testYoutubeDownload();
