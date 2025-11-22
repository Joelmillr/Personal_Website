# Setup Guide for Hosting

This directory contains everything needed to host the Flight Test Playback Web Display.

## Quick Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set your YOUTUBE_VIDEO_ID
   ```

3. **Start the server:**
   ```bash
   python start_server.py
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5000`

## Required Files

The following files should be present in this directory:

- ✅ `merged_data.csv` - Flight data (already present)
- ✅ `requirements.txt` - Python dependencies
- ✅ `start_server.py` - Server startup script
- ✅ `backend/` - Backend Flask application
- ✅ `frontend/` - Frontend web application
- ⚠️ `youtube_timestamps.json` - Optional, improves video sync accuracy
- ⚠️ `video_timestamps.json` - Optional fallback timestamp mapping

## Optional Files

- `youtube_timestamps.json` - YouTube video timestamp mapping (improves sync)
- `video_timestamps.json` - Original video timestamp mapping (fallback)
- `.env` - Environment variables (create from `.env.example`)

## Deployment

See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions for:
- Render.com (recommended free tier)
- Railway.app
- Production servers (Gunicorn)

## Configuration

All configuration is done via environment variables. See `.env.example` for available options.

Key settings:
- `YOUTUBE_VIDEO_ID` - **Required** - Your YouTube video ID
- `YOUTUBE_START_OFFSET` - Video sync offset in seconds
- `HOST` - Server host (use `0.0.0.0` for production)
- `PORT` - Server port (check your hosting platform's requirements)
- `WS_URL` - WebSocket URL (set after deployment)

## Troubleshooting

- **Video not showing**: Check that `YOUTUBE_VIDEO_ID` is set correctly
- **Video out of sync**: Adjust `YOUTUBE_START_OFFSET`
- **WebSocket errors**: Set `WS_URL` to your production URL
- **Data not loading**: Ensure `merged_data.csv` is in this directory

For more details, see `README.md`.

