# Deployment Guide - Flight Test Playback Web Display

This guide will help you deploy the webdisplay application to a hosting service.

## Prerequisites

Before deploying, ensure you have:

1. **Data File**: `merged_data.csv` must be in the `webdisplay/` directory
2. **YouTube Video**: A public or unlisted YouTube video with the video ID
3. **GitHub Repository**: Your code pushed to GitHub (recommended for most hosting services)

## Quick Deployment Options

### Option 1: Render.com (Recommended - Free Tier Available)

**Pros:**

- Free tier available (with limitations)
- Easy setup via GitHub
- Automatic HTTPS
- Already configured (render.yaml exists)

**Cons:**

- Free tier: Service sleeps after 15 min inactivity
- First request after sleep takes ~30 seconds

#### Steps

1. **Push to GitHub**

   ```bash
   cd "/Users/joelmiller/Desktop/Flight Test 1 - SR22"
   git init  # if not already a git repo
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up (free account works)

3. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

4. **Configure Service**
   - **Name**: `flight-test-display` (or your preferred name)
   - **Root Directory**: `webdisplay` ⚠️ **IMPORTANT**
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 1 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker --bind 0.0.0.0:$PORT --timeout 120 backend.app:app`
   - **Python Version**: `3.11.0` (from runtime.txt)

   ⚠️ **Note**: If using `render.yaml`, the start command is already configured. Otherwise, use the gunicorn command above.

5. **Set Environment Variables** (in Render dashboard):

   ```
   HOST=0.0.0.0
   YOUTUBE_VIDEO_ID=your_video_id_here
   YOUTUBE_START_OFFSET=0.0
   DEBUG=False
   WS_URL=https://your-service-name.onrender.com
   ```

   ⚠️ **Important Notes**:
   - `PORT` is automatically provided by Render - do NOT set it manually
   - Set `WS_URL` AFTER first deployment with your actual Render URL (e.g., `https://flight-test-display.onrender.com`)
   - The `render.yaml` file already configures most settings, but you still need to set `YOUTUBE_VIDEO_ID` and `WS_URL` manually

6. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete (~5-10 minutes)
   - Copy your service URL (e.g., `https://flight-test-display.onrender.com`)

7. **Update WS_URL** (if needed)
   - After first deployment, update the `WS_URL` environment variable with your actual URL
   - Redeploy if necessary

8. **Access Your App**
   - Visit your Render URL
   - The app should be live!

---

### Option 2: Railway.app

**Pros:**

- Easy deployment
- Good free tier
- Automatic HTTPS

**Steps:**

1. **Install Railway CLI**

   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Initialize**

   ```bash
   railway login
   cd "/Users/joelmiller/Desktop/Flight Test 1 - SR22/webdisplay"
   railway init
   ```

3. **Set Environment Variables** (via Railway dashboard or CLI)

   ```bash
   railway variables set HOST=0.0.0.0
   railway variables set PORT=$PORT  # Railway provides this automatically
   railway variables set YOUTUBE_VIDEO_ID=your_video_id
   railway variables set YOUTUBE_START_OFFSET=0.0
   railway variables set DEBUG=False
   railway variables set WS_URL=https://your-app.up.railway.app
   ```

4. **Deploy**

   ```bash
   railway up
   ```

---

### Option 3: Heroku

**Pros:**

- Well-established platform
- Good documentation

**Steps:**

1. **Install Heroku CLI**
   - Download from [heroku.com](https://devcenter.heroku.com/articles/heroku-cli)

2. **Login and Create App**

   ```bash
   heroku login
   cd "/Users/joelmiller/Desktop/Flight Test 1 - SR22/webdisplay"
   heroku create your-app-name
   ```

3. **Set Environment Variables**

   ```bash
   heroku config:set HOST=0.0.0.0
   heroku config:set YOUTUBE_VIDEO_ID=your_video_id
   heroku config:set YOUTUBE_START_OFFSET=0.0
   heroku config:set DEBUG=False
   heroku config:set WS_URL=https://your-app-name.herokuapp.com
   ```

4. **Deploy**

   ```bash
   git push heroku main
   ```

---

### Option 4: Your Own Server (VPS)

**Pros:**

- Full control
- No sleep/wake issues
- Can handle high traffic

**Steps:**

1. **Set up Server**
   - Get a VPS (DigitalOcean, AWS EC2, Linode, etc.)
   - Install Python 3.11, pip, and nginx

2. **Clone Repository**

   ```bash
   git clone <your-repo-url>
   cd "Flight Test 1 - SR22/webdisplay"
   ```

3. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   pip install gunicorn gevent gevent-websocket
   ```

4. **Set Environment Variables**
   Create `.env` file or export:

   ```bash
   export HOST=0.0.0.0
   export PORT=5000
   export YOUTUBE_VIDEO_ID=your_video_id
   export YOUTUBE_START_OFFSET=0.0
   export DEBUG=False
   export WS_URL=https://your-domain.com
   ```

5. **Run with Gunicorn** (Production)

   ```bash
   gunicorn -w 4 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
       --bind 0.0.0.0:5000 \
       --timeout 120 \
       backend.app:app
   ```

6. **Set up Nginx** (Reverse Proxy)

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

7. **Set up SSL** (Let's Encrypt)

   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Required Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `HOST` | Server host | No | `0.0.0.0` (for production) |
| `PORT` | Server port | No | `5000` or `10000` (check hosting service) |
| `YOUTUBE_VIDEO_ID` | YouTube video ID | **Yes** | `dQw4w9WgXcQ` |
| `YOUTUBE_START_OFFSET` | Video sync offset (seconds) | No | `0.0` or `2643.0` |
| `DEBUG` | Debug mode | No | `False` (production) |
| `WS_URL` | WebSocket URL | No | Auto-detected, but set explicitly for production |

## File Structure Requirements

The hosting service needs access to:

```
webdisplay/                  # Application directory
├── merged_data.csv          # REQUIRED: Flight data file (in webdisplay/)
├── backend/
├── frontend/
├── requirements.txt
├── start_server.py
└── ...
```

Optional files (can be in project root or webdisplay/):

- `youtube_timestamps.json` - Video sync mapping
- `video_timestamps.json` - Fallback sync mapping

⚠️ **Important**: `merged_data.csv` must be in the `webdisplay/` directory.

## Post-Deployment Checklist

- [ ] Service is running and accessible
- [ ] YouTube video loads correctly
- [ ] WebSocket connection works (check browser console)
- [ ] Flight data loads (check Network tab for `/api/init`)
- [ ] 3D display updates (Godot WebSocket connection)
- [ ] Map displays flight path
- [ ] Charts render correctly

## Troubleshooting

### Service Won't Start

- Check build logs for Python/dependency errors
- Verify `requirements.txt` is in `webdisplay/` directory
- Ensure `start_server.py` is executable

### WebSocket Not Connecting

- Verify `WS_URL` environment variable matches your actual URL (with `https://`)
- Check browser console for connection errors
- Ensure CORS is enabled (already configured in `app.py`)

### YouTube Video Not Loading

- Verify `YOUTUBE_VIDEO_ID` is set correctly
- Ensure video is public or unlisted (not private)
- Check browser console for YouTube API errors

### Data Not Loading

- Verify `merged_data.csv` exists in `webdisplay/` directory
- Check server logs for file path errors
- Verify file permissions

### 3D Display Not Updating

- Check WebSocket connection in browser console
- Verify `frontend/godot/Display.html` has WebSocket bridge script
- Check that `godot_data` events are being received

## Testing Locally Before Deployment

Before deploying, test locally:

```bash
cd "/Users/joelmiller/Desktop/Flight Test 1 - SR22/webdisplay"

# Create .env file
cat > .env << EOF
YOUTUBE_VIDEO_ID=your_video_id_here
YOUTUBE_START_OFFSET=0.0
HOST=127.0.0.1
PORT=5000
DEBUG=True
WS_URL=http://127.0.0.1:5000
EOF

# Install dependencies
pip install -r requirements.txt

# Run server
python start_server.py

# Open browser to http://localhost:5000
```

## Need Help?

- Check the main `README.md` for detailed feature documentation
- Review server logs for error messages
- Check browser console (F12) for frontend errors
- Verify all environment variables are set correctly
