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
flight-display/
├── server/              # Node.js server
│   ├── webdisplayServer.js    # Main Express server
│   ├── dataProcessor.js       # CSV/JSON data processing
│   ├── videoTimestampMapper.js
│   ├── preprocessData.js      # CSV to JSON preprocessing
│   └── diagnostics.js         # Diagnostic utilities
├── client/              # Client-side files
│   ├── index.html       # Main HTML page
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript modules
│   │   ├── playback.js  # Playback control logic
│   │   ├── main.js      # Main application logic
│   │   ├── map.js       # Map visualization
│   │   ├── chart.js     # Chart rendering
│   │   ├── attitude-chart.js
│   │   └── youtube-player.js
│   ├── godot/           # Godot HTML5 export (3D display)
│   │   └── Display.html # Godot display with WebSocket bridge
│   └── diagnostics.html # Diagnostic page
├── godot-project/       # Godot project scripts
│   └── Scripts/
├── merged_data.csv      # Flight data (74MB)
├── merged_data.json     # Preprocessed data (generated, gitignored)
└── env.example          # Environment variables template
```

## Environment Variables

Create a `.env` file based on `env.example` (see below for details).

**Required for production:**
- `YOUTUBE_VIDEO_ID` - Your YouTube video ID
- `WS_URL` - Your production URL (e.g., https://your-app.onrender.com)

**Optional:**
- `YOUTUBE_START_OFFSET` - Time offset in seconds (default: 0.0)
- `PORT` - Server port (auto-set by Render)

## Quick Start

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Configure YouTube Video

Create a `.env` file in the `flight-display/` directory:

```bash
cd flight-display
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

### 3. (Optional) Preprocess Data for Faster Loading

For faster startup times, preprocess the CSV to JSON:

```bash
npm run preprocess
```

This generates `flight-display/merged_data.json` which loads 10-50x faster than CSV parsing.

### 4. Start the Server

From the project root:

```bash
npm start
```

The server runs on port 3000 by default (or `PORT` environment variable).

### 5. Open in Browser

Navigate to `http://localhost:3000/webdisplay`

## Configuration

### Environment Variables

Create a `.env` file based on `env.example` (see below for details).

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUTUBE_VIDEO_ID` | YouTube video ID (required) | - |
| `YOUTUBE_START_OFFSET` | Video sync offset in seconds | `0.0` |
| `PORT` | Server port | `3000` |
| `WS_URL` | WebSocket URL (for production) | Auto-detected |
| `DOWNSAMPLE_FACTOR` | Memory optimization (higher = less memory) | `20` |
| `NODE_ENV` | Node environment | `development` |

### Data Files

The system expects:
- `merged_data.csv` in the `flight-display/` directory (flight data) ✅ **Already included**
- `youtube_timestamps.json` in the `flight-display/` directory (optional, improves video sync) ✅ **Already included**
- `video_timestamps.json` in the `flight-display/` directory (optional fallback) ✅ **Already included**
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

The project is configured for Render.com deployment. See `../DEPLOYMENT.md` for complete instructions.

**Quick steps:**
1. Push code to GitHub
2. Connect repository to Render
3. Render uses `render.yaml` for configuration
4. Set environment variables in Render dashboard:
   - `YOUTUBE_VIDEO_ID` (required)
   - `WS_URL` (your Render URL, set after first deploy)
   - `YOUTUBE_START_OFFSET` (optional, default: 0.0)

**Build process:**
- Automatically runs `npm install && npm run preprocess` during build
- Generates `merged_data.json` for faster loading (10-50x faster)
- JSON file stays on Render filesystem (not committed to Git)

**Free Tier Limitations:**
- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (wake-up)
- 512MB memory limit (optimized to use ~160MB)
- 500MB disk space, 100GB bandwidth/month

## Integration

This flight display is integrated into the main Personal Website project. The server (`server.js` in project root) serves both:

- Main site: `http://localhost:3000/`
- Flight display: `http://localhost:3000/webdisplay`

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

1. Install dependencies: `npm install` (from project root)
2. Set environment variables (create `flight-display/.env` file)
3. Run: `npm start` (from project root)
4. Open: `http://localhost:3000/webdisplay` (URL path remains `/webdisplay` for compatibility)

### Default Settings

- **Playback Speed**: 2x (configurable in `js/playback.js`)
- **Update Frequency**: Map/charts update every 100 frames (configurable in `js/main.js`)
- **Data Preloading**: All flight data is preloaded for smooth playback
- **Downsampling**: Charts use 20x downsampling (configurable via `DOWNSAMPLE_FACTOR`)

### Godot Integration

The 3D display uses Godot HTML5 export. Important notes:
- The WebSocket bridge script must be in `frontend/godot/Display.html`
- After each Godot HTML5 export, you must re-add the WebSocket bridge script
- The bridge script connects Godot to the Node.js WebSocket server

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
- Check that `package.json` has all dependencies
- Verify Node.js version matches `engines.node` in `package.json`
- Check build logs for dependency errors
- Ensure `merged_data.csv` exists in `flight-display/` directory

### Performance Issues
- Reduce update frequency in `js/main.js` (change `% 100` to `% 200`)
- Check network tab for slow asset loading
- Verify data file is not too large

## Notes

- **YouTube Video**: The system uses YouTube video for playback, eliminating the need for large frame storage
- **Video Sync**: YouTube video automatically syncs with flight data timestamps
- **Godot Display**: Requires WebSocket bridge script in `Display.html` (see `frontend/godot/Display.html`)
- **Data Preloading**: All flight data is preloaded for smooth playback
- **Performance**: JSON preprocessing runs automatically during Render build (10-50x faster than CSV)
- **Memory**: Optimized to use ~160MB (well under 512MB Render limit)

## License

Part of the Flight Test 1 - SR22 project demonstration.
