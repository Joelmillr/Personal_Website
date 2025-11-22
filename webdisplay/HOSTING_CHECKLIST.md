# Hosting Checklist

Use this checklist to ensure everything is ready for hosting.

## Required Files ✅

- [x] `merged_data.csv` - Flight data file
- [x] `requirements.txt` - Python dependencies
- [x] `start_server.py` - Server startup script
- [x] `backend/app.py` - Flask backend application
- [x] `backend/data_processor.py` - Data processing module
- [x] `backend/video_timestamp_mapper.py` - Video sync module
- [x] `frontend/index.html` - Main web page
- [x] `frontend/css/styles.css` - Stylesheet
- [x] `frontend/js/` - JavaScript modules
- [x] `frontend/godot/` - Godot HTML5 export files

## Optional Files (Recommended) ⚠️

- [x] `youtube_timestamps.json` - YouTube video sync mapping
- [x] `video_timestamps.json` - Fallback video sync mapping
- [ ] `.env` - Environment variables (create from `env.example`)

## Configuration Files ✅

- [x] `Procfile` - For Heroku/Render deployment
- [x] `render.yaml` - Render.com deployment config
- [x] `runtime.txt` - Python version specification
- [x] `env.example` - Environment variables template
- [x] `.gitignore` - Git ignore rules

## Pre-Deployment Steps

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create .env file:**
   ```bash
   cp env.example .env
   # Edit .env and set YOUTUBE_VIDEO_ID
   ```

3. **Test locally:**
   ```bash
   python start_server.py
   # Visit http://localhost:5000
   ```

4. **Verify data file:**
   - Check that `merged_data.csv` exists and is readable
   - File should be in the `webdisplay/` directory

5. **Set environment variables for production:**
   - `YOUTUBE_VIDEO_ID` - **Required**
   - `YOUTUBE_START_OFFSET` - Video sync offset
   - `HOST` - Use `0.0.0.0` for production
   - `PORT` - Check your hosting platform's requirements
   - `WS_URL` - Set after first deployment

## Deployment Platforms

### Render.com
- Root directory: `webdisplay`
- Build command: `pip install -r requirements.txt`
- Start command: `python start_server.py`
- Environment: Python 3.11.0

### Railway.app
- Root directory: `webdisplay`
- Build command: `pip install -r requirements.txt`
- Start command: `python start_server.py`

### Heroku
- Root directory: `webdisplay`
- Uses `Procfile` automatically
- Set config vars in dashboard

### Self-Hosted (Gunicorn)
```bash
pip install gunicorn gevent gevent-websocket
gunicorn -w 4 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    --bind 0.0.0.0:5000 \
    --timeout 120 \
    backend.app:app
```

## Post-Deployment

1. **Set WS_URL:**
   - After first deployment, copy your service URL
   - Set `WS_URL` environment variable to your URL
   - Example: `WS_URL=https://your-service.onrender.com`

2. **Verify WebSocket connection:**
   - Open browser console
   - Check for WebSocket connection errors
   - Verify data is loading

3. **Test video playback:**
   - Verify YouTube video loads
   - Check video sync with flight data
   - Adjust `YOUTUBE_START_OFFSET` if needed

## Troubleshooting

- **Server won't start:** Check Python version matches `runtime.txt`
- **Data not loading:** Verify `merged_data.csv` is in webdisplay directory
- **Video not showing:** Check `YOUTUBE_VIDEO_ID` is set correctly
- **WebSocket errors:** Set `WS_URL` to your production URL
- **Import errors:** Ensure all files in `backend/` directory are present

## File Structure

```
webdisplay/
├── merged_data.csv          # Flight data (required)
├── requirements.txt          # Python dependencies
├── start_server.py          # Server startup
├── env.example              # Environment template
├── Procfile                 # Heroku/Render config
├── render.yaml              # Render.com config
├── runtime.txt              # Python version
├── backend/
│   ├── app.py              # Flask application
│   ├── data_processor.py   # Data processing
│   └── video_timestamp_mapper.py
├── frontend/
│   ├── index.html          # Main page
│   ├── css/
│   ├── js/
│   └── godot/              # 3D display
└── youtube_timestamps.json # Optional sync file
```

