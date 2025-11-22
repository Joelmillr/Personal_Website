#!/usr/bin/env python3
"""
Verification script to check if all required files are present for hosting.
Run this before deploying to ensure everything is ready.
"""
import sys
from pathlib import Path

def check_file(path, required=True, description=""):
    """Check if a file exists"""
    exists = Path(path).exists()
    status = "✓" if exists else ("✗" if required else "⚠")
    req_text = "REQUIRED" if required else "OPTIONAL"
    desc_text = f" - {description}" if description else ""
    print(f"{status} {path:<50} [{req_text}]{desc_text}")
    return exists

def main():
    """Run all checks"""
    print("=" * 70)
    print("Flight Test Playback Web Display - Setup Verification")
    print("=" * 70)
    print()
    
    all_good = True
    
    # Required files
    print("Required Files:")
    print("-" * 70)
    all_good &= check_file("merged_data.csv", required=True, description="Flight data")
    all_good &= check_file("requirements.txt", required=True, description="Python dependencies")
    all_good &= check_file("start_server.py", required=True, description="Server startup script")
    all_good &= check_file("backend/app.py", required=True, description="Flask backend")
    all_good &= check_file("backend/data_processor.py", required=True, description="Data processor")
    all_good &= check_file("backend/video_timestamp_mapper.py", required=True, description="Video mapper")
    all_good &= check_file("frontend/index.html", required=True, description="Main web page")
    all_good &= check_file("frontend/css/styles.css", required=True, description="Stylesheet")
    all_good &= check_file("frontend/godot/Display.html", required=True, description="Godot display")
    print()
    
    # Optional files
    print("Optional Files (Recommended):")
    print("-" * 70)
    check_file("youtube_timestamps.json", required=False, description="YouTube sync mapping")
    check_file("video_timestamps.json", required=False, description="Fallback sync mapping")
    check_file(".env", required=False, description="Environment variables (create from env.example)")
    print()
    
    # Configuration files
    print("Configuration Files:")
    print("-" * 70)
    check_file("Procfile", required=False, description="Heroku/Render config")
    check_file("render.yaml", required=False, description="Render.com config")
    check_file("runtime.txt", required=False, description="Python version")
    check_file("env.example", required=False, description="Environment template")
    print()
    
    # Check Python packages
    print("Python Dependencies:")
    print("-" * 70)
    # Map package names to import names (some packages have different import names)
    packages = {
        "flask": "flask",
        "flask-cors": "flask_cors",
        "flask-socketio": "flask_socketio",
        "pandas": "pandas",
        "scipy": "scipy",
        "python-socketio": "socketio",  # python-socketio imports as socketio
        "python-dotenv": "dotenv"
    }
    for pkg_name, import_name in packages.items():
        try:
            __import__(import_name)
            print(f"✓ {pkg_name:<50} [INSTALLED]")
        except ImportError:
            print(f"✗ {pkg_name:<50} [MISSING] - Install with: pip install {pkg_name}")
            all_good = False
    print()
    
    # Summary
    print("=" * 70)
    if all_good:
        print("✓ All required files and packages are present!")
        print()
        print("Next steps:")
        print("1. Create .env file: cp env.example .env")
        print("2. Edit .env and set YOUTUBE_VIDEO_ID")
        print("3. Start server: python start_server.py")
        print("4. Open browser: http://localhost:5000")
        return 0
    else:
        print("✗ Some required files or packages are missing!")
        print("  Please install missing dependencies: pip install -r requirements.txt")
        return 1

if __name__ == "__main__":
    sys.exit(main())

