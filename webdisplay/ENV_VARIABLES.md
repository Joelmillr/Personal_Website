# Webdisplay Environment Variables

## Required Variables

### `YOUTUBE_VIDEO_ID`

- **Description**: YouTube video ID for synchronized playback
- **Example**: `6CBOZGQqOI0`
- **How to get**: Extract from YouTube URL: `https://www.youtube.com/watch?v=VIDEO_ID`
- **Required**: Yes (for video playback feature)

### `YOUTUBE_START_OFFSET`

- **Description**: Time offset in seconds between video start and flight data start
- **Example**: `2643.0` (if flight data starts 2643 seconds into the video)
- **Default**: `0.0`
- **Required**: No

## Optional Variables

### `WS_URL`

- **Description**: WebSocket URL for production deployments
- **Example**: `https://your-app.onrender.com`
- **Default**: Auto-detected from request host
- **Required**: No (auto-detected)

### `PORT`

- **Description**: Server port
- **Example**: `3000`
- **Default**: `3000` (development) or set by Render (production)
- **Required**: No (set automatically by Render)

### `NODE_ENV`

- **Description**: Node.js environment
- **Example**: `production`
- **Default**: `development`
- **Required**: No (set automatically by Render)

## Render.com Setup

1. Go to your Render dashboard
2. Select your service
3. Go to "Environment" tab
4. Add these variables:
   - `YOUTUBE_VIDEO_ID` = your YouTube video ID
   - `WS_URL` = your Render app URL (e.g., `https://your-app.onrender.com`)
   - `YOUTUBE_START_OFFSET` = `0.0` (adjust as needed)
