"""
Flask backend server for web-based flight test playback.
Serves flight data and WebSocket updates with YouTube video integration.
"""

import os
import sys
import json
import math
import socket
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import threading
import time
from bisect import bisect_left

# Add parent directory to path to import data_processor
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from webdisplay.backend.data_processor import FlightDataProcessor
from webdisplay.backend.video_timestamp_mapper import VideoTimestampMapper

# Get the frontend directory path
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

# Use gevent async mode for production (with gunicorn), threading for development
# Flask-SocketIO will auto-detect gevent when running with gevent workers
async_mode = os.environ.get("SOCKETIO_ASYNC_MODE", "gevent")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)

# Initialize data processor
# __file__ is webdisplay/backend/app.py
# .parent = webdisplay/backend
# .parent.parent = webdisplay
# .parent.parent.parent = project root
BASE_DIR = Path(__file__).parent.parent.parent
WEBDISPLAY_DIR = Path(__file__).parent.parent  # webdisplay directory
DATA_FILE = WEBDISPLAY_DIR / "merged_data.csv"  # Data file is now in webdisplay directory
FRAMES_DIR = BASE_DIR / "camera_frames_flipped"

# Pre-load frame information (like playback.py)
frames_info = []
frames_ts_ns = []
frames_fnames = []
if FRAMES_DIR.exists():
    print(f"Loading frame information from {FRAMES_DIR}...")
    frames = [f for f in os.listdir(FRAMES_DIR) if f.lower().endswith(".jpg")]
    for fname in frames:
        parts = fname.split("_")
        if len(parts) >= 4:
            ts_str = parts[2]
            try:
                ts_sec = float(ts_str)
                frames_info.append((ts_sec, fname))
            except ValueError:
                continue
    frames_info.sort(key=lambda x: x[0])
    frames_ts_ns = [ts for ts, _ in frames_info]
    frames_fnames = [fname for _, fname in frames_info]
    print(f"Loaded {len(frames_info)} frames")
else:
    print(f"Warning: Frames directory not found: {FRAMES_DIR}")


# YouTube video configuration
def extract_video_id(video_id_or_url):
    """Extract clean video ID from various YouTube URL formats or plain video ID"""
    if not video_id_or_url:
        return ""

    video_id_or_url = video_id_or_url.strip()

    # If it's already just a video ID (11 characters, alphanumeric), return it
    if len(video_id_or_url) == 11 and video_id_or_url.replace("-", "").replace("_", "").isalnum():
        return video_id_or_url

    # Handle various YouTube URL formats
    import re

    # Pattern for youtube.com/watch?v=VIDEO_ID
    match = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})", video_id_or_url)
    if match:
        return match.group(1)

    # Pattern for youtube.com/embed/VIDEO_ID
    match = re.search(r"youtube\.com/embed/([a-zA-Z0-9_-]{11})", video_id_or_url)
    if match:
        return match.group(1)

    # If no pattern matches, try to extract 11-character alphanumeric string
    match = re.search(r"([a-zA-Z0-9_-]{11})", video_id_or_url)
    if match:
        return match.group(1)

    # Return as-is if we can't extract (will fail later with better error message)
    return video_id_or_url


YOUTUBE_VIDEO_ID_RAW = os.environ.get("YOUTUBE_VIDEO_ID", "")
YOUTUBE_VIDEO_ID = extract_video_id(YOUTUBE_VIDEO_ID_RAW)
YOUTUBE_START_OFFSET = float(
    os.environ.get("YOUTUBE_START_OFFSET", "0.0")
)  # Offset in seconds from flight data start

# Load video timestamp mapping if available
# Try YouTube-specific mapping first, then fall back to original
# Check webdisplay directory first (for self-contained hosting), then project root
video_timestamp_mapper = None
try:
    # First try YouTube-specific mapping in webdisplay directory
    youtube_map_file = WEBDISPLAY_DIR / "youtube_timestamps.json"
    if not youtube_map_file.exists():
        # Fall back to project root
        youtube_map_file = BASE_DIR / "youtube_timestamps.json"
    
    if youtube_map_file.exists():
        video_timestamp_mapper = VideoTimestampMapper(youtube_map_file)
        if video_timestamp_mapper.is_available():
            print(
                f"✓ Loaded YouTube timestamp mapping: {len(video_timestamp_mapper.timestamps)} entries"
            )
        else:
            print(f"⚠ YouTube mapping file found but failed to load")

    # Fall back to original mapping if YouTube mapping not available
    if video_timestamp_mapper is None or not video_timestamp_mapper.is_available():
        timestamp_map_file = WEBDISPLAY_DIR / "video_timestamps.json"
        if not timestamp_map_file.exists():
            # Fall back to project root
            timestamp_map_file = BASE_DIR / "video_timestamps.json"
        
        if timestamp_map_file.exists():
            video_timestamp_mapper = VideoTimestampMapper(timestamp_map_file)
            if video_timestamp_mapper.is_available():
                print(
                    f"✓ Loaded original timestamp mapping: {len(video_timestamp_mapper.timestamps)} entries"
                )

    if video_timestamp_mapper is None or not video_timestamp_mapper.is_available():
        print("⚠ No timestamp mapping available - using offset calculation")
except Exception as e:
    print(f"⚠ Could not load video timestamp mapping: {e}")
    print("  Using simple offset calculation instead")


processor = None
playback_thread = None
playback_active = False
playback_index = 0
playback_speed = 2.0  # Default speed 2x

# UDP socket for Godot (if using original UDP-based script)
UDP_IP = "127.0.0.1"
UDP_PORT = 1991
udp_socket = None
try:
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    print(f"UDP socket created for Godot on {UDP_IP}:{UDP_PORT}")
except Exception as e:
    print(f"Warning: Could not create UDP socket: {e}")

# Timestamp markers (same as playback.py)
TIMESTAMPS = {
    0: 2643.0,  # Takeoff
    1: 2888.0,  # Test 1 - head movement
    2: 3190.0,  # Test 2 - 90 turn left
    3: 3242.0,  # Test 2 - 90 turn right
    4: 3299.0,  # Test 2 - 360
    5: 3451.0,  # Test 3 - 5 Up
    6: 3466.0,  # Test 3 - 10 Up
    7: 3495.0,  # Test 3 - 15 Up
    8: 3519.0,  # Test 3 - 5 Down
    9: 3539.0,  # Test 3 - 10 Down
    10: 3605.0,  # Test 5 - Climb Turn
    11: 3712.0,  # Test 5 - Decend Turn
    12: 4823.02,  # Landing
}


@app.route("/")
def index():
    """Serve the main HTML page with WS_URL injected"""
    html_path = FRONTEND_DIR / "index.html"
    html_content = html_path.read_text()
    # Inject WS_URL script tag for frontend to use
    ws_url = os.environ.get("WS_URL", request.host_url.rstrip("/"))
    inject_script = f'<script>window.WS_URL = "{ws_url}";</script>'
    html_content = html_content.replace("</head>", f"{inject_script}</head>")
    return html_content


@app.route("/api/init")
def init():
    """Initialize and return flight data summary"""
    global processor
    try:
        processor = FlightDataProcessor(DATA_FILE)
        summary = processor.get_summary()

        # Get flight path bounds for map initialization
        bounds = None
        complete_path = []
        complete_altitudes = []
        complete_attitudes = {"yaws": [], "pitches": [], "rolls": []}

        takeoff_index = 0
        if processor.get_data_count() > 0:
            # Get first and last timestamps for reference
            first_data = processor.get_data_at_index(0)
            last_data = processor.get_data_at_index(processor.get_data_count() - 1)
            if first_data and last_data:
                print(
                    f"Data range: {first_data.get('timestamp_seconds', 0):.2f}s to {last_data.get('timestamp_seconds', 0):.2f}s"
                )
                print(
                    f"Total duration: {last_data.get('timestamp_seconds', 0) - first_data.get('timestamp_seconds', 0):.2f}s"
                )

            # Find takeoff index (timestamp 0 = 2643.0 seconds)
            takeoff_timestamp = TIMESTAMPS.get(0, 2643.0)
            takeoff_index = processor.find_index_for_timestamp(takeoff_timestamp)
            if takeoff_index is None:
                takeoff_index = 0
                print(f"Warning: Could not find takeoff index, starting from 0")
            else:
                print(f"Takeoff found at index {takeoff_index} (timestamp {takeoff_timestamp}s)")
                if YOUTUBE_VIDEO_ID:
                    print(f"YouTube offset: {YOUTUBE_START_OFFSET}s")
                    print(
                        f"  → Video time at takeoff: {takeoff_timestamp - YOUTUBE_START_OFFSET:.2f}s"
                    )

            # Efficiently extract all path data (like playback.py)
            path_data = processor.get_all_path_data()
            all_lats = path_data["lats"]
            all_lons = path_data["lons"]
            all_alts = path_data["alts"]

            # Efficiently extract all attitude data
            attitude_data = processor.get_all_attitude_data()
            complete_attitudes = {
                "yaws": attitude_data["yaws"],
                "pitches": attitude_data["pitches"],
                "rolls": attitude_data["rolls"],
            }

            # Calculate bounds from all points
            if all_lats and all_lons:
                bounds = {
                    "min_lat": min(all_lats),
                    "max_lat": max(all_lats),
                    "min_lon": min(all_lons),
                    "max_lon": max(all_lons),
                }

                # Pre-load complete path and altitudes (fast - already extracted)
                complete_path = [
                    {"lat": lat, "lon": lon, "alt": alt, "index": i}
                    for i, (lat, lon, alt) in enumerate(zip(all_lats, all_lons, all_alts))
                ]
                complete_altitudes = all_alts
            else:
                complete_path = []
                complete_altitudes = []

        return jsonify(
            {
                "success": True,
                "summary": summary,
                "timestamps": TIMESTAMPS,
                "bounds": bounds,
                "complete_path": complete_path,
                "complete_altitudes": complete_altitudes,
                "complete_attitudes": complete_attitudes,
                "takeoff_index": takeoff_index,
                "youtube": (
                    {
                        "enabled": bool(YOUTUBE_VIDEO_ID),
                        "video_id": YOUTUBE_VIDEO_ID,
                        "start_offset": YOUTUBE_START_OFFSET,
                        "has_timestamp_map": video_timestamp_mapper is not None
                        and video_timestamp_mapper.is_available(),
                        "timestamp_map": (
                            video_timestamp_mapper.timestamps[:2000]
                            if (video_timestamp_mapper and video_timestamp_mapper.is_available())
                            else None
                        ),  # Send first 2000 entries for client-side caching
                    }
                    if YOUTUBE_VIDEO_ID
                    else None
                ),
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/video-time/<float:data_timestamp>")
@app.route("/api/video-time/<int:data_timestamp>")  # Also handle integer timestamps
def get_video_time(data_timestamp):
    """Convert flight data timestamp to video time using timestamp mapping"""
    # Convert to float if needed
    data_timestamp = float(data_timestamp)

    if video_timestamp_mapper and video_timestamp_mapper.is_available():
        video_time = video_timestamp_mapper.data_to_video_time(data_timestamp)
        if video_time is not None:
            return jsonify({"success": True, "video_time": video_time})

    # Fallback to offset calculation
    video_time = max(0, data_timestamp - YOUTUBE_START_OFFSET)
    return jsonify({"success": True, "video_time": video_time, "using_offset": True})


@app.route("/api/data-timestamp/<float:video_time>")
def get_data_timestamp(video_time):
    """Convert video time to flight data timestamp using timestamp mapping (reverse mapping)"""
    if video_timestamp_mapper and video_timestamp_mapper.is_available():
        data_timestamp = video_timestamp_mapper.video_to_data_time(video_time)
        if data_timestamp is not None:
            return jsonify({"success": True, "data_timestamp": data_timestamp})

    # Fallback to offset calculation
    data_timestamp = video_time + YOUTUBE_START_OFFSET
    return jsonify({"success": True, "data_timestamp": data_timestamp, "using_offset": True})


@app.route("/api/data-for-video-time/<float:video_time>")
@app.route("/api/data-for-video-time", methods=["GET"])  # Also accept as query parameter
def get_data_for_video_time(video_time=None):
    """Get flight data for a specific video time (video-driven sync)"""
    try:
        # Handle query parameter if path parameter not provided
        if video_time is None:
            video_time = request.args.get("video_time", type=float)
            if video_time is None:
                return jsonify({"success": False, "error": "video_time parameter required"}), 400

        if processor is None:
            print(f"[ERROR] Processor not initialized for video_time={video_time}")
            return jsonify({"success": False, "error": "Data not initialized"}), 400

        # Convert video time to flight data timestamp
        if video_timestamp_mapper and video_timestamp_mapper.is_available():
            data_timestamp = video_timestamp_mapper.video_to_data_time(video_time)
            if data_timestamp is None:
                # Fallback to offset calculation
                data_timestamp = video_time + YOUTUBE_START_OFFSET
        else:
            # Fallback to offset calculation
            data_timestamp = video_time + YOUTUBE_START_OFFSET

        # Find the index for this timestamp
        index = processor.find_index_for_timestamp(data_timestamp)
        if index is None:
            # Return success=False but with 200 status to allow frontend to handle gracefully
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"No data found for timestamp {data_timestamp:.2f}s",
                    }
                ),
                200,
            )

        # Get data at this index
        data = processor.get_data_at_index(index)
        if data is None:
            return jsonify({"success": False, "error": "Data not found"}), 404

        return jsonify(
            {
                "success": True,
                "data": data,
                "index": index,
                "video_time": video_time,
                "data_timestamp": data_timestamp,
                "timestamp_info": {
                    "video_time": video_time,
                    "data_timestamp": data_timestamp,
                    "data_index": index,
                    "timestamp_display": f"Video: {video_time:.2f}s | Data: {data_timestamp:.2f}s",
                },
            }
        )
    except Exception as e:
        print(f"[ERROR] Exception in get_data_for_video_time for video_time={video_time}: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/find-index/<float:timestamp>")
def find_index_for_timestamp(timestamp):
    """Find the data index closest to a given timestamp (in seconds)"""
    if processor is None:
        return jsonify({"error": "Data not initialized"}), 400

    index = processor.find_index_for_timestamp(timestamp)
    if index is None:
        return jsonify({"error": "Timestamp not found"}), 404

    return jsonify({"success": True, "index": index, "timestamp": timestamp})


@app.route("/api/jump/<int:timestamp_id>")
def jump_to_timestamp(timestamp_id):
    """Jump to a specific timestamp marker"""
    global playback_index, playback_active

    if timestamp_id not in TIMESTAMPS:
        return jsonify({"error": "Invalid timestamp ID"}), 400

    if processor is None:
        return jsonify({"error": "Data not initialized"}), 400

    target_time = TIMESTAMPS[timestamp_id]
    index = processor.find_index_for_timestamp(target_time)

    if index is None:
        return jsonify({"error": "Timestamp not found in data"}), 404

    # Immediately update playback index and pause to prevent race conditions
    playback_index = index
    playback_active = False  # Pause playback so it can be restarted cleanly

    print(f"Jumped to timestamp {timestamp_id} (index {index}, time {target_time}s)")

    return jsonify({"success": True, "index": index, "timestamp": target_time})


@app.route("/api/frame/<float:timestamp>")
def get_frame(timestamp):
    """Get frame image for a given timestamp (in seconds)"""
    if not frames_info:
        return jsonify({"error": "No frames available"}), 404

    # Find nearest frame using binary search (like playback.py)
    pos = bisect_left(frames_ts_ns, timestamp)
    if pos == 0:
        nearest_idx = 0
    elif pos == len(frames_ts_ns):
        nearest_idx = len(frames_ts_ns) - 1
    else:
        before = frames_ts_ns[pos - 1]
        after = frames_ts_ns[pos]
        nearest_idx = pos - 1 if (timestamp - before) <= (after - timestamp) else pos

    frame_filename = frames_fnames[nearest_idx]
    frame_path = FRAMES_DIR / frame_filename

    if frame_path.exists():
        return send_from_directory(str(FRAMES_DIR), frame_filename)
    else:
        return jsonify({"error": "Frame not found"}), 404


@app.route("/api/data/<int:index>")
def get_data_at_index(index):
    """Get flight data at a specific index"""
    if processor is None:
        return jsonify({"error": "Data not initialized"}), 400

    data = processor.get_data_at_index(index)
    if data is None:
        return jsonify({"error": "Index out of range"}), 404

    return jsonify(data)


@app.route("/api/path/<int:start_index>/<int:end_index>")
def get_path_data(start_index, end_index):
    """Get flight path data for a range of indices (for rebuilding path after jump)"""
    if processor is None:
        return jsonify({"error": "Data not initialized"}), 400

    # Limit range to prevent huge responses (max 10000 points)
    max_range = 10000
    if end_index - start_index > max_range:
        end_index = start_index + max_range

    path_data = []
    for i in range(start_index, min(end_index + 1, processor.get_data_count())):
        data = processor.get_data_at_index(i)
        if data:
            path_data.append(
                {"index": i, "lat": data["VLAT"], "lon": data["VLON"], "alt": data["VALT"]}
            )

    return jsonify(
        {
            "success": True,
            "path": path_data,
            "start_index": start_index,
            "end_index": min(end_index, processor.get_data_count() - 1),
        }
    )


@socketio.on("connect")
def handle_connect():
    """Handle WebSocket connection"""
    print("Client connected")
    emit("connected", {"status": "ok"})


@socketio.on("godot_connect")
def handle_godot_connect():
    """Handle Godot WebSocket connection - send data in same format as UDP"""
    print("Godot client connected via WebSocket")
    emit("godot_connected", {"status": "ok"})


@socketio.on("godot_data")
def handle_godot_data(data):
    """Forward godot_data events from frontend to all clients (including Godot HTML5 export)
    This allows video-driven mode to send data to Godot even when playback_loop is inactive"""
    # Forward the data to all connected clients (including Godot)
    # This enables video-driven mode to work with Godot
    socketio.emit("godot_data", data, room=None)

    # Log periodically to verify data is being forwarded
    if not hasattr(handle_godot_data, "_count"):
        handle_godot_data._count = 0
    handle_godot_data._count += 1
    if handle_godot_data._count <= 5 or handle_godot_data._count % 100 == 0:
        print(
            f"[BACKEND] Forwarded godot_data #{handle_godot_data._count}: VQX={data.get('VQX', 0):.3f}, VQY={data.get('VQY', 0):.3f}, VALT={data.get('VALT', 0):.1f}"
        )


@socketio.on("disconnect")
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print("Client disconnected")


@socketio.on("start_playback")
def handle_start_playback(data):
    """Start playback"""
    global playback_active, playback_index, playback_speed

    if processor is None:
        print("ERROR: Processor is None - cannot start playback")
        emit("error", {"message": "Data not initialized"})
        return

    # Always update playback_index if provided
    if "index" in data:
        playback_index = int(data["index"])
        print(
            f"[PLAYBACK] Starting playback from index {playback_index} at speed {data.get('speed', 2.0)}x"
        )
    else:
        print(
            f"[PLAYBACK] Starting playback from current index {playback_index} at speed {data.get('speed', 2.0)}x"
        )

    playback_active = True
    # YouTube maximum is 2x - cap the speed
    requested_speed = data.get("speed", 2.0)
    playback_speed = min(requested_speed, 2.0)  # Cap at 2x to match YouTube
    if requested_speed > 2.0:
        print(f"[PLAYBACK] Speed capped to {playback_speed}x (YouTube maximum is 2x)")

    print(
        f"[PLAYBACK] Playback state: active={playback_active}, index={playback_index}, speed={playback_speed}x"
    )

    # Start playback thread if not already running
    global playback_thread
    if playback_thread is None or not playback_thread.is_alive():
        playback_thread = threading.Thread(target=playback_loop, daemon=True)
        playback_thread.start()
        print(
            f"[PLAYBACK] ✓ Playback thread started (active={playback_active}, index={playback_index})"
        )
    else:
        print(f"[PLAYBACK] Playback thread already running, resuming from index {playback_index}")
        # Make sure playback is active - this is critical!
        playback_active = True
        print(f"[PLAYBACK] ✓ Set playback_active=True, thread should resume")

    emit("playback_started")
    print(
        f"[PLAYBACK] ✓ Emitted playback_started event to clients (active={playback_active}, index={playback_index})"
    )


@socketio.on("pause_playback")
def handle_pause_playback():
    """Pause playback"""
    global playback_active
    playback_active = False
    emit("playback_paused")


@socketio.on("set_speed")
def handle_set_speed(data):
    """Set playback speed (capped at 2x to match YouTube maximum)"""
    global playback_speed
    requested_speed = float(data.get("speed", 1.0))
    playback_speed = min(requested_speed, 2.0)  # Cap at 2x to match YouTube
    if requested_speed > 2.0:
        print(f"[PLAYBACK] Speed capped to {playback_speed}x (YouTube maximum is 2x)")
    emit("speed_changed", {"speed": playback_speed})


@socketio.on("seek")
def handle_seek(data):
    """Seek to a specific index"""
    global playback_index
    playback_index = int(data.get("index", 0))
    # Note: last_timestamp will be reset in playback_loop on next iteration
    emit("seeked", {"index": playback_index})


def playback_loop():
    """Main playback loop that sends data via WebSocket
    Uses timestamp-based timing to match variable frame capture rates
    """
    global playback_active, playback_index, playback_speed

    print(f"[PLAYBACK LOOP] ✓ Started (initial index={playback_index}, active={playback_active})")
    print(f"[PLAYBACK LOOP] Using timestamp-based timing to match variable frame rates")
    frame_count = 0
    last_log_index = -1
    last_timestamp = None  # Track previous timestamp to calculate time difference

    while True:
        if not playback_active:
            # Log occasionally when paused
            if frame_count % 1000 == 0:
                print(f"[PLAYBACK LOOP] Paused (index={playback_index}, waiting...)")
            time.sleep(0.1)
            continue

        if processor is None:
            print("[PLAYBACK LOOP] ERROR: Processor is None, stopping playback loop")
            break

        if playback_index >= processor.get_data_count():
            playback_active = False
            print(
                f"[PLAYBACK LOOP] Finished at index {playback_index} (total: {processor.get_data_count()})"
            )
            socketio.emit("playback_finished")
            break

        # Get data at current index
        data = processor.get_data_at_index(playback_index)

        # Calculate sleep time based on timestamp difference
        # This ensures playback rate matches the actual capture rate
        if data:
            current_timestamp = data.get("timestamp_seconds")

            if last_timestamp is not None and current_timestamp is not None:
                # Calculate actual time difference between frames
                timestamp_diff = current_timestamp - last_timestamp

                # Debug: Log first few timestamp differences to understand the data
                if frame_count < 10:
                    print(
                        f"[PLAYBACK LOOP] Frame {frame_count}: ts={current_timestamp:.3f}, last_ts={last_timestamp:.3f}, diff={timestamp_diff:.6f}s"
                    )

                # If timestamp goes backwards or jumps too far forward, we've jumped/seeked
                # Reset last_timestamp to prevent incorrect timing
                if timestamp_diff < 0:
                    print(
                        f"[PLAYBACK LOOP] Timestamp went backwards: {timestamp_diff:.6f}s, resetting timing"
                    )
                    last_timestamp = None
                    sleep_time = 0.01 / playback_speed
                elif timestamp_diff > 10.0:  # More than 10 seconds = likely a jump
                    print(
                        f"[PLAYBACK LOOP] Timestamp jump detected: {timestamp_diff:.2f}s, resetting timing"
                    )
                    last_timestamp = None
                    sleep_time = 0.01 / playback_speed
                elif timestamp_diff == 0:
                    # Same timestamp - use minimum delay
                    print(
                        f"[PLAYBACK LOOP] Warning: Zero timestamp difference at index {playback_index}"
                    )
                    sleep_time = 0.001 / playback_speed
                else:
                    # Apply playback speed multiplier
                    # At 2x speed, we play through 2 seconds of flight time per 1 second of real time
                    sleep_time = timestamp_diff / playback_speed

                    # Clamp sleep time to reasonable bounds
                    # Minimum: 0.001s (1000fps max) to prevent excessive CPU usage
                    # Maximum: 0.1s (10fps min) to prevent long pauses
                    original_sleep = sleep_time
                    sleep_time = max(0.001, min(0.1, sleep_time))
                    if original_sleep != sleep_time and frame_count < 10:
                        print(
                            f"[PLAYBACK LOOP] Sleep time clamped: {original_sleep:.6f}s -> {sleep_time:.6f}s"
                        )
            else:
                # First frame or missing timestamp - use default small delay
                sleep_time = 0.01 / playback_speed

            # Update last timestamp for next iteration
            last_timestamp = current_timestamp
        else:
            # No data at this index - use default delay
            sleep_time = 0.01 / playback_speed

        if data:

            # Send to all connected clients (main web page)
            # Use emit with room=None to send to all clients
            socketio.emit("frame_update", data, room=None)

            # Debug: Log first few frames and periodically to verify data is being sent
            if frame_count < 20 or (
                playback_index != last_log_index and playback_index % 1000 == 0
            ):
                timestamp_info = f"ts={current_timestamp:.2f}" if current_timestamp else "ts=N/A"
                if last_timestamp is not None and current_timestamp is not None:
                    diff_info = (
                        f", diff={current_timestamp - last_timestamp:.3f}s, sleep={sleep_time:.3f}s"
                    )
                else:
                    diff_info = ""
                print(
                    f"[PLAYBACK LOOP] ✓ Sent frame_update: index={playback_index}, {timestamp_info}{diff_info}"
                )
                last_log_index = playback_index

            # Also send to Godot via UDP (original playback.py format)
            # This allows the original Godot script to work without modification
            if udp_socket:
                try:
                    godot_data = {
                        "VQX": data.get("VQX", 0),
                        "VQY": data.get("VQY", 0),
                        "VQZ": data.get("VQZ", 0),
                        "VQW": data.get("VQW", 1),
                        "HQX": data.get("HQX", 0),
                        "HQY": data.get("HQY", 0),
                        "HQZ": data.get("HQZ", 0),
                        "HQW": data.get("HQW", 1),
                        "GSPEED": data.get("GSPEED", 0),
                        "VALT": data.get("VALT", 0),
                    }
                    json_data = json.dumps(godot_data)
                    udp_socket.sendto(json_data.encode("utf-8"), (UDP_IP, UDP_PORT))
                except Exception as e:
                    # Silently fail if UDP send fails (Godot might not be running)
                    pass

            # Also send via WebSocket for Godot HTML5 export (if using WebSocket version)
            # Only send if playback is actually active (not just paused)
            if playback_active:
                godot_data = {
                    "VQX": data.get("VQX", 0),
                    "VQY": data.get("VQY", 0),
                    "VQZ": data.get("VQZ", 0),
                    "VQW": data.get("VQW", 1),
                    "HQX": data.get("HQX", 0),
                    "HQY": data.get("HQY", 0),
                    "HQZ": data.get("HQZ", 0),
                    "HQW": data.get("HQW", 1),
                    "GSPEED": data.get("GSPEED", 0),
                    "VALT": data.get("VALT", 0),
                }
                socketio.emit("godot_data", godot_data, room=None)

            frame_count += 1

            # Log every 100 frames for debugging
            if frame_count % 100 == 0:
                print(f"Sent {frame_count} frames, current index: {playback_index}")

        playback_index += 1

        # Sleep based on calculated timestamp difference
        # This ensures playback matches the actual capture rate
        time.sleep(sleep_time)


# Serve Godot export files
GODOT_DIR = FRONTEND_DIR / "godot"


@app.route("/godot/<path:filename>")
def serve_godot_file(filename):
    """Serve Godot HTML5 export files with WS_URL injected for Display.html"""
    if GODOT_DIR.exists():
        if filename == "Display.html":
            # Inject WS_URL into Godot HTML file
            html_path = GODOT_DIR / filename
            html_content = html_path.read_text()
            ws_url = os.environ.get("WS_URL", request.host_url.rstrip("/"))
            inject_script = f'<script>window.WS_URL = "{ws_url}";</script>'
            # Inject before the socket.io script
            html_content = html_content.replace(
                '<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>',
                f'<script>window.WS_URL = "{ws_url}";</script>\n\t\t<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>',
            )
            return html_content
        else:
            return send_from_directory(str(GODOT_DIR), filename)
    from flask import abort

    abort(404)


# Catch-all route for static files (must be last)
# Note: Flask matches routes in order, so specific API routes above will be matched first
@app.route("/<path:path>")
def serve_static_files(path):
    """Serve static files from frontend directory"""
    # Debug logging
    print(f"[DEBUG] Serving static file request: {path}")
    
    # Don't serve API or godot routes - they should be handled by specific routes above
    # If we reach here for an API route, it means the route wasn't found, so 404 is correct
    if path.startswith("api/") or path.startswith("godot/"):
        from flask import abort

        abort(404)
    # Serve from frontend directory
    try:
        # Normalize the path to prevent path traversal
        # Remove any '..' or absolute paths
        # Note: Flask's <path:path> already strips leading slashes, so we don't need to check for that
        if ".." in path:
            from flask import abort

            print(f"[ERROR] Path traversal attempt detected: {path}")
            abort(403)

        file_path = FRONTEND_DIR / path
        print(f"[DEBUG] Resolved file path: {file_path}")

        # Security check: ensure the file is within the frontend directory
        # Use a more robust check that works across different platforms
        try:
            resolved_file = file_path.resolve()
            resolved_frontend = FRONTEND_DIR.resolve()

            # Normalize paths for comparison (handle case-insensitive filesystems)
            resolved_file_str = str(resolved_file)
            resolved_frontend_str = str(resolved_frontend)

            # On case-insensitive filesystems (macOS), compare case-insensitively
            # On case-sensitive filesystems, compare case-sensitively
            if os.name == "nt" or sys.platform == "darwin":  # Windows or macOS
                file_in_dir = resolved_file_str.lower().startswith(resolved_frontend_str.lower())
            else:
                file_in_dir = resolved_file_str.startswith(resolved_frontend_str)

            if not file_in_dir:
                from flask import abort

                print(f"[ERROR] Security check failed for path '{path}':")
                print(f"  Resolved file: {resolved_file_str}")
                print(f"  Resolved frontend: {resolved_frontend_str}")
                abort(403)
        except (ValueError, OSError) as e:
            # Path resolution failed - log but don't necessarily abort
            # This might be a legitimate file that just can't be resolved
            print(f"Path resolution warning for {path}: {e}")
            # Continue to try serving the file anyway

        if file_path.exists() and file_path.is_file():
            print(f"[DEBUG] Successfully serving file: {path}")
            return send_from_directory(str(FRONTEND_DIR), path)
        else:
            from flask import abort

            print(f"[ERROR] File not found: {path} (exists: {file_path.exists()}, is_file: {file_path.is_file() if file_path.exists() else 'N/A'})")
            abort(404)
    except PermissionError as e:
        from flask import abort

        print(f"Permission error serving {path}: {e}")
        abort(403)
    except Exception as e:
        print(f"Error serving static file {path}: {e}")
        import traceback

        traceback.print_exc()
        from flask import abort

        abort(404)


if __name__ == "__main__":
    print("=" * 60)
    print("Starting Flight Test Playback Server...")
    print("=" * 60)
    print(f"Data file: {DATA_FILE} ({'EXISTS' if DATA_FILE.exists() else 'NOT FOUND'})")

    if YOUTUBE_VIDEO_ID:
        print(f"✓ YOUTUBE VIDEO MODE - Video ID: {YOUTUBE_VIDEO_ID}")
        print(f"  Start offset: {YOUTUBE_START_OFFSET} seconds")
        print(f"  Video URL: https://www.youtube.com/watch?v={YOUTUBE_VIDEO_ID}")
    else:
        print("⚠️  WARNING: YOUTUBE_VIDEO_ID not set. Video playback will not work.")
    print("=" * 60)
    print()

    # Use environment variables for production, defaults for local development
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "True").lower() == "true"
    socketio.run(app, host=host, port=port, debug=debug)
