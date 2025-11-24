# Flight Test Playback Web Display

A web-based interactive flight test data visualization system with 3D HMD display, video feed, flight path map, altitude profile, and attitude charts. This system synchronizes YouTube video playback with real-time flight data visualization.

## Features

- **3D HMD Display**: Real-time 3D visualization using Godot HTML5 export
- **YouTube Video Integration**: Synchronized video playback with flight data
- **Interactive Flight Path Map**: Real-time tracking on an interactive map
- **Altitude Profile Chart**: Visual altitude tracking over time
- **Attitude Charts**: Pitch, roll, and heading visualization
- **WebSocket Real-time Updates**: Live data streaming for smooth playback
- **Playback Controls**: Play, pause, speed control, and jump to timestamp

## Project Structure

```
webdisplay/
├── backend/              # Flask backend server
│   ├── app.py           # Main server application
│   ├── data_processor.py
│   └── video_timestamp_mapper.py
├── frontend/            # Web frontend
│   ├── index.html       # Main HTML page
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript modules
│   │   ├── playback.js  # Playback control logic
│   │   ├── main.js      # Main application logic
│   │   ├── map.js       # Map visualization
│   │   ├── chart.js     # Chart rendering
│   │   ├── attitude-chart.js
│   │   └── youtube-player.js
│   └── godot/           # Godot HTML5 export (3D display)
│       └── Display.html # Godot display with WebSocket bridge
├── Display/             # Godot project scripts
│   └── Scripts/
├── requirements.txt     # Python dependencies
├── start_server.py      # Server startup script
├── start_server.bat     # Windows startup script
├── start_server.sh      # Linux/Mac startup script
├── config.py.example   # Configuration template
├── Procfile             # For deployment platforms
├── render.yaml          # Render.com deployment config
└── runtime.txt          # Python version specification
```

## Environment Variables

See `ENV_VARIABLES.md` for complete documentation.

**Required for production:**
- `YOUTUBE_VIDEO_ID` - Your YouTube video ID
- `WS_URL` - Your production URL (e.g., https://your-app.onrender.com)

**Optional:**
- `YOUTUBE_START_OFFSET` - Time offset in seconds (default: 0.0)
- `PORT` - Server port (auto-set by Render)

## Quick Start

### 0. Verify Setup (Optional)

Run the verification script to check if all files are present:

```bash
python verify_setup.py
```

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure YouTube Video

The system uses YouTube video for playback. Set environment variables or create a `.env` file:

```bash
cp env.example .env
# Edit .env and set your YOUTUBE_VIDEO_ID
```

Or set environment variables directly:

```env
YOUTUBE_VIDEO_ID=your_video_id_here
YOUTUBE_START_OFFSET=0.0
```

**Getting Your YouTube Video ID:**
- From URL: `https://www.youtube.com/watch?v=VIDEO_ID_HERE`
- The Video ID is the part after `v=`
- Video must be **public** or **unlisted** (not private)

**YOUTUBE_START_OFFSET:**
- Offset in seconds to sync video with flight data
- If flight data starts at timestamp 2643.0s but video starts at 0:00, set `YOUTUBE_START_OFFSET=2643.0`
- If video starts 10 seconds before flight data, set `YOUTUBE_START_OFFSET=-10.0`

### 3. Start the Server

```bash
python start_server.py
```

Or use the provided scripts:
- **Windows**: `start_server.bat`
- **Linux/Mac**: `start_server.sh`

### 4. Open in Browser

Navigate to `http://localhost:5000`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUTUBE_VIDEO_ID` | YouTube video ID (required) | - |
| `YOUTUBE_START_OFFSET` | Video sync offset in seconds | `0.0` |
| `HOST` | Server host | `127.0.0.1` |
| `PORT` | Server port | `5000` |
| `DEBUG` | Debug mode | `True` |
| `WS_URL` | WebSocket URL (for production) | Auto-detected |

### Data Files

The system expects:
- `merged_data.csv` in the `webdisplay/` directory (flight data) ✅ **Already included**
- `youtube_timestamps.json` in the `webdisplay/` directory (optional, improves video sync) ✅ **Already included**
- `video_timestamps.json` in the `webdisplay/` directory (optional fallback) ✅ **Already included**
- `camera_frames_flipped/` directory in project root (optional, for frame-based video)

**Note:** This directory is now self-contained for hosting. All required files are included.

### WebSocket URL Configuration

For production deployment, update WebSocket URLs in:
- `frontend/js/playback.js` (line ~18)
- `frontend/godot/Display.html` (line ~118)

Change from:
```javascript
const socket = io('http://127.0.0.1:5000');
```

To your server URL:
```javascript
const socket = io('https://your-domain.com');
```

## Deployment

### Render.com (Recommended - Free Tier)

1. **Push code to GitHub**

2. **Create Render service:**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure service:**
   - **Name**: `flight-test-display`
   - **Root Directory**: `webdisplay`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python start_server.py`
   - **Environment Variables**:
     - `HOST`: `0.0.0.0`
     - `PORT`: `10000` (or check Render's assigned port)
     - `YOUTUBE_VIDEO_ID`: Your video ID
     - `YOUTUBE_START_OFFSET`: `0.0` (adjust as needed)
     - `WS_URL`: Your Render URL (set after first deploy)

4. **After deployment:**
   - Copy your service URL
   - Add `WS_URL` environment variable with your URL
   - Update WebSocket URLs in frontend files if needed

**Free Tier Limitations:**
- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (wake-up)
- 500MB disk space, 100GB bandwidth/month

### Railway.app

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`
5. Set environment variables in Railway dashboard

### Production Server (Gunicorn)

For production deployment on your own server:

```bash
pip install gunicorn gevent gevent-websocket
gunicorn -w 4 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    --bind 0.0.0.0:5000 \
    --timeout 120 \
    backend.app:app
```

## Integration into Your Website

### Option 1: Standalone Page

1. Copy the entire `frontend/` folder to your website
2. Update WebSocket URLs to point to your backend server
3. Link to `frontend/index.html` from your website

### Option 2: Embed as Component

1. Copy `frontend/css/`, `frontend/js/`, and `frontend/godot/` to your website
2. Include the CSS and JS files in your page
3. Copy the HTML structure from `frontend/index.html` into your page
4. Update WebSocket URLs

### Required External Dependencies

The frontend requires these libraries (already included in `index.html`):
- Leaflet.js (for map)
- Chart.js (for charts)
- Socket.IO (for WebSocket)
- YouTube IFrame API (for video)

## Video Synchronization

The system automatically synchronizes YouTube video with flight data timestamps. The sync process involves:

1. **Base Mapping**: Match video frames to flight data timestamps
2. **YouTube Adjustment**: Account for any trimming/editing in the YouTube video

The synchronization is configured via the `YOUTUBE_START_OFFSET` environment variable. If you need to create or adjust timestamp mappings, you'll need to use external tools or scripts (not included in this web display package).

## Development

### Local Development

1. Install dependencies: `pip install -r requirements.txt`
2. Set environment variables (create `.env` file)
3. Run: `python start_server.py`
4. Open: `http://localhost:5000`

### Default Settings

- **Playback Speed**: 2x (configurable in `js/playback.js`)
- **Update Frequency**: Map/charts update every 100 frames (configurable in `js/main.js`)
- **Data Preloading**: All flight data is preloaded for smooth playback

### Godot Integration

The 3D display uses Godot HTML5 export. Important notes:
- The WebSocket bridge script must be in `frontend/godot/Display.html`
- After each Godot HTML5 export, you must re-add the WebSocket bridge script
- The bridge script connects Godot to the Flask WebSocket server

## Troubleshooting

### Video Not Showing
- Check that `YOUTUBE_VIDEO_ID` is set correctly
- Verify video is public or unlisted (not private)
- Check browser console for errors

### Video Out of Sync
- Adjust `YOUTUBE_START_OFFSET` to match your video start time
- Offset formula: `flight_data_start_time - youtube_video_start_time`
- Use sync tools to automatically detect and fix sync issues

### WebSocket Not Connecting
- Check `WS_URL` environment variable is set correctly
- Verify it matches your actual service URL (with https://)
- Check browser console for connection errors
- Ensure backend server is running

### 3D View Not Updating
- Verify WebSocket bridge script is in `godot/Display.html`
- Check WebSocket connection in browser console
- Ensure Godot display is properly loaded

### Service Won't Start
- Check that `requirements.txt` is in `webdisplay/` directory
- Verify `start_server.py` is in `webdisplay/` directory
- Check build logs for dependency errors
- Ensure Python version matches `runtime.txt`

### Performance Issues
- Reduce update frequency in `js/main.js` (change `% 100` to `% 200`)
- Check network tab for slow asset loading
- Verify data file is not too large

## Notes

- **YouTube Video**: The system uses YouTube video for playback, eliminating the need for large frame storage
- **Video Sync**: YouTube video automatically syncs with flight data timestamps
- **Godot Display**: Requires WebSocket bridge script in `Display.html` (see `frontend/godot/Display.html`)
- **Data Preloading**: All flight data is preloaded for smooth playback
- **CORS**: Backend has CORS enabled for cross-origin requests

## License

Part of the Flight Test 1 - SR22 project demonstration.
