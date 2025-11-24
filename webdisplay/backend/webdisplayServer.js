/**
 * Express backend server for web-based flight test playback.
 * Serves flight data and WebSocket updates with YouTube video integration.
 */

const express = require('express');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const cors = require('cors');
const FlightDataProcessor = require('./dataProcessor');
const VideoTimestampMapper = require('./videoTimestampMapper');
const { createDiagnostics } = require('./diagnostics');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

/**
 * Initialize webdisplay backend
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Object} Express app and Socket.IO instance
 */
function initWebdisplayBackend(httpServer) {
    // Initialize Express app
    const app = express();
    app.use(cors());

    // Initialize Socket.IO
    const io = socketIo(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Paths
    const BASE_DIR = path.join(__dirname, '../..');
    const WEBDISPLAY_DIR = path.join(__dirname, '..');
    const FRONTEND_DIR = path.join(WEBDISPLAY_DIR, 'frontend');
    const DATA_FILE = path.join(WEBDISPLAY_DIR, 'merged_data.csv');
    const FRAMES_DIR = path.join(BASE_DIR, 'camera_frames_flipped');

    // Pre-load frame information
    let framesInfo = [];
    let framesTsNs = [];
    let framesFnames = [];

if (fs.existsSync(FRAMES_DIR)) {
    console.log(`Loading frame information from ${FRAMES_DIR}...`);
    const frames = fs.readdirSync(FRAMES_DIR).filter(f => f.toLowerCase().endsWith('.jpg'));
    
    for (const fname of frames) {
        const parts = fname.split('_');
        if (parts.length >= 4) {
            const tsStr = parts[2];
            try {
                const tsSec = parseFloat(tsStr);
                framesInfo.push([tsSec, fname]);
            } catch (e) {
                // Skip invalid timestamps
            }
        }
    }
    
    framesInfo.sort((a, b) => a[0] - b[0]);
    framesTsNs = framesInfo.map(f => f[0]);
    framesFnames = framesInfo.map(f => f[1]);
    console.log(`Loaded ${framesInfo.length} frames`);
} else {
    console.log(`Warning: Frames directory not found: ${FRAMES_DIR}`);
}

    // YouTube video configuration
    function extractVideoId(videoIdOrUrl) {
    if (!videoIdOrUrl) return "";
    
    videoIdOrUrl = videoIdOrUrl.trim();
    
    // If it's already just a video ID (11 characters, alphanumeric)
    if (videoIdOrUrl.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoIdOrUrl)) {
        return videoIdOrUrl;
    }
    
    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = videoIdOrUrl.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return videoIdOrUrl;
}

    const YOUTUBE_VIDEO_ID_RAW = process.env.YOUTUBE_VIDEO_ID || "";
    const YOUTUBE_VIDEO_ID = extractVideoId(YOUTUBE_VIDEO_ID_RAW);
    const YOUTUBE_START_OFFSET = parseFloat(process.env.YOUTUBE_START_OFFSET || "0.0");

    // Load video timestamp mapping
    let videoTimestampMapper = null;
try {
    // Try YouTube-specific mapping first
    let youtubeMapFile = path.join(WEBDISPLAY_DIR, 'youtube_timestamps.json');
    if (!fs.existsSync(youtubeMapFile)) {
        youtubeMapFile = path.join(BASE_DIR, 'youtube_timestamps.json');
    }
    
    if (fs.existsSync(youtubeMapFile)) {
        videoTimestampMapper = new VideoTimestampMapper(youtubeMapFile);
        if (videoTimestampMapper.isAvailable()) {
            console.log(`✓ Loaded YouTube timestamp mapping: ${videoTimestampMapper.timestamps.length} entries`);
        }
    }
    
    // Fall back to original mapping
    if (!videoTimestampMapper || !videoTimestampMapper.isAvailable()) {
        let timestampMapFile = path.join(WEBDISPLAY_DIR, 'video_timestamps.json');
        if (!fs.existsSync(timestampMapFile)) {
            timestampMapFile = path.join(BASE_DIR, 'video_timestamps.json');
        }
        
        if (fs.existsSync(timestampMapFile)) {
            videoTimestampMapper = new VideoTimestampMapper(timestampMapFile);
            if (videoTimestampMapper.isAvailable()) {
                console.log(`✓ Loaded original timestamp mapping: ${videoTimestampMapper.timestamps.length} entries`);
            }
        }
    }
    
    if (!videoTimestampMapper || !videoTimestampMapper.isAvailable()) {
        console.log("⚠ No timestamp mapping available - using offset calculation");
    }
} catch (error) {
    console.log(`⚠ Could not load video timestamp mapping: ${error}`);
    console.log("  Using simple offset calculation instead");
}

    // Global state
    let processor = null;
    let playbackActive = false;
    let playbackIndex = 0;
    let playbackSpeed = 2.0;
    let playbackInterval = null;

    // Timestamp markers
    const TIMESTAMPS = {
    0: 2643.0,  // Takeoff
    1: 2888.0,  // Test 1 - head movement
    2: 3190.0,  // Test 2 - 90 turn left
    3: 3242.0,  // Test 2 - 90 turn right
    4: 3299.0,  // Test 2 - 360
    5: 3451.0,  // Test 3 - 5 Up
    6: 3466.0,  // Test 3 - 10 Up
    7: 3495.0,  // Test 3 - 15 Up
    8: 3519.0,  // Test 3 - 5 Down
    9: 3539.0,  // Test 3 - 10 Down
    10: 3605.0, // Test 5 - Climb Turn
    11: 3712.0, // Test 5 - Decend Turn
    12: 4823.02, // Landing
};

    // UDP socket for Godot
    const UDP_IP = "127.0.0.1";
    const UDP_PORT = 1991;
    let udpSocket = null;
try {
    udpSocket = dgram.createSocket('udp4');
    console.log(`UDP socket created for Godot on ${UDP_IP}:${UDP_PORT}`);
} catch (error) {
    console.log(`Warning: Could not create UDP socket: ${error}`);
}

    // Binary search helper
    function bisectLeft(arr, value) {
    let left = 0;
    let right = arr.length;
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] < value) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }
    return left;
}

    // Routes

    // Serve static files from frontend directory (only when mounted at /webdisplay)
    // Handle favicon requests explicitly to avoid 500 errors
    app.get('/favicon.ico', (req, res) => {
        const faviconPath = path.join(FRONTEND_DIR, 'favicon.ico');
        if (fs.existsSync(faviconPath)) {
            res.sendFile(faviconPath);
        } else {
            // Return 204 No Content if favicon doesn't exist (browsers will stop requesting)
            res.status(204).end();
        }
    });

    // Skip static file serving when mounted at /api
    app.use((req, res, next) => {
        // Only serve static files if mounted at /webdisplay (not /api)
        if (req.baseUrl !== '/api') {
            try {
                return express.static(FRONTEND_DIR, {
                    setHeaders: (res, filePath) => {
                        res.set('Cache-Control', 'no-cache');
                    }
                })(req, res, next);
            } catch (error) {
                console.error(`[Static] Error serving static file ${req.path}:`, error);
                return res.status(500).send('Internal server error');
            }
        }
        next();
    });

    // Serve diagnostics page
    app.get('/diagnostics', (req, res) => {
        const diagnosticsPath = path.join(FRONTEND_DIR, 'diagnostics.html');
        if (fs.existsSync(diagnosticsPath)) {
            res.sendFile(diagnosticsPath);
        } else {
            res.status(404).send('Diagnostics page not found');
        }
    });

    // Serve main HTML page (only when mounted at /webdisplay)
    app.get('/', (req, res) => {
        // Only serve HTML if mounted at /webdisplay (not /api)
        if (req.baseUrl === '/api') {
            return res.status(404).send('Not found');
        }
        const htmlPath = path.join(FRONTEND_DIR, 'index.html');
        if (fs.existsSync(htmlPath)) {
            let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            // Set WS_URL to current server origin (Socket.IO will use same origin if not set)
            const wsUrl = process.env.WS_URL || `${req.protocol}://${req.get('host')}`;
            const injectScript = `<script>window.WS_URL = "${wsUrl}";</script>`;
            // Add base tag to ensure relative paths resolve correctly
            const baseTag = `<base href="/webdisplay/">`;
            htmlContent = htmlContent.replace('</head>', `${baseTag}\n${injectScript}</head>`);
            res.send(htmlContent);
        } else {
            res.status(404).send('Webdisplay not found');
        }
    });

    // Create API router (routes without /api/ prefix)
    const apiRouter = express.Router();

    // API: Initialize
    apiRouter.get('/init', (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return res.status(500).json({ 
                success: false, 
                error: `Data file not found: ${DATA_FILE}` 
            });
        }
        
        processor = new FlightDataProcessor(DATA_FILE);
        const summary = processor.getSummary();

        let bounds = null;
        let completePath = [];
        let completeAltitudes = [];
        let completeAttitudes = { yaws: [], pitches: [], rolls: [] };
        
        // Memory optimization: Increase downsampling for production (20x reduction)
        // This reduces memory usage from ~500MB to ~100MB for 338k rows
        const DOWNSAMPLE_FACTOR = parseInt(process.env.DOWNSAMPLE_FACTOR || '50');
        
        // Memory monitoring
        const memoryBefore = process.memoryUsage();
        const formatMemory = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

        let takeoffIndex = 0;
        if (processor.getDataCount() > 0) {
            const firstData = processor.getDataAtIndex(0);
            const lastData = processor.getDataAtIndex(processor.getDataCount() - 1);
            
            if (firstData && lastData) {
                console.log(`Data range: ${firstData.timestamp_seconds.toFixed(2)}s to ${lastData.timestamp_seconds.toFixed(2)}s`);
                console.log(`Total duration: ${(lastData.timestamp_seconds - firstData.timestamp_seconds).toFixed(2)}s`);
            }

            // Find takeoff index
            const takeoffTimestamp = TIMESTAMPS[0] || 2643.0;
            takeoffIndex = processor.findIndexForTimestamp(takeoffTimestamp);
            if (takeoffIndex === null) {
                takeoffIndex = 0;
                console.log("Warning: Could not find takeoff index, starting from 0");
            } else {
                console.log(`Takeoff found at index ${takeoffIndex} (timestamp ${takeoffTimestamp}s)`);
                if (YOUTUBE_VIDEO_ID) {
                    console.log(`YouTube offset: ${YOUTUBE_START_OFFSET}s`);
                    console.log(`  → Video time at takeoff: ${(takeoffTimestamp - YOUTUBE_START_OFFSET).toFixed(2)}s`);
                }
            }

            // Extract all path data
            const pathData = processor.getAllPathData();
            let allLats = pathData.lats;
            let allLons = pathData.lons;
            let allAlts = pathData.alts;
            
            const memoryAfterExtract = process.memoryUsage();
            console.log(`[MEMORY] After extraction: RSS=${formatMemory(memoryAfterExtract.rss)}, Heap=${formatMemory(memoryAfterExtract.heapUsed)}`);

            // Extract all attitude data
            const attitudeData = processor.getAllAttitudeData();
            
            // Check if attitude data is available
            if (attitudeData.yaws.length === 0 && attitudeData.pitches.length === 0 && attitudeData.rolls.length === 0) {
                console.error('[INIT] ERROR: getAllAttitudeData() returned empty arrays!');
                console.error('[INIT] This suggests the CSV file may be missing vehicle quaternion columns (x_vehicle, y_vehicle, z_vehicle, w_vehicle)');
            } else {
                // Downsample attitude data for charts (memory-efficient)
                const attitudeLength = Math.min(
                    attitudeData.yaws.length,
                    attitudeData.pitches.length,
                    attitudeData.rolls.length
                );
                
                const downsampledYaws = [];
                const downsampledPitches = [];
                const downsampledRolls = [];
                
                // Downsample during extraction to avoid creating full arrays
                for (let i = 0; i < attitudeLength; i += DOWNSAMPLE_FACTOR) {
                    downsampledYaws.push(attitudeData.yaws[i]);
                    downsampledPitches.push(attitudeData.pitches[i]);
                    downsampledRolls.push(attitudeData.rolls[i]);
                }
                
                // Set attitude data and clear original arrays
                completeAttitudes = {
                    yaws: downsampledYaws,
                    pitches: downsampledPitches,
                    rolls: downsampledRolls
                };
                
                // Clear original attitude arrays to free memory
                attitudeData.yaws = null;
                attitudeData.pitches = null;
                attitudeData.rolls = null;
            }

            // Calculate bounds BEFORE downsampling (need full data for accurate bounds)
            if (allLats.length > 0 && allLons.length > 0) {
                bounds = {
                    min_lat: allLats.reduce((a, b) => Math.min(a, b)),
                    max_lat: allLats.reduce((a, b) => Math.max(a, b)),
                    min_lon: allLons.reduce((a, b) => Math.min(a, b)),
                    max_lon: allLons.reduce((a, b) => Math.max(a, b))
                };
            }

            // Downsample altitudes for charts (memory-efficient)
            const downsampledAlts = [];
            for (let i = 0; i < allAlts.length; i += DOWNSAMPLE_FACTOR) {
                downsampledAlts.push(allAlts[i]);
            }
            completeAltitudes = downsampledAlts;

            // Create downsampled path for map (only what's needed)
            // Map needs full resolution for smooth path, but we can downsample for initial load
            const pathDownsampleFactor = Math.max(1, Math.floor(DOWNSAMPLE_FACTOR / 2)); // Less aggressive for map
            completePath = [];
            for (let i = 0; i < allLats.length; i += pathDownsampleFactor) {
                completePath.push({
                    lat: allLats[i],
                    lon: allLons[i],
                    alt: allAlts[i] || 0,
                    index: i
                });
            }
            
            // Clear original arrays to free memory (after using them)
            allLats = null;
            allLons = null;
            allAlts = null;
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const memoryAfter = process.memoryUsage();
            console.log(`[MEMORY] After processing: RSS=${formatMemory(memoryAfter.rss)}, Heap=${formatMemory(memoryAfter.heapUsed)}`);
            console.log(`[MEMORY] Downsampled: ${completeAltitudes.length} altitudes, ${completeAttitudes.yaws.length} attitudes (factor: ${DOWNSAMPLE_FACTOR})`);
        }

        // Ensure completeAttitudes is always an object with arrays (even if empty)
        if (!completeAttitudes || !completeAttitudes.yaws || completeAttitudes.yaws.length === 0) {
            completeAttitudes = { yaws: [], pitches: [], rolls: [] };
        }

        res.json({
            success: true,
            summary,
            timestamps: TIMESTAMPS,
            bounds,
            complete_path: completePath,
            complete_altitudes: completeAltitudes,
            complete_attitudes: completeAttitudes,
            takeoff_index: takeoffIndex,
            downsample_factor: DOWNSAMPLE_FACTOR, // Inform frontend of downsample factor
            memory_info: {
                rss_mb: formatMemory(process.memoryUsage().rss),
                heap_used_mb: formatMemory(process.memoryUsage().heapUsed),
                heap_total_mb: formatMemory(process.memoryUsage().heapTotal)
            },
            youtube: YOUTUBE_VIDEO_ID ? {
                enabled: true,
                video_id: YOUTUBE_VIDEO_ID,
                start_offset: YOUTUBE_START_OFFSET,
                has_timestamp_map: videoTimestampMapper && videoTimestampMapper.isAvailable(),
                timestamp_map: videoTimestampMapper && videoTimestampMapper.isAvailable()
                    ? videoTimestampMapper.timestamps.slice(0, 2000)
                    : null
            } : null
        });
    } catch (error) {
        console.error('Error in /api/init:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
    
    // Memory monitoring endpoint
    apiRouter.get('/memory', (req, res) => {
        const mem = process.memoryUsage();
        const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
        res.json({
            rss: `${formatMB(mem.rss)}MB`,
            heapTotal: `${formatMB(mem.heapTotal)}MB`,
            heapUsed: `${formatMB(mem.heapUsed)}MB`,
            external: `${formatMB(mem.external)}MB`,
            arrayBuffers: `${formatMB(mem.arrayBuffers)}MB`
        });
    });

    // Diagnostic endpoint - returns structured diagnostic data
    apiRouter.get('/diagnostics', (req, res) => {
        try {
            if (!processor) {
                return res.json({
                    success: false,
                    error: 'Processor not initialized',
                    diagnostics: { processor: { initialized: false } }
                });
            }

            const pathData = processor.getAllPathData();
            const attitudeData = processor.getAllAttitudeData();
            const diagnostics = createDiagnostics(processor, pathData, attitudeData);

            res.json({
                success: true,
                diagnostics
            });
        } catch (error) {
            res.json({
                success: false,
                error: error.message,
                stack: error.stack
            });
        }
    });

    // Mount API router at /api within this app (so routes become /webdisplay/api/init, etc.)
    app.use('/api', apiRouter);

    // API: Get video time from data timestamp
    apiRouter.get('/video-time/:timestamp', (req, res) => {
    const dataTimestamp = parseFloat(req.params.timestamp);
    
    if (videoTimestampMapper && videoTimestampMapper.isAvailable()) {
        const videoTime = videoTimestampMapper.dataToVideoTime(dataTimestamp);
        if (videoTime !== null) {
            return res.json({ success: true, video_time: videoTime });
        }
    }
    
    // Fallback to offset calculation
    const videoTime = Math.max(0, dataTimestamp - YOUTUBE_START_OFFSET);
    res.json({ success: true, video_time: videoTime, using_offset: true });
});

    // API: Get data timestamp from video time
    apiRouter.get('/data-timestamp/:videoTime', (req, res) => {
    const videoTime = parseFloat(req.params.videoTime);
    
    if (videoTimestampMapper && videoTimestampMapper.isAvailable()) {
        const dataTimestamp = videoTimestampMapper.videoToDataTime(videoTime);
        if (dataTimestamp !== null) {
            return res.json({ success: true, data_timestamp: dataTimestamp });
        }
    }
    
    // Fallback to offset calculation
    const dataTimestamp = videoTime + YOUTUBE_START_OFFSET;
    res.json({ success: true, data_timestamp: dataTimestamp, using_offset: true });
});

    // API: Get data for video time
    apiRouter.get('/data-for-video-time/:videoTime', (req, res) => {
    const videoTime = parseFloat(req.params.videoTime);
    getDataForVideoTime(videoTime, res);
});

apiRouter.get('/data-for-video-time', (req, res) => {
    const videoTime = parseFloat(req.query.video_time);
    if (isNaN(videoTime)) {
        return res.status(400).json({ success: false, error: "video_time parameter required" });
    }
    getDataForVideoTime(videoTime, res);
});

    function getDataForVideoTime(videoTime, res) {
    try {
        if (!processor) {
            console.log(`[ERROR] Processor not initialized for video_time=${videoTime}`);
            return res.status(400).json({ success: false, error: "Data not initialized" });
        }

        // Convert video time to flight data timestamp
        let dataTimestamp;
        if (videoTimestampMapper && videoTimestampMapper.isAvailable()) {
            dataTimestamp = videoTimestampMapper.videoToDataTime(videoTime);
            if (dataTimestamp === null) {
                dataTimestamp = videoTime + YOUTUBE_START_OFFSET;
            }
        } else {
            dataTimestamp = videoTime + YOUTUBE_START_OFFSET;
        }

        // Find the index for this timestamp
        const index = processor.findIndexForTimestamp(dataTimestamp);
        if (index === null) {
            return res.json({
                success: false,
                error: `No data found for timestamp ${dataTimestamp.toFixed(2)}s`
            });
        }

        // Get data at this index
        const data = processor.getDataAtIndex(index);
        if (!data) {
            return res.status(404).json({ success: false, error: "Data not found" });
        }

        res.json({
            success: true,
            data,
            index,
            video_time: videoTime,
            data_timestamp: dataTimestamp,
            timestamp_info: {
                video_time: videoTime,
                data_timestamp: dataTimestamp,
                data_index: index,
                timestamp_display: `Video: ${videoTime.toFixed(2)}s | Data: ${dataTimestamp.toFixed(2)}s`
            }
        });
    } catch (error) {
        console.error(`[ERROR] Exception in get_data_for_video_time for video_time=${videoTime}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
}

    // API: Find index for timestamp
    apiRouter.get('/find-index/:timestamp', (req, res) => {
    if (!processor) {
        return res.status(400).json({ error: "Data not initialized" });
    }

    const timestamp = parseFloat(req.params.timestamp);
    const index = processor.findIndexForTimestamp(timestamp);
    
    if (index === null) {
        return res.status(404).json({ error: "Timestamp not found" });
    }

    res.json({ success: true, index, timestamp });
});

    // API: Jump to timestamp
    apiRouter.get('/jump/:timestampId', (req, res) => {
    const timestampId = parseInt(req.params.timestampId);
    
    if (!(timestampId in TIMESTAMPS)) {
        return res.status(400).json({ error: "Invalid timestamp ID" });
    }

    if (!processor) {
        return res.status(400).json({ error: "Data not initialized" });
    }

    const targetTime = TIMESTAMPS[timestampId];
    const index = processor.findIndexForTimestamp(targetTime);

    if (index === null) {
        return res.status(404).json({ error: "Timestamp not found in data" });
    }

    // Update playback index and pause
    playbackIndex = index;
    playbackActive = false;
    stopPlaybackLoop();

    console.log(`Jumped to timestamp ${timestampId} (index ${index}, time ${targetTime}s)`);

    res.json({ success: true, index, timestamp: targetTime });
});

    // API: Get frame
    apiRouter.get('/frame/:timestamp', (req, res) => {
    if (framesInfo.length === 0) {
        return res.status(404).json({ error: "No frames available" });
    }

    const timestamp = parseFloat(req.params.timestamp);
    
    // Find nearest frame using binary search
    let pos = bisectLeft(framesTsNs, timestamp);
    let nearestIdx;
    
    if (pos === 0) {
        nearestIdx = 0;
    } else if (pos >= framesTsNs.length) {
        nearestIdx = framesTsNs.length - 1;
    } else {
        const before = framesTsNs[pos - 1];
        const after = framesTsNs[pos];
        nearestIdx = (timestamp - before) <= (after - timestamp) ? pos - 1 : pos;
    }

    const frameFilename = framesFnames[nearestIdx];
    const framePath = path.join(FRAMES_DIR, frameFilename);

    if (fs.existsSync(framePath)) {
        res.sendFile(framePath);
    } else {
        res.status(404).json({ error: "Frame not found" });
    }
});

    // API: Get data at index
    apiRouter.get('/data/:index', (req, res) => {
    if (!processor) {
        return res.status(400).json({ error: "Data not initialized" });
    }

    const index = parseInt(req.params.index);
    const data = processor.getDataAtIndex(index);
    
    if (!data) {
        return res.status(404).json({ error: "Index out of range" });
    }

    res.json(data);
});

    // API: Get path data
    apiRouter.get('/path/:startIndex/:endIndex', (req, res) => {
    if (!processor) {
        return res.status(400).json({ error: "Data not initialized" });
    }

    let startIndex = parseInt(req.params.startIndex);
    let endIndex = parseInt(req.params.endIndex);

    // Limit range to prevent huge responses
    const maxRange = 10000;
    if (endIndex - startIndex > maxRange) {
        endIndex = startIndex + maxRange;
    }

    const pathData = [];
    const dataCount = processor.getDataCount();
    
    for (let i = startIndex; i <= Math.min(endIndex, dataCount - 1); i++) {
        const data = processor.getDataAtIndex(i);
        if (data) {
            pathData.push({
                index: i,
                lat: data.VLAT,
                lon: data.VLON,
                alt: data.VALT
            });
        }
    }

    res.json({
        success: true,
        path: pathData,
        start_index: startIndex,
        end_index: Math.min(endIndex, dataCount - 1)
    });
});

    // Serve Godot files
    app.get('/godot/:filename', (req, res) => {
    const godotDir = path.join(FRONTEND_DIR, 'godot');
    const filename = req.params.filename;
    
    if (fs.existsSync(godotDir)) {
        if (filename === 'Display.html') {
            const htmlPath = path.join(godotDir, filename);
            let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            const wsUrl = process.env.WS_URL || `${req.protocol}://${req.get('host')}`;
            const injectScript = `<script>window.WS_URL = "${wsUrl}";</script>`;
            htmlContent = htmlContent.replace(
                '<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>',
                `${injectScript}\n\t\t<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>`
            );
            res.send(htmlContent);
        } else {
            const filePath = path.join(godotDir, filename);
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            } else {
                res.status(404).send('File not found');
            }
        }
    } else {
        res.status(404).send('Godot directory not found');
    }
});

    // Catch-all for index.html (fallback for SPA routing if needed)
    // Skip this when mounted at /api
    app.get('*', (req, res) => {
        // Don't handle catch-all when mounted at /api
        if (req.baseUrl === '/api') {
            return res.status(404).send('Not found');
        }
        
        // Don't handle API or godot routes here - they should be handled above
        if (req.path.startsWith('/api/') || req.path.startsWith('/godot/')) {
            return res.status(404).send('Not found');
        }
        
        // For any other route, try to serve index.html (SPA fallback)
        const indexPath = path.join(FRONTEND_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('File not found');
        }
    });

    // Socket.IO handlers
    io.on('connection', (socket) => {
    console.log('Client connected');
    socket.emit('connected', { status: 'ok' });

    socket.on('godot_connect', () => {
        console.log('Godot client connected via WebSocket');
        socket.emit('godot_connected', { status: 'ok' });
    });

    socket.on('godot_data', (data) => {
        // Forward the data to all connected clients (including Godot)
        io.emit('godot_data', data);
        
        // Log periodically
        if (!socket._godotDataCount) socket._godotDataCount = 0;
        socket._godotDataCount++;
        if (socket._godotDataCount <= 5 || socket._godotDataCount % 100 === 0) {
            console.log(`[BACKEND] Forwarded godot_data #${socket._godotDataCount}: VQX=${data.VQX?.toFixed(3) || 0}, VQY=${data.VQY?.toFixed(3) || 0}, VALT=${data.VALT?.toFixed(1) || 0}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('start_playback', (data) => {
        if (!processor) {
            console.log('ERROR: Processor is None - cannot start playback');
            socket.emit('error', { message: 'Data not initialized' });
            return;
        }

        if (data.index !== undefined) {
            playbackIndex = parseInt(data.index);
            console.log(`[PLAYBACK] Starting playback from index ${playbackIndex} at speed ${data.speed || 2.0}x`);
        } else {
            console.log(`[PLAYBACK] Starting playback from current index ${playbackIndex} at speed ${data.speed || 2.0}x`);
        }

        playbackActive = true;
        const requestedSpeed = parseFloat(data.speed) || 2.0;
        playbackSpeed = Math.min(requestedSpeed, 2.0); // Cap at 2x
        
        if (requestedSpeed > 2.0) {
            console.log(`[PLAYBACK] Speed capped to ${playbackSpeed}x (YouTube maximum is 2x)`);
        }

        console.log(`[PLAYBACK] Playback state: active=${playbackActive}, index=${playbackIndex}, speed=${playbackSpeed}x`);

        startPlaybackLoop();
        io.emit('playback_started');
        console.log(`[PLAYBACK] ✓ Emitted playback_started event to clients`);
    });

    socket.on('pause_playback', () => {
        playbackActive = false;
        stopPlaybackLoop();
        io.emit('playback_paused');
    });

    socket.on('set_speed', (data) => {
        const requestedSpeed = parseFloat(data.speed) || 1.0;
        playbackSpeed = Math.min(requestedSpeed, 2.0);
        if (requestedSpeed > 2.0) {
            console.log(`[PLAYBACK] Speed capped to ${playbackSpeed}x (YouTube maximum is 2x)`);
        }
        io.emit('speed_changed', { speed: playbackSpeed });
    });

    socket.on('seek', (data) => {
        playbackIndex = parseInt(data.index) || 0;
        io.emit('seeked', { index: playbackIndex });
    });
});

    // Playback loop
    let lastTimestamp = null;
    let frameCount = 0;

    function startPlaybackLoop() {
    if (playbackInterval) {
        return; // Already running
    }

    console.log(`[PLAYBACK LOOP] ✓ Started (initial index=${playbackIndex}, active=${playbackActive})`);
    console.log(`[PLAYBACK LOOP] Using timestamp-based timing to match variable frame rates`);
    
    frameCount = 0;
    lastTimestamp = null;

    playbackInterval = setInterval(() => {
        if (!playbackActive) {
            return;
        }

        if (!processor) {
            console.log('[PLAYBACK LOOP] ERROR: Processor is None, stopping playback loop');
            stopPlaybackLoop();
            return;
        }

        if (playbackIndex >= processor.getDataCount()) {
            playbackActive = false;
            console.log(`[PLAYBACK LOOP] Finished at index ${playbackIndex} (total: ${processor.getDataCount()})`);
            io.emit('playback_finished');
            stopPlaybackLoop();
            return;
        }

        // Get data at current index
        const data = processor.getDataAtIndex(playbackIndex);
        
        if (data) {
            const currentTimestamp = data.timestamp_seconds;
            let sleepTime = 0.01 / playbackSpeed; // Default

            // Calculate sleep time based on timestamp difference
            if (lastTimestamp !== null && currentTimestamp !== null) {
                const timestampDiff = currentTimestamp - lastTimestamp;

                // Debug: Log first few timestamp differences
                if (frameCount < 10) {
                    console.log(`[PLAYBACK LOOP] Frame ${frameCount}: ts=${currentTimestamp.toFixed(3)}, last_ts=${lastTimestamp.toFixed(3)}, diff=${timestampDiff.toFixed(6)}s`);
                }

                // Handle timestamp jumps
                if (timestampDiff < 0) {
                    console.log(`[PLAYBACK LOOP] Timestamp went backwards: ${timestampDiff.toFixed(6)}s, resetting timing`);
                    lastTimestamp = null;
                    sleepTime = 0.01 / playbackSpeed;
                } else if (timestampDiff > 10.0) {
                    console.log(`[PLAYBACK LOOP] Timestamp jump detected: ${timestampDiff.toFixed(2)}s, resetting timing`);
                    lastTimestamp = null;
                    sleepTime = 0.01 / playbackSpeed;
                } else if (timestampDiff === 0) {
                    console.log(`[PLAYBACK LOOP] Warning: Zero timestamp difference at index ${playbackIndex}`);
                    sleepTime = 0.001 / playbackSpeed;
                } else {
                    // Apply playback speed multiplier
                    sleepTime = timestampDiff / playbackSpeed;
                    // Clamp sleep time
                    sleepTime = Math.max(0.001, Math.min(0.1, sleepTime));
                }
            }

            lastTimestamp = currentTimestamp;

            // Send to all connected clients
            io.emit('frame_update', data);

            // Debug logging
            if (frameCount < 20 || playbackIndex % 1000 === 0) {
                const timestampInfo = currentTimestamp ? `ts=${currentTimestamp.toFixed(2)}` : 'ts=N/A';
                const diffInfo = lastTimestamp !== null && currentTimestamp !== null
                    ? `, diff=${(currentTimestamp - lastTimestamp).toFixed(3)}s, sleep=${sleepTime.toFixed(3)}s`
                    : '';
                console.log(`[PLAYBACK LOOP] ✓ Sent frame_update: index=${playbackIndex}, ${timestampInfo}${diffInfo}`);
            }

            // Send to Godot via UDP
            if (udpSocket) {
                try {
                    const godotData = {
                        VQX: data.VQX || 0,
                        VQY: data.VQY || 0,
                        VQZ: data.VQZ || 0,
                        VQW: data.VQW || 1,
                        HQX: data.HQX || 0,
                        HQY: data.HQY || 0,
                        HQZ: data.HQZ || 0,
                        HQW: data.HQW || 1,
                        GSPEED: data.GSPEED || 0,
                        VALT: data.VALT || 0
                    };
                    const jsonData = JSON.stringify(godotData);
                    udpSocket.send(Buffer.from(jsonData), UDP_PORT, UDP_IP);
                } catch (error) {
                    // Silently fail if UDP send fails
                }
            }

            // Send via WebSocket for Godot HTML5 export
            if (playbackActive) {
                const godotData = {
                    VQX: data.VQX || 0,
                    VQY: data.VQY || 0,
                    VQZ: data.VQZ || 0,
                    VQW: data.VQW || 1,
                    HQX: data.HQX || 0,
                    HQY: data.HQY || 0,
                    HQZ: data.HQZ || 0,
                    HQW: data.HQW || 1,
                    GSPEED: data.GSPEED || 0,
                    VALT: data.VALT || 0
                };
                io.emit('godot_data', godotData);
            }

            frameCount++;
            if (frameCount % 100 === 0) {
                console.log(`Sent ${frameCount} frames, current index: ${playbackIndex}`);
            }

            playbackIndex++;
        } else {
            playbackIndex++;
        }
    }, 10); // Check every 10ms, actual timing controlled by sleepTime calculation
}

    function stopPlaybackLoop() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
            console.log('[PLAYBACK LOOP] Stopped');
        }
    }
    
    // Export API router so it can be mounted at root level too
    return { app, io, apiRouter };

}

// If run directly, create a standalone server (for testing)
if (require.main === module) {
    const http = require('http');
    const port = process.env.PORT || 5001;
    const server = http.createServer();
    const { app, io } = initWebdisplayBackend(server);
    server.on('request', app);
    
    server.listen(port, () => {
        console.log(`Webdisplay server running on port ${port}`);
    });
}

// Export initialization function
module.exports = { initWebdisplayBackend };

