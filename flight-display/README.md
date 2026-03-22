# Flight Test HMD Display

A web-based playback system for a pilot Helmet-Mounted Display (HMD) developed for aerospace flight test operations. The HMD renders real-time flight symbology driven by sensor data from the aircraft. This app replays an actual test flight using recorded data, synchronized to cockpit video.

Available at [joelandrewmiller.com/webdisplay](https://joelandrewmiller.com/webdisplay).

## What's Displayed

| Panel | Description |
|---|---|
| **3D View (HMD)** | The HMD itself — symbology and orientation cues rendered in real time via Godot |
| **Video Feed** | Cockpit footage recorded during the test flight, synchronized to HMD playback |
| **Flight Path** | GPS track on an interactive map (Leaflet.js) |
| **Altitude Profile** | Aircraft altitude over time (Chart.js) |
| **Attitude Charts** | Pitch, roll, and heading throughout the flight |

## Architecture

Flight data is loaded once at startup from `merged_data.csv` (preprocessed to JSON). On page load, the client downloads a compact binary blob (`/api/hmd-data`) containing all post-takeoff HMD fields at 3× downsampling (~1.8 MB). Per-frame data lookups use an O(log n) binary search on this local buffer — no per-frame server round-trips.

Video synchronization uses `youtube_timestamps.json` (52,804 entries mapping flight data timestamps to YouTube video times). The client interpolates between entries to map any video time to the correct data timestamp.

## Project Structure

```
flight-display/
├── client/
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── main.js              # App initialization and video sync loop
│       ├── playback.js          # WebSocket playback engine
│       ├── map.js               # Leaflet flight path map
│       ├── chart.js             # Altitude chart
│       ├── attitude-chart.js    # Pitch/roll/heading charts
│       └── youtube-player.js    # YouTube IFrame API wrapper
│   └── godot/
│       └── Display.html         # Godot HTML5 export (HMD renderer)
├── server/
│   ├── webdisplayServer.js      # Express API + Socket.IO
│   ├── dataProcessor.js         # CSV/JSON data access
│   ├── videoTimestampMapper.js  # Video ↔ data timestamp mapping
│   └── preprocessData.js        # CSV → JSON preprocessing script
├── godot-project/               # Godot source (GDScript)
├── merged_data.csv              # Recorded flight data (~74 MB)
├── merged_data.json             # Preprocessed cache (generated, gitignored)
├── youtube_timestamps.json      # Video sync map (52,804 entries)
└── env.example                  # Environment variable template
```

## Setup

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Configure Environment

Create `flight-display/.env` from the template:

```bash
cp flight-display/env.example flight-display/.env
```

Edit `.env`:

```env
YOUTUBE_VIDEO_ID=your_video_id_here   # Required
YOUTUBE_START_OFFSET=0.0              # Seconds to offset video sync
```

### 3. (Optional) Preprocess Flight Data

Speeds up server startup significantly:

```bash
npm run preprocess
```

This generates `flight-display/merged_data.json` (10–50× faster to load than CSV).

### 4. Start

```bash
npm start
```

Open `http://localhost:3000/webdisplay`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `YOUTUBE_VIDEO_ID` | YouTube video ID (required) | — |
| `YOUTUBE_START_OFFSET` | Video sync offset in seconds | `0.0` |
| `PORT` | Server port | `3000` |
| `DOWNSAMPLE_FACTOR` | Chart data downsampling | `20` |
| `NODE_ENV` | Node environment | `development` |

## Deployment

The app is deployed on [Render](https://render.com) as part of the main personal website. Render runs a persistent Node.js process, so WebSocket connections work normally via Socket.IO.

Set the following environment variables in the Render dashboard:
- `YOUTUBE_VIDEO_ID` (required)
- `WS_URL` — your Render service URL (e.g. `https://your-app.onrender.com`), set after first deploy
- `YOUTUBE_START_OFFSET` (optional)

**Free tier note:** The service sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up.

## Godot HMD Display

The 3D HMD view is a Godot HTML5 export (`client/godot/Display.html`). After each Godot re-export, you must re-add the data bridge script that injects flight data into the Godot runtime via `godotLatestData` and `godotDataReceivedCount` globals on the iframe's `contentWindow`.

The bridge does **not** rely on WebSocket connectivity — data is written directly to the iframe window by the parent page's video sync loop.

## Troubleshooting

**Video not showing**
- Confirm `YOUTUBE_VIDEO_ID` is set and the video is public or unlisted.

**Video out of sync**
- Adjust `YOUTUBE_START_OFFSET`. Formula: `flight_data_start_time − video_start_time`.

**HMD not updating**
- Check browser console for errors loading `/api/hmd-data`.
- Verify `client/godot/Display.html` contains the data bridge script.

**Plots not updating**
- Confirm `takeoffIndex` is resolving correctly on the server (check `/api/init` response).
- The map and chart guard against indices before takeoff — if `takeoffIndex` is wrong, all updates will be silently skipped.

**Server won't start**
- Ensure `merged_data.csv` exists in `flight-display/`.
- Run `npm run preprocess` to generate the JSON cache if startup is slow.
