# How to Check Logs on Render

## If You Don't See Any Logs

### Step 1: Verify Service is Running

1. Go to your Render dashboard: <https://dashboard.render.com>
2. Click on your service (e.g., "personal-website")
3. Check the **Status** - it should say "Live" (green)
4. If it says "Failed" or "Stopped", click on it to see the error

### Step 2: Access Logs

1. In your service page, click on the **"Logs"** tab at the top
2. You should see a live stream of logs
3. If logs are empty, try:
   - Clicking "Refresh" or reloading the page
   - Checking if the service is actually running
   - Looking at the "Events" tab for deployment errors

### Step 3: Test Endpoints

After deployment, test these endpoints to generate logs:

1. **Health Check:**

   ```
   https://joelandrewmiller.com/health
   ```

   Should return: `{"status":"OK","timestamp":"...","webdisplayAvailable":true/false}`

2. **Test Endpoint:**

   ```
   https://joelandrewmiller.com/test
   ```

   Should return server status information

3. **Webdisplay:**

   ```
   https://joelandrewmiller.com/webdisplay
   ```

   Should show the webdisplay page or an error message

### Step 4: What Logs Should You See?

After deploying with the latest changes, you should see:

```
========================================
SERVER STARTING...
========================================
Timestamp: [timestamp]
Node version: [version]
Platform: [platform]
Express loaded
Port configured: [port]
========================================
LOADING WEBDISPLAY BACKEND...
========================================
Attempting to load webdisplay backend...
[WEBDISPLAY] Initializing webdisplay backend...
[WEBDISPLAY] Paths configured:
  BASE_DIR: [path]
  WEBDISPLAY_DIR: [path]
  ...
✓ Webdisplay routes mounted at /webdisplay
✓ Webdisplay backend integrated successfully
========================================
ATTEMPTING TO START SERVER...
========================================
✓ SERVER STARTED SUCCESSFULLY
========================================
```

### Step 5: If Still No Logs

1. **Check Build Logs:**
   - Go to your service → **Events** tab
   - Look for build errors
   - Check if `npm install` completed successfully

2. **Check Environment Variables:**
   - Go to **Environment** tab
   - Verify all required variables are set
   - Make sure `PORT` is NOT set manually (Render provides it)

3. **Manual Deploy:**
   - Go to **Manual Deploy** tab
   - Click "Deploy latest commit"
   - Watch the build logs in real-time

4. **Check Service Configuration:**
   - **Root Directory:** Should be blank (not `webdisplay`)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### Step 6: Common Issues

**Issue: Service keeps restarting**

- Check logs for crash errors
- Look for missing dependencies
- Verify file paths are correct

**Issue: Build succeeds but service doesn't start**

- Check start command is correct
- Verify `package.json` has `"start": "node server.js"`
- Check if port is being used

**Issue: Logs show errors but service appears "Live"**

- Service might be crashing and restarting
- Check for uncaught exceptions
- Look for memory issues

## Quick Debug Commands

Test these URLs to generate logs:

```bash
# Health check (should always work)
curl https://joelandrewmiller.com/health

# Test endpoint
curl https://joelandrewmiller.com/test

# Webdisplay (might fail if backend not loaded)
curl https://joelandrewmiller.com/webdisplay
```

Each request will generate log entries that you can see in Render's Logs tab.

## Next Steps

1. **Redeploy** with the latest changes
2. **Watch the Logs tab** during deployment
3. **Test the endpoints** above
4. **Share the logs** if you see errors

The enhanced logging should now show exactly what's happening at each step!
