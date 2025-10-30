# Admin Notification System

## Overview

The bot now automatically notifies the admin user when a non-admin user requests to download a YouTube link.

## Features

- **Automatic Notifications**: When any allowed user (except the admin) sends a YouTube link for download, the admin receives a notification.
- **User Information**: The notification includes the user's name, username, User ID, and the requested link.
- **Timestamp**: Each notification includes a timestamp of when the request was made.
- **Silent for Admin**: The admin does not receive notifications for their own download requests.

## Configuration

The admin notification system uses the `ADMIN_USER_ID` environment variable to determine who should receive notifications.

### Environment Variable

```bash
ADMIN_USER_ID=123456789  # Your Telegram User ID
```

If `ADMIN_USER_ID` is not set, the system will fall back to the first user in the `ALLOWED_USER_IDS` list.

## Notification Format

When a non-admin user requests a download, the admin receives a message like this:

```
📥 Download Request

User Information:
• Name: John Doe
• Username: @johndoe
• User ID: 987654321

Requested Link:
https://www.youtube.com/watch?v=dQw4w9WgXcQ

Time: 10/30/2025, 12:04:10 PM
```

## Implementation Details

### New Methods

#### `AccessControlMiddleware.isAdmin(userId: number): boolean`
Checks if a given user ID matches the admin user ID.

#### `AccessControlMiddleware.notifyAdminOfDownload(ctx: Context, url: string): Promise<void>`
Sends a notification to the admin about a download request from a non-admin user.

### Modified Methods

#### `YouTubeBot.handleTextMessage(ctx: Context): Promise<void>`
Now calls `AccessControlMiddleware.notifyAdminOfDownload()` before processing each YouTube URL.

## Security Considerations

- Notifications are only sent if the bot instance and admin user ID are properly configured.
- The notification system fails silently if there are any errors, ensuring the download process continues uninterrupted.
- Admin users do not receive notifications for their own downloads to avoid spam.

## Error Handling

If the notification system encounters an error:
- The error is logged to the console
- The download process continues normally
- The user experience is not affected
