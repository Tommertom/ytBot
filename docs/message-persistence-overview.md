# YouTube Bot Message Persistence Overview

## Messages That Persist (Never Deleted)

### 1. Help/Start Message
- **Location**: `youtube.bot.ts:44`
- **Content**: "👋 Welcome to YouTube Audio Download Bot!..."
- **Trigger**: `/start` or `/help` command
- **Behavior**: No deletion scheduled - persists permanently

### 2. Error Messages (via ErrorUtils)

#### 2.1 Help Message Error
- **Location**: `youtube.bot.ts:46`
- **Content**: "❌ Failed to show help message..."
- **Trigger**: Error during help/start command
- **Behavior**: No deletion scheduled - persists permanently

#### 2.2 Video Info Fetch Error
- **Location**: `youtube.bot.ts:87`
- **Content**: "❌ Failed to get video information. Please check the URL and try again."
- **Trigger**: Unable to retrieve video metadata
- **Behavior**: No deletion scheduled - persists permanently

#### 2.3 Download Error
- **Location**: `youtube.bot.ts:156`
- **Content**: "❌ Failed to download video..."
- **Trigger**: Exception during download process
- **Behavior**: No deletion scheduled - persists permanently

#### 2.4 Message Processing Error
- **Location**: `youtube.bot.ts:167`
- **Content**: "❌ Failed to process message..."
- **Trigger**: General error in message handling
- **Behavior**: No deletion scheduled - persists permanently

### 3. Status Callback Messages

These messages are sent during the download retry process via `statusCallback`:

#### 3.1 Initial Quality Fallback ✅ DELETED
- **Location**: `youtube.service.ts:107`
- **Content**: "⚠️ File too large (X.XMB). Calculated optimal bitrate: XXXkbps..."
- **Trigger**: First attempt file size exceeds limit
- **Behavior**: Auto-deleted after configured timeout via `MessageUtils.scheduleMessageDeletion()`

#### 3.2 Subsequent Quality Fallback ✅ DELETED
- **Location**: `youtube.service.ts:115`
- **Content**: "⚠️ Still too large (X.XMB). Trying XXXkbps..."
- **Trigger**: Retry attempt still exceeds limit
- **Behavior**: Auto-deleted after configured timeout via `MessageUtils.scheduleMessageDeletion()`

#### 3.3 Predefined Quality Fallback ✅ DELETED
- **Location**: `youtube.service.ts:122`
- **Content**: "⚠️ File too large. Trying XXXkbps..."
- **Trigger**: Fallback to predefined quality levels
- **Behavior**: Auto-deleted after configured timeout via `MessageUtils.scheduleMessageDeletion()`

#### 3.4 Final Failure Message
- **Location**: `youtube.service.ts:134`
- **Content**: "❌ Unable to reduce file size below 50MB even at lowest quality. Please try a shorter video."
- **Trigger**: All retry attempts exhausted
- **Behavior**: No deletion scheduled - persists permanently

### 4. Download Failure Message
- **Location**: `youtube.bot.ts:146`
- **Content**: "❌ Failed to download the audio.\n\n⚠️ The file exceeds the maximum size limit..." (or other error details)
- **Trigger**: Download completed but unsuccessful
- **Behavior**: No deletion scheduled - persists permanently

### 5. Audio File Message
- **Location**: `youtube.bot.ts:114`
- **Content**: Audio file with caption "✅ {video title}"
- **Trigger**: Successful download completion
- **Behavior**: Persists permanently (standard Telegram message)

---

## Messages That DO Get Deleted

### 1. Confirmation Message
- **Location**: `youtube.bot.ts:63-75`
- **Content**: "✅ YouTube link(s) detected! Processing X video(s)..."
- **Trigger**: YouTube URL detected in message
- **Behavior**: Auto-deleted after configured timeout via `MessageUtils.scheduleMessageDeletion()`

### 2. Download Progress Message
- **Location**: `youtube.bot.ts:92`
- **Content**: "📥 Downloading audio: {title}\nPlease wait..."
- **Trigger**: Download initiated
- **Behavior**: Deleted after completion (line 122), failure (line 150), or error (line 160)

---

## Summary

**Total Persistent Message Types**: 7 different message types that never get deleted

**Total Temporary Message Types**: 5 message types that get deleted

**Key Insight**: Status messages during quality fallback retries (3.1, 3.2, 3.3) are now automatically deleted after the configured timeout, preventing chat clutter during downloads that require multiple quality reduction attempts. Only the final failure message (3.4) and error messages persist permanently to ensure users have a record of actual failures.
