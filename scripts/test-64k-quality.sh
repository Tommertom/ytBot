#!/bin/bash

# Quick test script for the 64K quality fix
# This simulates what the bot will do

set -e  # Exit on error

echo "=========================================="
echo "Testing 64K Quality Fallback Implementation"
echo "=========================================="
echo ""

# Test URL (short video for quick testing)
TEST_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
OUTPUT_DIR="/tmp/ytBOT_media"
MAX_SIZE_MB=50

echo "📹 Test URL: $TEST_URL"
echo "📁 Output: $OUTPUT_DIR"
echo "📏 Max Size: ${MAX_SIZE_MB}MB"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Clean up any existing files
echo "🧹 Cleaning up old test files..."
rm -f "$OUTPUT_DIR"/*.mp3 "$OUTPUT_DIR"/*.part
echo ""

# Test function
test_quality() {
    local quality=$1
    echo "=========================================="
    echo "🎵 Testing quality: $quality"
    echo "=========================================="
    
    local output_file=$(mktemp -u "$OUTPUT_DIR/test-${quality}-XXXXX.mp3")
    
    echo "⏳ Downloading..."
    yt-dlp -x \
        --audio-format mp3 \
        --audio-quality "$quality" \
        --no-playlist \
        --output "$output_file" \
        --print after_move:filepath \
        --no-warnings \
        "$TEST_URL"
    
    if [ -f "$output_file" ]; then
        local size_bytes=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
        local size_mb=$(echo "scale=2; $size_bytes / 1024 / 1024" | bc)
        
        echo "✅ SUCCESS"
        echo "📊 File size: ${size_mb} MB"
        
        if (( $(echo "$size_mb > $MAX_SIZE_MB" | bc -l) )); then
            echo "⚠️  WARNING: File exceeds ${MAX_SIZE_MB}MB limit"
            echo "   (Would trigger quality fallback)"
        else
            echo "✅ File is within ${MAX_SIZE_MB}MB limit"
        fi
        
        # Clean up
        rm -f "$output_file"
        echo "🗑️  Cleaned up test file"
    else
        echo "❌ FAILED: No file created"
    fi
    
    echo ""
}

# Test the quality chain
echo "Testing quality fallback chain..."
echo ""

# Test just 64K to verify it works
test_quality "64K"

echo "=========================================="
echo "✅ Test Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Rebuild: npm run build"
echo "2. Start bot: npm start"
echo "3. Send test URL to bot"
echo "4. Verify status messages appear"
echo ""
