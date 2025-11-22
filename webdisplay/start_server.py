#!/usr/bin/env python3
"""
Simple server startup script for the flight test playback web display.
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir.parent))

if __name__ == "__main__":
    import os

    # Load environment variables from .env file if it exists
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv

            load_dotenv(env_file)
            print(f"✓ Loaded environment variables from {env_file}")
        except ImportError:
            print("⚠ python-dotenv not installed. Install with: pip install python-dotenv")
            print("  Or set environment variables manually.")
        except Exception as e:
            print(f"⚠ Could not load .env file: {e}")

    from backend.app import app, socketio

    # Use environment variables for production, defaults for local development
    # Note: Port 5000 is often used by macOS AirPlay Receiver, so we use 5001 instead
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("DEBUG", "True").lower() == "true"

    print("=" * 60)
    print("Flight Test Playback Web Display")
    print("=" * 60)
    print(f"Starting server on http://{host}:{port}")

    # Check for YouTube video ID
    youtube_id = os.environ.get("YOUTUBE_VIDEO_ID", "")
    if youtube_id:
        print(f"✓ YouTube Video ID: {youtube_id}")
    else:
        print("⚠ YOUTUBE_VIDEO_ID not set - YouTube video will not be available")
        print("  Set it in .env file or as environment variable")

    print("Press Ctrl+C to stop")
    print("=" * 60)

    socketio.run(app, host=host, port=port, debug=debug)
