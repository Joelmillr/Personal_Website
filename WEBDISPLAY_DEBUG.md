# Webdisplay Debugging Guide

## Issue: `/webdisplay` returns 404

If `https://joelandrewmiller.com/webdisplay` returns "not found", follow these steps:

## 1. Check Render Logs

In your Render dashboard, go to your service → **Logs** tab and look for:

- `[WEBDISPLAY] Initializing webdisplay backend...` - Should appear on startup
- `✓ Webdisplay backend integrated successfully` - Should appear if successful
- `❌ ERROR: Webdisplay backend failed to load:` - Will show the error if it fails

## 2. Common Issues

### Issue: Missing `merged_data.csv`
**Symptoms:** Error about file not found
**Solution:** Ensure `webdisplay/merged_data.csv` exists in your repository

### Issue: Missing Dependencies
**Symptoms:** `Cannot find module` errors
**Solution:** All dependencies should be in `package.json`. Verify:
- `csv-parse`
- `gl-matrix`
- `express`
- `socket.io`
- `cors`
- `dotenv`

### Issue: Path Resolution
**Symptoms:** File path errors in logs
**Solution:** The webdisplay backend uses relative paths. Make sure the file structure is:
```
Personal_Website/
├── server.js
├── package.json
└── webdisplay/
    ├── backend/
    │   ├── webdisplayServer.js
    │   ├── dataProcessor.js
    │   └── videoTimestampMapper.js
    ├── frontend/
    │   └── index.html
    └── merged_data.csv
```

## 3. Testing Locally

Before deploying, test locally:

```bash
# Install dependencies
npm install

# Set environment variables
export WS_URL=http://localhost:3000
export YOUTUBE_VIDEO_ID=your_video_id

# Start server
npm start

# Test endpoints
curl http://localhost:3000/webdisplay
curl http://localhost:3000/api/init
```

## 4. Render-Specific Checks

1. **Root Directory:** Should be blank (repository root)
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. **Environment Variables:**
   - `WS_URL` - Your Render URL (e.g., `https://joelandrewmiller.com`)
   - `YOUTUBE_VIDEO_ID` - Your YouTube video ID
   - `YOUTUBE_START_OFFSET` - `0.0`

## 5. Verify Files Are Deployed

Check that these files exist in your Render deployment:
- `webdisplay/backend/webdisplayServer.js`
- `webdisplay/backend/dataProcessor.js`
- `webdisplay/backend/videoTimestampMapper.js`
- `webdisplay/frontend/index.html`
- `webdisplay/merged_data.csv`

## 6. Check Server Response

If the backend loads but `/webdisplay` still doesn't work:

1. Check if `/api/init` works: `https://joelandrewmiller.com/api/init`
2. Check server logs for route matching
3. Verify the route is mounted: Look for `✓ Webdisplay routes mounted at /webdisplay` in logs

## Recent Changes Made

1. ✅ Added better error handling in `server.js`
2. ✅ Added detailed logging in `webdisplayServer.js`
3. ✅ Added fallback error page for `/webdisplay` if backend fails
4. ✅ Added path existence checks and logging

## Next Steps

1. **Redeploy** your service on Render
2. **Check logs** immediately after deployment
3. **Test** `/webdisplay` endpoint
4. **Share logs** if issue persists

