#!/usr/bin/env node

/**
 * Test script for YouTube URL detection
 * Tests the YouTubeService URL extraction functionality
 */

import { YouTubeService } from '../dist/features/youtube/youtube.service.js';

const youtubeService = new YouTubeService();

const testCases = [
    {
        input: 'Check out this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expectedCount: 1,
        description: 'Standard YouTube URL'
    },
    {
        input: 'https://youtu.be/dQw4w9WgXcQ',
        expectedCount: 1,
        description: 'Short YouTube URL'
    },
    {
        input: 'Watch this: https://www.youtube.com/shorts/abc123xyz',
        expectedCount: 1,
        description: 'YouTube Shorts URL'
    },
    {
        input: 'Multiple videos: https://www.youtube.com/watch?v=video1 and https://youtu.be/video2',
        expectedCount: 2,
        description: 'Multiple URLs'
    },
    {
        input: 'No YouTube links here, just text',
        expectedCount: 0,
        description: 'No URLs'
    },
    {
        input: 'Not YouTube: https://vimeo.com/123456',
        expectedCount: 0,
        description: 'Non-YouTube URL'
    }
];

console.log('🧪 Testing YouTube URL Detection\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.description}`);
    console.log(`Input: "${testCase.input}"`);
    
    const urls = youtubeService.extractYouTubeUrls(testCase.input);
    const count = urls.length;
    
    console.log(`Found: ${count} URL(s)`);
    if (urls.length > 0) {
        urls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
    }
    
    const success = count === testCase.expectedCount;
    console.log(`Expected: ${testCase.expectedCount} URL(s)`);
    console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (success) {
        passed++;
    } else {
        failed++;
    }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
}
