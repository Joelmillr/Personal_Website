# Performance Optimization Guide

## CPU vs Better Solutions

### Will More CPU Help?

**Short answer: Somewhat, but not much.**

**Why CPU helps minimally:**
- Node.js is **single-threaded** for CPU work
- CSV parsing is **CPU-bound** but runs on one thread
- More CPU cores won't help (can't parallelize single-threaded work)
- Faster CPU clock speed helps, but gains are limited (maybe 20-30% faster)

**Render.com CPU tiers:**
- **Free tier**: Limited CPU (shared)
- **Starter plan**: More CPU, but still single-threaded bottleneck
- **Professional plan**: Even more CPU, but same limitation

### Better Solutions (Recommended)

#### 1. **Pre-process CSV → JSON** ⭐ RECOMMENDED

**Speed improvement: 10-50x faster**

Pre-process the CSV once into JSON format. Loading JSON is much faster than parsing CSV.

**How to use:**
```bash
# Pre-process CSV (run once after CSV changes)
npm run preprocess

# This creates: webdisplay/merged_data.json

# Set environment variable to use preprocessed data
USE_PREPROCESSED_DATA=true
```

**Benefits:**
- ✅ 10-50x faster loading (JSON.parse is much faster than CSV parsing)
- ✅ Same data format
- ✅ No code changes needed
- ✅ Works on any CPU tier

**Trade-offs:**
- JSON file is larger (~100MB vs 74MB CSV)
- Need to re-run preprocessing when CSV changes

#### 2. **Lazy Loading** (Future optimization)

Only load data when needed, not all at once.

#### 3. **Database** (Best for production)

Store data in PostgreSQL or SQLite for:
- Fast queries
- Indexed lookups
- Better memory management

## Performance Comparison

| Method | Load Time (74MB CSV) | CPU Usage | Memory |
|--------|---------------------|-----------|--------|
| CSV parsing (current) | 60-90 seconds | High (single core) | ~200MB |
| Preprocessed JSON | 2-5 seconds | Low | ~200MB |
| Database | <1 second | Low | ~50MB |

## Recommendations

### For Development:
- Use preprocessed JSON (`USE_PREPROCESSED_DATA=true`)
- Run `npm run preprocess` after CSV changes

### For Production:
1. **Short term**: Use preprocessed JSON
2. **Long term**: Migrate to database (PostgreSQL/SQLite)

### CPU Upgrade:
- **Only if** you can't use preprocessed data
- **Only helps** 20-30% faster
- **Not worth it** compared to preprocessing (10-50x faster)

## Quick Start

```bash
# 1. Pre-process CSV
npm run preprocess

# 2. Set environment variable
export USE_PREPROCESSED_DATA=true

# 3. Deploy (or run locally)
npm start
```

The preprocessed JSON will be loaded instead of parsing CSV, making initialization 10-50x faster!

