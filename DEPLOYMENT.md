# Deployment Guide - Render.com

## Quick Start

1. **Push to GitHub** (if not already done)
2. **Connect to Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure Service**
   - **Name**: `personal-website` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter (depending on your needs)

4. **Set Environment Variables** (in Render dashboard → Environment tab)
   - `YOUTUBE_VIDEO_ID` = Your YouTube video ID (e.g., `6CBOZGQqOI0`)
   - `WS_URL` = Your Render app URL (e.g., `https://personal-website.onrender.com`)
   - `YOUTUBE_START_OFFSET` = `0.0` (adjust if needed)
   - `NODE_ENV` = `production` (auto-set by Render)

5. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete
   - Your site will be live at `https://your-app.onrender.com`

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `YOUTUBE_VIDEO_ID` | YouTube video ID for webdisplay | `6CBOZGQqOI0` |
| `WS_URL` | Your Render app URL | `https://personal-website.onrender.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUTUBE_START_OFFSET` | Time offset in seconds | `0.0` |
| `PORT` | Server port | Auto-set by Render |
| `NODE_ENV` | Node environment | `production` (auto-set) |

## Post-Deployment Checklist

- [ ] Set `YOUTUBE_VIDEO_ID` in Render dashboard
- [ ] Set `WS_URL` to your Render app URL
- [ ] Test webdisplay at `/webdisplay`
- [ ] Verify YouTube video loads correctly
- [ ] Check WebSocket connection in browser console
- [ ] Test all interactive features

## Troubleshooting

### Build Fails

- Check `package.json` has correct Node version
- Verify all dependencies are listed
- Check build logs for specific errors

### Webdisplay Not Working

- Verify `YOUTUBE_VIDEO_ID` is set correctly
- Check `WS_URL` matches your Render URL exactly
- Ensure YouTube video is public or unlisted
- Check browser console for errors

### WebSocket Connection Issues

- Verify `WS_URL` is set to your Render URL (with `https://`)
- Check Render service logs for WebSocket errors
- Ensure Socket.IO is properly initialized

## Notes

- Render automatically sets `PORT` - don't override it
- Free tier has cold starts - first request may be slow
- Use Starter plan for better performance
- WebSocket connections work on Render free tier
