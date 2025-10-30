import { YouTubeService } from './dist/features/youtube/youtube.service.js';
import * as fs from 'fs';

async function testFix() {
    const youtubeUrl = 'https://www.youtube.com/watch?v=_NLHFoVNlbg';
    const outputPath = '/tmp/ytBOT_test_clean';

    console.log(`\n🧪 Testing YouTube Download Fix`);
    console.log(`📺 URL: ${youtubeUrl}`);
    console.log(`📁 Output Path: ${outputPath}\n`);

    try {
        const youtubeService = new YouTubeService('/usr/local/bin/yt-dlp', 50);
        
        console.log('📊 Fetching video information...');
        const videoInfo = await youtubeService.getVideoInfo(youtubeUrl);
        
        if (!videoInfo) {
            console.error('❌ Failed to get video information');
            process.exit(1);
        }
        
        console.log(`✅ Video Info:`);
        console.log(`   Title: ${videoInfo.title}`);
        console.log(`   Duration: ${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')}`);
        console.log('');

        console.log('📥 Starting download...');
        const startTime = Date.now();
        
        const downloadResult = await youtubeService.downloadVideo(youtubeUrl, {
            outputPath: outputPath,
            quality: 'best'
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n⏱️  Total time: ${duration}s\n`);

        if (!downloadResult.success || !downloadResult.filePath) {
            console.error(`❌ Download failed: ${downloadResult.error}`);
            process.exit(1);
        }

        console.log(`✅ Download successful!`);
        console.log(`   File: ${downloadResult.fileName}`);
        console.log(`   Path: ${downloadResult.filePath}`);
        console.log(`   Size: ${((downloadResult.fileSize || 0) / 1024 / 1024).toFixed(2)} MB\n`);

        // Verify file exists
        if (fs.existsSync(downloadResult.filePath)) {
            console.log('✅ File exists and is accessible');
            
            // Clean up
            fs.unlinkSync(downloadResult.filePath);
            console.log('✅ Cleanup complete\n');
        } else {
            console.error('❌ File does not exist at reported path!');
            process.exit(1);
        }

        console.log('🎉 Test completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
        }
        process.exit(1);
    }
}

testFix();
