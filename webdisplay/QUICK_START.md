# Quick Start - Deploy to Render.com

## Step-by-Step Instructions

### 1. Prepare Your Code

```bash
cd "/Users/joelmiller/Desktop/Flight Test 1 - SR22/webdisplay"

# Make sure merged_data.csv exists in webdisplay directory
ls merged_data.csv

# If you haven't initialized git yet:
git init
git add .
git commit -m "Initial commit"
```

### 2. Push to GitHub

```bash
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. Deploy to Render.com

1. **Go to [render.com](https://render.com)** and sign up/login

2. **Click "New +" → "Web Service"**

3. **Connect GitHub** and select your repository

4. **Configure the service:**
   - **Name**: `flight-test-display`
   - **Root Directory**: `webdisplay` ⚠️ **CRITICAL - Must be exactly "webdisplay"**
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python start_server.py`

5. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   HOST = 0.0.0.0
   PORT = 10000
   YOUTUBE_VIDEO_ID = YOUR_VIDEO_ID_HERE
   YOUTUBE_START_OFFSET = 0.0
   DEBUG = False
   ```

6. **Click "Create Web Service"**

7. **Wait for deployment** (~5-10 minutes)

8. **After deployment completes:**
   - Copy your service URL (e.g., `https://flight-test-display.onrender.com`)
   - Go to "Environment" tab
   - Add: `WS_URL = https://flight-test-display.onrender.com` (use YOUR actual URL)
   - Save changes (will auto-redeploy)

### 4. Test Your Deployment

- Visit your Render URL
- Check browser console (F12) for any errors
- Verify YouTube video loads
- Test playback controls

## Common Issues

**Build fails:**
- Check that `requirements.txt` is in `webdisplay/` directory
- Verify Python version matches `runtime.txt` (3.11.0)

**Service won't start:**
- Check logs in Render dashboard
- Verify `merged_data.csv` exists in `webdisplay/` directory
- Ensure all environment variables are set

**WebSocket not connecting:**
- Make sure `WS_URL` is set to your actual Render URL (with `https://`)
- Check browser console for connection errors

**YouTube video not loading:**
- Verify `YOUTUBE_VIDEO_ID` is correct
- Ensure video is public or unlisted (not private)

## Next Steps

- See `DEPLOYMENT_GUIDE.md` for other hosting options
- See `README.md` for feature documentation

