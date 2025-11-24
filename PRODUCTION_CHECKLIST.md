# Production Deployment Checklist

## Pre-Deployment

- [x] Environment variables documented in `.env.example`
- [x] `render.yaml` configured for Render.com
- [x] `Procfile` configured correctly
- [x] Dependencies listed in `package.json`
- [x] Server code production-ready
- [x] Error handling in place
- [x] Logging reduced (only errors)

## Environment Variables Setup

### Required (Set in Render Dashboard)

1. **YOUTUBE_VIDEO_ID**
   - Get from YouTube URL: `https://www.youtube.com/watch?v=VIDEO_ID`
   - Video must be **public** or **unlisted** (not private)
   - Example: `6CBOZGQqOI0`

2. **WS_URL**
   - Set to your Render app URL after first deployment
   - Format: `https://your-app-name.onrender.com`
   - Must include `https://` protocol

### Optional

3. **YOUTUBE_START_OFFSET**
   - Default: `0.0`
   - Adjust if video and flight data start times differ
   - Formula: `flight_data_start_time - youtube_video_start_time`

### Auto-Set by Render (Don't Override)

- `PORT` - Automatically set by Render
- `NODE_ENV` - Automatically set to `production`

## Render.com Deployment Steps

1. **Connect Repository**
   - Go to Render dashboard
   - Click "New +" → "Web Service"
   - Connect GitHub repository

2. **Configure Service**
   - Name: `personal-website`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free or Starter

3. **Set Environment Variables**
   - Go to Environment tab
   - Add `YOUTUBE_VIDEO_ID`
   - Add `WS_URL` (after first deployment)
   - Add `YOUTUBE_START_OFFSET` if needed

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete
   - Note your app URL

5. **Update WS_URL**
   - After first deployment, update `WS_URL` with your actual Render URL
   - Redeploy or restart service

## Post-Deployment Testing

- [ ] Main site loads at root URL
- [ ] Webdisplay loads at `/webdisplay`
- [ ] YouTube video loads and plays
- [ ] Flight path map displays correctly
- [ ] Altitude chart shows data
- [ ] Attitude chart shows data
- [ ] WebSocket connection works
- [ ] 3D view updates (if enabled)
- [ ] Playback controls work
- [ ] Jump to timestamp works

## Files to Keep

- `README.md` - Main project documentation
- `DEPLOYMENT.md` - Deployment guide
- `PRODUCTION_CHECKLIST.md` - This file
- `webdisplay/README.md` - Webdisplay documentation
- `webdisplay/ENV_VARIABLES.md` - Environment variables reference
- `.env.example` - Environment variables template

## Files Removed/Not Needed

- `webdisplay/config.py.example` - Replaced by `.env.example`
- `webdisplay/render.yaml` - Using root `render.yaml` instead

## Troubleshooting

See `DEPLOYMENT.md` for detailed troubleshooting guide.

