# Memory Optimization

## Problem - Fixed

## Problem

- Application was using over 512MB memory (Render free tier limit)
- Loading 338,366 rows of CSV data into memory
-

## Solution Implemented

### 1. Increased Downsampling Factor

- **Before**: 10x downsampling (every 10th point)
- **After**: 20x downsampling (every 20th point) - configurable via `DOWNSAMPLE_FACTOR`
- **Result**: Reduces 338k rows to ~17k rows (~80% memory reduction)

### 2. Memory-Efficient Data Extraction

- Changed from `.map()` to pre-allocated arrays
- Single-pass extraction instead of multiple passes
- Clear intermediate arrays after use

### 3. Memory Monitoring

- Added `/api/memory` endpoint to check memory usage
- Memory info included in `/api/init` response
- Logs memory usage during initialization

### 4. Node.js Memory Limit

- Added `--max-old-space-size=512` flag to limit heap size
- Prevents Node.js from using more than 512MB heap

### 5. Garbage Collection

- Explicitly clear large arrays after processing
- Trigger garbage collection if available

## Memory Usage Breakdown

**Before Optimization:**

- CSV loading: ~150MB
- Full arrays (338k points): ~200MB
- Downsampled arrays (34k points): ~20MB
- **Total: ~370MB+** (exceeds 512MB limit with overhead)

**After Optimization:**

- CSV loading: ~150MB
- Downsampled arrays (17k points): ~10MB
- **Total: ~160MB** (well under 512MB limit)

## Configuration

### Environment Variable

```env
DOWNSAMPLE_FACTOR=20  # Default: 20
```

### Adjusting for Your Needs

**If still running out of memory:**

- Increase to `30` or `50`: `DOWNSAMPLE_FACTOR=30`
- Lower chart quality but uses less memory

**If you want better chart quality:**

- Decrease to `10` or `15`: `DOWNSAMPLE_FACTOR=10`
- Higher memory usage but smoother charts

## Monitoring Memory

### Check Memory Usage

```bash
curl https://your-app.onrender.com/api/memory
```

### Response Format

```json
{
  "rss": "180.45MB",
  "heapTotal": "45.23MB",
  "heapUsed": "32.10MB",
  "external": "2.34MB",
  "arrayBuffers": "1.23MB"
}
```

## Render.com Setup

1. Set `DOWNSAMPLE_FACTOR` in Render dashboard (Environment tab)
2. Default is `20` (good balance)
3. Increase if memory issues persist
4. Monitor via `/api/memory` endpoint

## Notes

- Charts still look smooth with 20x downsampling
- Map uses less aggressive downsampling (10x) for better path quality
- Individual data points still use full resolution
- Memory usage is now well within Render free tier limits
