# Supabase Setup Guide

This guide will help you set up Supabase for your flight test data.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Click "New Project"
4. Fill in:
   - **Name**: `flight-test-data` (or your choice)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait for project to be created (~2 minutes)

## Step 2: Get Your Credentials

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (this is your `SUPABASE_URL`)
   - **anon public** key (this is your `SUPABASE_KEY`)

## Step 3: Create Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `webdisplay/supabase/schema.sql`
4. Click "Run" (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 4: Import CSV Data

1. Install dependencies (if not already installed):

   ```bash
   npm install
   ```

2. Set environment variables:

   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_KEY="your-anon-key-here"
   ```

   Or create a `.env` file in the project root:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key-here
   ```

3. Run the import script:

   ```bash
   node webdisplay/supabase/import-csv.js
   ```

   This will:
   - Read your CSV file
   - Process all records
   - Import them into Supabase
   - Show progress as it imports

   **Note**: This may take 5-10 minutes for a 71MB CSV file.

## Step 5: Configure Your Server

Add these environment variables to your Render deployment:

1. Go to your Render dashboard
2. Select your service
3. Go to **Environment** tab
4. Add:
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_KEY` = Your Supabase anon key
5. Save and redeploy

## Step 6: Verify It Works

1. After redeploying, check your server logs
2. You should see: `[WEBDISPLAY] ✓ Supabase configured - will use database instead of CSV`
3. Visit `/webdisplay` - it should load much faster now!

## Troubleshooting

### Import fails with "permission denied"

- Make sure you're using the **anon key** (not service key) for the import script
- Or temporarily use the **service_role** key for import (more permissive)

### Import is slow

- This is normal for large CSV files
- The import processes data in batches of 1000 records
- Be patient - it will complete!

### Server still uses CSV

- Check that `SUPABASE_URL` and `SUPABASE_KEY` are set correctly
- Check server logs for Supabase connection errors
- Make sure the import completed successfully

### Database queries are slow

- Make sure indexes were created (check schema.sql)
- Supabase free tier has some limitations, but should be fine for read-heavy workloads

## Benefits of Using Supabase

✅ **No memory issues** - Data is queried on-demand, not loaded into memory  
✅ **Faster startup** - Server starts immediately  
✅ **Scalable** - Can handle much larger datasets  
✅ **Free tier** - 500MB database, 2GB bandwidth/month  
✅ **Fast queries** - Indexed database queries are much faster than CSV parsing  

## Next Steps

Once Supabase is working:

- Remove the CSV file from your repository (optional, saves space)
- Consider adding more indexes if you add new query patterns
- Monitor your Supabase usage in the dashboard
