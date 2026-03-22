/**
 * Main initialization and coordination module
 */
let playbackEngine, mapViewer, chartViewer, attitudeChartViewer, viewer3d, controls;

// Store max altitude for gauge scaling
let gaugeMaxAltitude = 1000; // Default, will be updated from data

// Store max ground speed for gauge scaling
let gaugeMaxSpeed = 100; // Default in m/s, will be updated from data

/**
 * Initialize gauge with altitude data range
 * @param {Array} altitudes - Array of altitude values
 */
function initializeAltitudeGauge(altitudes) {
    if (altitudes && altitudes.length > 0) {
        const max = Math.max(...altitudes);
        // Round up to nearest 100m for cleaner display
        gaugeMaxAltitude = Math.ceil(max / 100) * 100;
        // Ensure minimum of 500m for visibility
        if (gaugeMaxAltitude < 500) gaugeMaxAltitude = 500;
        
        // Note: Scale labels removed from UI, but max altitude is still stored for gauge scaling
    }
}

/**
 * Update the altitude gauge display
 * @param {number} altitude - Current altitude in meters
 */
function updateAltitudeGauge(altitude) {
    const gaugeFill = document.getElementById('altitude-gauge-fill');
    const gaugeMarker = document.getElementById('altitude-gauge-marker');
    
    if (!gaugeFill || !gaugeMarker) return;
    
    const minAltitude = 0;
    const maxAltitude = gaugeMaxAltitude;
    
    // Clamp altitude to valid range
    const clampedAlt = Math.max(minAltitude, Math.min(altitude, maxAltitude));
    
    // Calculate percentage (0-100%)
    const percentage = ((clampedAlt - minAltitude) / (maxAltitude - minAltitude)) * 100;
    
    // Update gauge fill height
    gaugeFill.style.height = `${percentage}%`;
    
    // Update marker position (positioned from bottom)
    gaugeMarker.style.bottom = `${percentage}%`;
}

/**
 * Initialize ground speed gauge with data range
 * @param {Array} speeds - Array of ground speed values in m/s
 */
function initializeGroundSpeedGauge(speeds) {
    if (speeds && speeds.length > 0) {
        const max = Math.max(...speeds);
        // Round up to nearest 10 m/s for cleaner display
        gaugeMaxSpeed = Math.ceil(max / 10) * 10;
        // Ensure minimum of 50 m/s for visibility
        if (gaugeMaxSpeed < 50) gaugeMaxSpeed = 50;

        const gaugeMax = document.getElementById('gauge-max-speed');
        if (gaugeMax) {
            gaugeMax.textContent = gaugeMaxSpeed.toString();
        }
    }
}

/**
 * Update the ground speed gauge display
 * @param {number} speed - Current ground speed in m/s
 */
function updateGroundSpeedGauge(speed) {
    const gaugeFill = document.getElementById('speed-gauge-fill');
    const gaugeMarker = document.getElementById('speed-gauge-marker');
    
    if (!gaugeFill || !gaugeMarker) return;
    
    const minSpeed = 0;
    const maxSpeed = gaugeMaxSpeed;
    
    // Clamp speed to valid range
    const clampedSpeed = Math.max(minSpeed, Math.min(speed, maxSpeed));
    
    // Calculate percentage (0-100%)
    const percentage = ((clampedSpeed - minSpeed) / (maxSpeed - minSpeed)) * 100;
    
    // Update gauge fill width
    gaugeFill.style.width = `${percentage}%`;
    
    // Update marker position (positioned from left)
    gaugeMarker.style.left = `${percentage}%`;
}

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - Notification type: 'info', 'warning', 'error', 'success' (default: 'info')
 * @param {number} duration - Duration in milliseconds before auto-dismissing (default: 5000, 0 = no auto-dismiss)
 */
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.warn('[Notification] Container not found, logging instead:', message);
        return;
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add to container
    container.appendChild(notification);

    // Auto-dismiss after duration (if duration > 0)
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300); // Match fadeOut animation duration
        }, duration);
    }

    // Return notification element for manual dismissal
    return notification;
}

/**
 * Interpolate between two Godot data points using SLERP for quaternions
 * @param {Object} data1 - First data point
 * @param {Object} data2 - Second data point
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {Object} Interpolated data point
 */
function interpolateGodotData(data1, data2, t) {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // SLERP for vehicle quaternion
    const vq1 = { x: data1.VQX, y: data1.VQY, z: data1.VQZ, w: data1.VQW };
    const vq2 = { x: data2.VQX, y: data2.VQY, z: data2.VQZ, w: data2.VQW };
    const vqInterp = slerp(vq1, vq2, t);

    // SLERP for helmet quaternion
    const hq1 = { x: data1.HQX, y: data1.HQY, z: data1.HQZ, w: data1.HQW };
    const hq2 = { x: data2.HQX, y: data2.HQY, z: data2.HQZ, w: data2.HQW };
    const hqInterp = slerp(hq1, hq2, t);

    // Linear interpolation for scalar values
    const gspeed = data1.GSPEED + t * (data2.GSPEED - data1.GSPEED);
    const valt = data1.VALT + t * (data2.VALT - data1.VALT);

    return {
        "VQX": vqInterp.x,
        "VQY": vqInterp.y,
        "VQZ": vqInterp.z,
        "VQW": vqInterp.w,
        "HQX": hqInterp.x,
        "HQY": hqInterp.y,
        "HQZ": hqInterp.z,
        "HQW": hqInterp.w,
        "GSPEED": gspeed,
        "VALT": valt,
    };
}

/**
 * Spherical Linear Interpolation (SLERP) for quaternions
 * @param {Object} q1 - First quaternion {x, y, z, w}
 * @param {Object} q2 - Second quaternion {x, y, z, w}
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {Object} Interpolated quaternion
 */
function slerp(q1, q2, t) {
    // Normalize quaternions
    const len1 = Math.sqrt(q1.x * q1.x + q1.y * q1.y + q1.z * q1.z + q1.w * q1.w);
    const len2 = Math.sqrt(q2.x * q2.x + q2.y * q2.y + q2.z * q2.z + q2.w * q2.w);
    const nq1 = { x: q1.x / len1, y: q1.y / len1, z: q1.z / len1, w: q1.w / len1 };
    const nq2 = { x: q2.x / len2, y: q2.y / len2, z: q2.z / len2, w: q2.w / len2 };

    // Dot product
    let dot = nq1.x * nq2.x + nq1.y * nq2.y + nq1.z * nq2.z + nq1.w * nq2.w;

    // If dot < 0, negate one quaternion to take shorter path
    if (dot < 0) {
        nq2.x = -nq2.x;
        nq2.y = -nq2.y;
        nq2.z = -nq2.z;
        nq2.w = -nq2.w;
        dot = -dot;
    }

    // Clamp dot to [-1, 1] for acos
    dot = Math.max(-1, Math.min(1, dot));

    // If quaternions are very close, use linear interpolation
    if (dot > 0.9995) {
        return {
            x: nq1.x + t * (nq2.x - nq1.x),
            y: nq1.y + t * (nq2.y - nq1.y),
            z: nq1.z + t * (nq2.z - nq1.z),
            w: nq1.w + t * (nq2.w - nq1.w)
        };
    }

    // SLERP
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const w1 = Math.sin((1 - t) * theta) / sinTheta;
    const w2 = Math.sin(t * theta) / sinTheta;

    return {
        x: w1 * nq1.x + w2 * nq2.x,
        y: w1 * nq1.y + w2 * nq2.y,
        z: w1 * nq1.z + w2 * nq2.z,
        w: w1 * nq1.w + w2 * nq2.w
    };
}

/**
 * Convert quaternion to Euler angles (yaw, pitch, roll in degrees)
 * Quaternion format: [x, y, z, w]
 * Returns: {yaw, pitch, roll} in degrees
 */
function quaternionToEuler(qx, qy, qz, qw) {
    // Convert quaternion to Euler angles (ZYX convention - yaw, pitch, roll)
    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (qw * qy - qz * qx);
    let pitch;
    if (Math.abs(sinp) >= 1) {
        // Use 90 degrees if out of range, preserving sign
        pitch = (sinp >= 0 ? 1 : -1) * Math.PI / 2;
    } else {
        pitch = Math.asin(sinp);
    }

    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    // Convert to degrees
    return {
        yaw: yaw * 180 / Math.PI,
        pitch: pitch * 180 / Math.PI,
        roll: roll * 180 / Math.PI
    };
}

// Removed rebuildFlightPath - we'll let the path build naturally like playback.py


document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Flight Test Playback...');

    // Get loading overlay elements
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingStatus = document.getElementById('loading-status');

    // Update status
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Connecting to server...';

    // Update loading status
    if (loadingStatus) {
        loadingStatus.textContent = 'Connecting to server...';
    }

    try {
        // Initialize components
        playbackEngine = new PlaybackEngine();
        mapViewer = new MapViewer('map');
        chartViewer = new ChartViewer('altitude-chart');
        attitudeChartViewer = new AttitudeChartViewer('attitude-chart');
        viewer3d = new Viewer3D('viewer-3d');
        controls = new Controls();

        // CRITICAL: Initialize Godot with default/zero data immediately
        // This prevents "NO DATA AVAILABLE" warnings while backend loads
        const defaultGodotData = {
            "VQX": 0, "VQY": 0, "VQZ": 0, "VQW": 1,
            "HQX": 0, "HQY": 0, "HQZ": 0, "HQW": 1,
            "GSPEED": 0, "VALT": 0
        };
        window._lastGodotDataSent = defaultGodotData;
        window._godotDataCache = [{ videoTime: 0, data: defaultGodotData }];

        // Try to send default data to Godot immediately (if iframe is ready)
        const sendDefaultToGodot = () => {
            try {
                const godotIframe = document.getElementById('godot-iframe');
                if (godotIframe && godotIframe.contentWindow) {
                    if (typeof godotIframe.contentWindow.getGodotData === 'function') {
                        godotIframe.contentWindow.godotLatestData = defaultGodotData;
                        console.log('[MAIN] ✓ Default data sent to Godot immediately');
                    } else {
                        // Retry after a short delay if bridge not ready
                        setTimeout(sendDefaultToGodot, 100);
                    }
                } else {
                    // Retry if iframe not ready
                    setTimeout(sendDefaultToGodot, 100);
                }
            } catch (e) {
                // Cross-origin or other error - will retry later
            }
        };
        sendDefaultToGodot();

        // Initialize backend connection
        if (loadingStatus) {
            loadingStatus.textContent = 'Loading flight data...';
        }

        // Add timeout and better error handling for /api/init
        // Large CSV files (74MB) can take 60-90 seconds to parse
        const initController = new AbortController();
        const initTimeout = setTimeout(() => initController.abort(), 120000); // 120 second timeout for large files

        let response;
        try {
            response = await fetch('/api/init', {
                signal: initController.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            clearTimeout(initTimeout);
        } catch (error) {
            clearTimeout(initTimeout);
            if (error.name === 'AbortError') {
                throw new Error('Initialization timed out after 60 seconds. The server may be processing a large dataset.');
            }
            throw new Error(`Failed to connect to server: ${error.message}`);
        }

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to initialize');
        }

        console.log('[MAIN] Data loaded:', result.summary);
        console.log('[MAIN] Response structure:', {
            hasCompleteAltitudes: !!result.complete_altitudes,
            altitudesLength: result.complete_altitudes?.length || 0,
            hasCompleteAttitudes: !!result.complete_attitudes,
            attitudesYawsLength: result.complete_attitudes?.yaws?.length || 0,
            attitudesPitchesLength: result.complete_attitudes?.pitches?.length || 0,
            attitudesRollsLength: result.complete_attitudes?.rolls?.length || 0,
            downsampleFactor: result.downsample_factor,
            takeoffIndex: result.takeoff_index
        });

        // Log full attitude data structure for debugging
        if (result.complete_attitudes) {
            console.log('[MAIN] complete_attitudes structure:', {
                type: typeof result.complete_attitudes,
                isArray: Array.isArray(result.complete_attitudes),
                keys: Object.keys(result.complete_attitudes),
                yawsType: typeof result.complete_attitudes.yaws,
                yawsIsArray: Array.isArray(result.complete_attitudes.yaws),
                yawsLength: result.complete_attitudes.yaws?.length,
                sampleYaws: result.complete_attitudes.yaws?.slice(0, 5)
            });
        } else {
            console.error('[MAIN] complete_attitudes is null/undefined');
        }

        if (loadingStatus) {
            loadingStatus.textContent = 'Initializing display components...';
        }

        // Get takeoff index early so it's available for YouTube sync setup
        const takeoffIndex = result.takeoff_index || 0;

        // Kick off HMD binary download in parallel with YouTube player init (zero extra wait time)
        const _hmdFetchPromise = fetch('/api/hmd-data').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);

        // Initialize YouTube video player
        if (!result.youtube || !result.youtube.enabled) {
            console.warn('YouTube video not configured. Please set YOUTUBE_VIDEO_ID environment variable.');
            console.warn('Continuing without YouTube video - flight data will still play');
        } else {
            console.log('✓ Using YouTube video mode');
            console.log('  Video ID:', result.youtube.video_id);
            console.log('  Start offset:', result.youtube.start_offset || 0, 'seconds');
            console.log('  Has timestamp map:', result.youtube.has_timestamp_map || false);
            const container = document.getElementById('youtube-player-container');
            if (container) {
                try {
                    youtubePlayer = new YouTubePlayer(
                        'youtube-player-container',
                        result.youtube.video_id,
                        result.youtube.start_offset || 0,
                        result.youtube.has_timestamp_map || false,
                        result.youtube.timestamp_map || null
                    );
                    await youtubePlayer.initialize();
                    // Make YouTube player globally accessible
                    window.youtubePlayer = youtubePlayer;
                    console.log('✓ YouTube player initialized');
                    console.log('  Debug tools: youtubeSyncDebug.status() in console');

                    // ── LOCAL HMD BINARY STORE ──────────────────────────────────────────
                    // The timestamp_map from /api/init is sorted by video_time and covers
                    // the full video range (fixed from previous slice(0,2000) bug).
                    const HMD_FIELDS = 13;
                    const HMD_TAKEOFF_TS = (result.timestamps && result.timestamps[0]) || 2643.0;
                    // _ytTsMap: array of [data_ts, video_time] sorted by video_time
                    const _ytTsMap = result.youtube?.timestamp_map || null;
                    const _ytOffset = result.youtube?.start_offset || 0;
                    let hmdFloats = null;
                    let hmdRowCount = 0;
                    try {
                        const hmdBuf = await _hmdFetchPromise;
                        if (hmdBuf && hmdBuf.byteLength > 4) {
                            hmdRowCount = new DataView(hmdBuf).getUint32(0, true);
                            hmdFloats = new Float32Array(hmdBuf, 4);
                            console.log(`[MAIN] ✓ HMD binary loaded: ${hmdRowCount} rows (${(hmdBuf.byteLength / 1048576).toFixed(1)} MB) — local lookups active`);
                        }
                    } catch (e) {
                        console.warn('[MAIN] HMD binary load error:', e.message);
                    }

                    // Convert video time → data timestamp using the full timestamp_map.
                    // Falls back to offset formula when map is unavailable or out of range.
                    function videoTimeToDataTs(vt) {
                        if (_ytTsMap && _ytTsMap.length >= 2) {
                            // Binary search by video_time (index [1]) — map is sorted by video_time
                            let lo = 0, hi = _ytTsMap.length - 1;
                            while (lo < hi) {
                                const mid = (lo + hi) >> 1;
                                if (_ytTsMap[mid][1] < vt) lo = mid + 1; else hi = mid;
                            }
                            if (lo === 0) return _ytTsMap[0][0];
                            if (lo >= _ytTsMap.length) return _ytTsMap[_ytTsMap.length - 1][0];
                            const bef = _ytTsMap[lo - 1], aft = _ytTsMap[lo];
                            const span = aft[1] - bef[1]; // video_time span
                            return span <= 0 ? bef[0] : bef[0] + ((vt - bef[1]) / span) * (aft[0] - bef[0]);
                        }
                        return vt + _ytOffset;
                    }

                    // O(log n) local lookup with linear interpolation between adjacent rows.
                    function getLocalHmdData(dataTs) {
                        if (!hmdFloats || hmdRowCount === 0) return null;
                        let lo = 0, hi = hmdRowCount - 1;
                        while (lo < hi) {
                            const mid = (lo + hi) >> 1;
                            if (hmdFloats[mid * HMD_FIELDS] < dataTs) lo = mid + 1; else hi = mid;
                        }
                        const r1 = lo, r0 = Math.max(0, lo - 1);
                        const ts0 = hmdFloats[r0 * HMD_FIELDS], ts1 = hmdFloats[r1 * HMD_FIELDS];
                        const t = ts1 === ts0 ? 0 : Math.max(0, Math.min(1, (dataTs - ts0) / (ts1 - ts0)));
                        const f0 = r0 * HMD_FIELDS, f1 = r1 * HMD_FIELDS;
                        const L = (a, b) => a + (b - a) * t;
                        return {
                            timestamp_seconds: dataTs, index: r0,
                            VQX: L(hmdFloats[f0+1], hmdFloats[f1+1]), VQY: L(hmdFloats[f0+2], hmdFloats[f1+2]),
                            VQZ: L(hmdFloats[f0+3], hmdFloats[f1+3]), VQW: L(hmdFloats[f0+4], hmdFloats[f1+4]),
                            HQX: L(hmdFloats[f0+5], hmdFloats[f1+5]), HQY: L(hmdFloats[f0+6], hmdFloats[f1+6]),
                            HQZ: L(hmdFloats[f0+7], hmdFloats[f1+7]), HQW: L(hmdFloats[f0+8], hmdFloats[f1+8]),
                            GSPEED: L(hmdFloats[f0+9], hmdFloats[f1+9]), VALT: L(hmdFloats[f0+10], hmdFloats[f1+10]),
                            VLAT: L(hmdFloats[f0+11], hmdFloats[f1+11]), VLON: L(hmdFloats[f0+12], hmdFloats[f1+12]),
                        };
                    }
                    // ────────────────────────────────────────────────────────────────────

                    // Enable video-driven sync: YouTube video is the master timeline
                    // Data updates are driven by YouTube video time, not by automatic playback loop
                    let lastRequestedVideoTime = -1;
                    let pendingDataRequest = null;
                    let updateCount = 0;

                    // Data cache for smooth interpolation - store multiple points for better interpolation
                    window._godotDataCache = []; // Array of {videoTime, data} objects, sorted by videoTime
                    window._displayDataCache = []; // Array of {videoTime, data} objects for map/chart displays
                    const MAX_CACHE_SIZE = 10; // Keep up to 10 data points for better interpolation coverage

                    // Make lastRequestedVideoTime accessible for jump buttons
                    window.lastRequestedVideoTime = () => lastRequestedVideoTime;
                    window.resetVideoTimeTracking = () => {
                        lastRequestedVideoTime = -1;
                        window._godotDataCache = []; // Clear cache on reset
                        window._displayDataCache = []; // Clear display cache on reset
                        console.log('[MAIN] Reset video time tracking and cache');
                    };

                    // Helper function to add data to cache (maintains sorted order) - make globally accessible
                    window.addToCache = function (videoTime, data) {
                        const cache = window._godotDataCache;
                        cache.push({ videoTime, data });
                        // Sort by videoTime
                        cache.sort((a, b) => a.videoTime - b.videoTime);
                        // Keep only the most recent MAX_CACHE_SIZE points
                        if (cache.length > MAX_CACHE_SIZE) {
                            // Remove oldest points, keep newest
                            cache.splice(0, cache.length - MAX_CACHE_SIZE);
                        }
                    };

                    // Helper function to add full display data to cache
                    function addDisplayDataToCache(videoTime, fullData) {
                        const cache = window._displayDataCache;
                        cache.push({ videoTime, data: fullData });
                        // Sort by videoTime
                        cache.sort((a, b) => a.videoTime - b.videoTime);
                        // Keep only the most recent MAX_CACHE_SIZE points
                        if (cache.length > MAX_CACHE_SIZE) {
                            cache.splice(0, cache.length - MAX_CACHE_SIZE);
                        }
                    }

                    // Helper function to get interpolated display data from cache
                    function getInterpolatedDisplayData(videoTime) {
                        const cache = window._displayDataCache;
                        if (!cache || cache.length === 0) {
                            return null;
                        }

                        // Find the two closest data points for interpolation
                        let beforeIdx = -1;
                        let afterIdx = -1;

                        // Binary search for efficiency
                        let left = 0;
                        let right = cache.length - 1;
                        while (left <= right) {
                            const mid = Math.floor((left + right) / 2);
                            if (cache[mid].videoTime <= videoTime) {
                                beforeIdx = mid;
                                left = mid + 1;
                            } else {
                                afterIdx = mid;
                                right = mid - 1;
                            }
                        }

                        // If we have both before and after points, interpolate
                        if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx !== afterIdx) {
                            const before = cache[beforeIdx];
                            const after = cache[afterIdx];
                            const timeDiff = after.videoTime - before.videoTime;
                            if (timeDiff > 0 && timeDiff < 0.5) { // Allow up to 0.5s for display interpolation
                                const t = (videoTime - before.videoTime) / timeDiff;
                                const clampedT = Math.max(0, Math.min(1, t));

                                // Interpolate all display fields
                                const interpolated = {};
                                const beforeData = before.data;
                                const afterData = after.data;

                                // Interpolate numeric fields
                                for (const key in beforeData) {
                                    if (typeof beforeData[key] === 'number' && typeof afterData[key] === 'number') {
                                        interpolated[key] = beforeData[key] + (afterData[key] - beforeData[key]) * clampedT;
                                    } else {
                                        // Use before value for non-numeric fields
                                        interpolated[key] = beforeData[key];
                                    }
                                }

                                // Preserve index and timestamp info from before (or use weighted average index)
                                interpolated.index = beforeData.index || afterData.index;
                                if (beforeData.timestamp_info || afterData.timestamp_info) {
                                    interpolated.timestamp_info = beforeData.timestamp_info || afterData.timestamp_info;
                                }

                                return interpolated;
                            } else if (timeDiff > 0) {
                                // Points too far apart, use the closer one
                                const beforeDist = Math.abs(videoTime - before.videoTime);
                                const afterDist = Math.abs(videoTime - after.videoTime);
                                return beforeDist < afterDist ? before.data : after.data;
                            }
                        } else if (beforeIdx >= 0) {
                            return cache[beforeIdx].data;
                        } else if (afterIdx >= 0) {
                            return cache[afterIdx].data;
                        }

                        // Fallback: use closest point
                        if (cache.length > 0) {
                            let closest = cache[0];
                            let minDist = Math.abs(cache[0].videoTime - videoTime);
                            for (let i = 1; i < cache.length; i++) {
                                const dist = Math.abs(cache[i].videoTime - videoTime);
                                if (dist < minDist) {
                                    minDist = dist;
                                    closest = cache[i];
                                }
                            }
                            return closest.data;
                        }

                        return null;
                    }

                    // Helper function to get interpolated data from cache
                    function getInterpolatedGodotData(videoTime) {
                        const cache = window._godotDataCache;
                        if (!cache || cache.length === 0) {
                            return null;
                        }

                        // Find the two closest data points for interpolation
                        let beforeIdx = -1;
                        let afterIdx = -1;

                        // Binary search for efficiency (cache is sorted by videoTime)
                        let left = 0;
                        let right = cache.length - 1;
                        while (left <= right) {
                            const mid = Math.floor((left + right) / 2);
                            if (cache[mid].videoTime <= videoTime) {
                                beforeIdx = mid;
                                left = mid + 1;
                            } else {
                                afterIdx = mid;
                                right = mid - 1;
                            }
                        }

                        // If we have both before and after points, interpolate
                        if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx !== afterIdx) {
                            const before = cache[beforeIdx];
                            const after = cache[afterIdx];
                            const timeDiff = after.videoTime - before.videoTime;
                            // Only interpolate if points are close enough (within 0.2 seconds for smooth motion)
                            if (timeDiff > 0 && timeDiff < 0.2) {
                                const t = (videoTime - before.videoTime) / timeDiff;
                                // Clamp t to [0, 1] for safety
                                const clampedT = Math.max(0, Math.min(1, t));
                                return interpolateGodotData(before.data, after.data, clampedT);
                            } else if (timeDiff > 0) {
                                // Points too far apart, use the closer one
                                const beforeDist = Math.abs(videoTime - before.videoTime);
                                const afterDist = Math.abs(videoTime - after.videoTime);
                                return beforeDist < afterDist ? before.data : after.data;
                            }
                        } else if (beforeIdx >= 0) {
                            // Use before point if we're before all cached data
                            return cache[beforeIdx].data;
                        } else if (afterIdx >= 0) {
                            // Use after point if we're after all cached data
                            return cache[afterIdx].data;
                        }

                        // Fallback: use closest point
                        if (cache.length > 0) {
                            let closest = cache[0];
                            let minDist = Math.abs(cache[0].videoTime - videoTime);
                            for (let i = 1; i < cache.length; i++) {
                                const dist = Math.abs(cache[i].videoTime - videoTime);
                                if (dist < minDist) {
                                    minDist = dist;
                                    closest = cache[i];
                                }
                            }
                            return closest.data;
                        }

                        return null;
                    }

                    // Store takeoffIndex in a way that's accessible to the callback
                    const takeoffIndexForCallback = takeoffIndex;

                    youtubePlayer.enableBidirectionalSync(
                        // onPlaybackStateChange: not used in pure video-driven mode
                        (isPlaying) => {
                            // No action needed - video time monitoring handles everything
                        },
                        // onSeek: not used in pure video-driven mode
                        (dataTimestamp) => {
                            // No action needed - video time monitoring will detect the change automatically
                        },
                        // onVideoTimeUpdate: THE ONLY JOB - check video time and fetch corresponding data
                        async (videoTime) => {
                            // Debug: Log first few callbacks to verify they're firing
                            if (!window._videoTimeUpdateCount) window._videoTimeUpdateCount = 0;
                            window._videoTimeUpdateCount++;
                            if (window._videoTimeUpdateCount <= 5 || window._videoTimeUpdateCount % 100 === 0) {
                                console.log(`[MAIN] onVideoTimeUpdate #${window._videoTimeUpdateCount}: videoTime=${videoTime.toFixed(3)}s`);
                            }

                            // Skip if video time is invalid
                            if (isNaN(videoTime) || videoTime < 0) {
                                if (window._videoTimeUpdateCount <= 5) {
                                    console.warn(`[MAIN] Skipping invalid video time: ${videoTime}`);
                                }
                                return;
                            }

                            // For video time 0 or very small, use takeoff data time converted to video time
                            // This ensures we get valid data even when video hasn't started
                            if (videoTime === 0 || videoTime < 0.1) {
                                // Use takeoff timestamp converted to video time
                                // If we have takeoff index, fetch data at that index directly
                                if (typeof takeoffIndexForCallback !== 'undefined' && takeoffIndexForCallback >= 0) {
                                    // Fetch data at takeoff index directly (bypass video time conversion)
                                    try {
                                        const takeoffData = await playbackEngine.fetchDataAtIndex(takeoffIndexForCallback);
                                        if (takeoffData) {
                                            takeoffData.index = takeoffIndexForCallback;
                                            updateDisplaysWithData(takeoffData);

                                            // Also cache and send to Godot
                                            const godotData = {
                                                "VQX": takeoffData.VQX || 0,
                                                "VQY": takeoffData.VQY || 0,
                                                "VQZ": takeoffData.VQZ || 0,
                                                "VQW": takeoffData.VQW || 1,
                                                "HQX": takeoffData.HQX || 0,
                                                "HQY": takeoffData.HQY || 0,
                                                "HQZ": takeoffData.HQZ || 0,
                                                "HQW": takeoffData.HQW || 1,
                                                "GSPEED": takeoffData.GSPEED || 0,
                                                "VALT": takeoffData.VALT || 0,
                                            };
                                            window.addToCache(videoTime, godotData);
                                            window._lastGodotDataSent = godotData;

                                            // Send to Godot
                                            try {
                                                const godotIframe = document.getElementById('godot-iframe');
                                                if (godotIframe && godotIframe.contentWindow) {
                                                    godotIframe.contentWindow.godotLatestData = godotData;
                                                    godotIframe.contentWindow.godotLastDataTime = Date.now();
                                                }
                                            } catch (e) { }
                                            if (playbackEngine.socket && playbackEngine.socket.connected) {
                                                playbackEngine.socket.emit("godot_data", godotData);
                                            }
                                        }
                                    } catch (error) {
                                        console.error('[MAIN] Error fetching takeoff data:', error);
                                    }
                                    return; // Don't continue with normal fetch for video time 0
                                }

                                // Fallback: use small video time offset
                                videoTime = 0.1;
                            }

                            // Debug: Log first few callbacks to verify they're firing
                            if (!window._videoTimeUpdateCount) window._videoTimeUpdateCount = 0;
                            window._videoTimeUpdateCount++;
                            // Only log occasionally to reduce console spam
                            if (window._videoTimeUpdateCount <= 5 || window._videoTimeUpdateCount % 500 === 0) {
                                console.log(`[MAIN] onVideoTimeUpdate #${window._videoTimeUpdateCount}: videoTime=${videoTime.toFixed(3)}s`);
                            }

                            // CRITICAL: Send Godot data at 30 FPS for smooth 3D view (reduced from 60 FPS for better performance)
                            // Use interpolation from cache, with fallback to last known data
                            // Send updates frequently but not excessively to reduce network load
                            const now = Date.now();
                            if (!window._lastGodotSendTime) window._lastGodotSendTime = 0;
                            const timeSinceLastSend = now - window._lastGodotSendTime;
                            const minSendInterval = 33; // 33ms = ~30 FPS (reduced from 60 FPS for better network performance)

                            // Only throttle if we're sending too fast
                            if (timeSinceLastSend < minSendInterval) {
                                return; // Skip this update to prevent excessive sends
                            }

                            let dataToSend = null;

                            // Check cache status first
                            const cache = window._godotDataCache;
                            const cacheSize = cache ? cache.length : 0;

                            // Only try interpolation if we have enough cache points (reduced requirement for faster startup)
                            if (cacheSize >= 1) {
                                const interpolatedData = getInterpolatedGodotData(videoTime);
                                if (interpolatedData) {
                                    dataToSend = interpolatedData;
                                }
                            }

                            // If interpolation failed or cache too small, use fallback
                            if (!dataToSend) {
                                if (cache && cacheSize > 0) {
                                    // Use the most recent data point (last in sorted array)
                                    dataToSend = cache[cache.length - 1].data;
                                } else if (window._lastGodotDataSent) {
                                    // Ultimate fallback: use last sent data
                                    // Always send initial data even if cache is empty (needed for startup)
                                    dataToSend = window._lastGodotDataSent;

                                    // Only skip if cache has been empty for a long time AND we've sent data many times
                                    // Allow initial 200 sends to go through even with empty cache (for startup)
                                    if (window._godotSendCount > 200) {
                                        if (!window._cacheEmptyStartTime) {
                                            window._cacheEmptyStartTime = Date.now();
                                        }
                                        const cacheEmptyDuration = Date.now() - window._cacheEmptyStartTime;
                                        if (cacheEmptyDuration > 2000) {
                                            // Cache has been empty for >2s after many sends - skip sending stale data
                                            // This prevents jerky motion from stale data, but allows initial data through
                                            if (window._godotSendCount % 100 === 0) {
                                                console.warn(`[MAIN] Cache empty for ${cacheEmptyDuration}ms, skipping stale data send`);
                                            }
                                            return;
                                        }
                                    }
                                } else {
                                    // No data at all - can't send anything
                                    // But trigger a fetch to get initial data immediately
                                    if (!pendingDataRequest) {
                                        // Force immediate fetch for initial data - don't wait for interval
                                        window._lastFetchTime = 0;
                                        // Don't return - let the fetch happen below
                                    } else {
                                        // Fetch already in progress - wait for it
                                        return;
                                    }
                                }
                            } else {
                                // Cache has data - reset empty timer
                                window._cacheEmptyStartTime = null;
                            }

                            // ALWAYS send data if we have it - don't skip based on change detection
                            // The interpolation ensures smooth motion even with small changes
                            // Change detection was causing lag by skipping updates
                            if (dataToSend) {
                                window._lastGodotSendTime = now;

                                // Try direct iframe access first (fastest)
                                let sentDirectly = false;
                                try {
                                    const godotIframe = document.getElementById('godot-iframe');
                                    if (godotIframe) {
                                        // Check if iframe is loaded
                                        if (!godotIframe.contentWindow) {
                                            // Iframe not ready yet - use WebSocket
                                            if (playbackEngine.socket && playbackEngine.socket.connected) {
                                                playbackEngine.socket.emit("godot_data", dataToSend);
                                            }
                                            return; // Skip direct access attempt
                                        }

                                        // Check if bridge is ready before sending
                                        if (typeof godotIframe.contentWindow.getGodotData === 'function') {
                                            // Directly set the data in the iframe's window object
                                            godotIframe.contentWindow.godotLatestData = dataToSend;
                                            if (!godotIframe.contentWindow.godotDataReceivedCount) {
                                                godotIframe.contentWindow.godotDataReceivedCount = 0;
                                            }
                                            godotIframe.contentWindow.godotDataReceivedCount++;
                                            godotIframe.contentWindow.godotLastDataTime = Date.now();
                                            sentDirectly = true;

                                            // Debug: Log first few sends
                                            if (window._godotSendCount === undefined) window._godotSendCount = 0;
                                            window._godotSendCount++;
                                            if (window._godotSendCount <= 10 || window._godotSendCount % 100 === 0) {
                                                console.log(`[MAIN] Sent to Godot #${window._godotSendCount}: VQX=${dataToSend.VQX?.toFixed(3)}, cache_size=${window._godotDataCache?.length || 0}, videoTime=${videoTime.toFixed(3)}`);
                                            }
                                        } else {
                                            // Bridge not ready - log warning occasionally
                                            if (!window._bridgeNotReadyCount) window._bridgeNotReadyCount = 0;
                                            window._bridgeNotReadyCount++;
                                            if (window._bridgeNotReadyCount <= 5 || window._bridgeNotReadyCount % 50 === 0) {
                                                console.warn(`[MAIN] Godot bridge not ready (getGodotData not found), using WebSocket only (attempt #${window._bridgeNotReadyCount})`);
                                            }
                                        }
                                    } else {
                                        // Iframe not found - use WebSocket
                                        if (playbackEngine.socket && playbackEngine.socket.connected) {
                                            playbackEngine.socket.emit("godot_data", dataToSend);
                                        }
                                    }
                                } catch (e) {
                                    // Cross-origin restriction - will use WebSocket fallback
                                    if (window._godotSendCount === undefined || window._godotSendCount <= 5) {
                                        console.warn('[MAIN] Direct iframe access failed, using WebSocket:', e.message);
                                    }
                                    // Fallback to WebSocket
                                    if (playbackEngine.socket && playbackEngine.socket.connected) {
                                        playbackEngine.socket.emit("godot_data", dataToSend);
                                    }
                                }

                                // ALWAYS also send via WebSocket as backup (in case direct access doesn't work)
                                // This ensures data gets through even if iframe access fails silently
                                if (playbackEngine.socket && playbackEngine.socket.connected) {
                                    playbackEngine.socket.emit("godot_data", dataToSend);
                                }

                                window._lastGodotDataSent = dataToSend; // Remember for fallback
                            }

                            // LOCAL LOOKUP: O(log n) binary search in the downloaded HMD blob.
                            // No per-frame network request — eliminates Vercel round-trip latency.
                            if (hmdFloats) {
                                const dataTs = videoTimeToDataTs(videoTime);

                                // If before takeoff, seek video forward
                                if (dataTs < HMD_TAKEOFF_TS) {
                                    if (!window._lastTakeoffSeekTime || (Date.now() - window._lastTakeoffSeekTime) > 2000) {
                                        window._lastTakeoffSeekTime = Date.now();
                                        const tvt = videoTimeToDataTs(HMD_TAKEOFF_TS - _ytOffset) || HMD_TAKEOFF_TS;
                                        const takeoffVt = _ytTsMap
                                            ? (() => {
                                                // Find video_time for HMD_TAKEOFF_TS using forward map
                                                let lo = 0, hi = _ytTsMap.length - 1;
                                                while (lo < hi) { const m = (lo + hi) >> 1; if (_ytTsMap[m][0] < HMD_TAKEOFF_TS) lo = m + 1; else hi = m; }
                                                return _ytTsMap[lo][1];
                                              })()
                                            : Math.max(0, HMD_TAKEOFF_TS - _ytOffset);
                                        if (window.youtubePlayer) window.youtubePlayer.player.seekTo(takeoffVt, true);
                                        showNotification(`Flight data begins at takeoff. Video moved to ${takeoffVt.toFixed(1)}s.`, 'info', 5000);
                                        if (window.resetVideoTimeTracking) window.resetVideoTimeTracking();
                                    }
                                    return;
                                }

                                const localData = getLocalHmdData(dataTs);
                                if (localData) {
                                    const godotData = {
                                        VQX: localData.VQX, VQY: localData.VQY, VQZ: localData.VQZ, VQW: localData.VQW,
                                        HQX: localData.HQX, HQY: localData.HQY, HQZ: localData.HQZ, HQW: localData.HQW,
                                        GSPEED: localData.GSPEED, VALT: localData.VALT,
                                    };
                                    window.addToCache(videoTime, godotData);
                                    window._lastGodotDataSent = godotData;

                                    // Send directly to Godot iframe (no socket dependency)
                                    try {
                                        const godotIframe = document.getElementById('godot-iframe');
                                        if (godotIframe && godotIframe.contentWindow) {
                                            godotIframe.contentWindow.godotLatestData = godotData;
                                            if (!godotIframe.contentWindow.godotDataReceivedCount) godotIframe.contentWindow.godotDataReceivedCount = 0;
                                            godotIframe.contentWindow.godotDataReceivedCount++;
                                            godotIframe.contentWindow.godotLastDataTime = Date.now();
                                        }
                                    } catch (e) { /* cross-origin fallback */ }
                                    // Also emit via socket if connected (for any server-side listeners)
                                    if (playbackEngine.socket && playbackEngine.socket.connected) {
                                        playbackEngine.socket.emit('godot_data', godotData);
                                    }

                                    localData.timestamp_info = {
                                        video_time: videoTime, data_timestamp: dataTs, data_index: localData.index,
                                        timestamp_display: `Video: ${videoTime.toFixed(2)}s | Data: ${dataTs.toFixed(2)}s`,
                                    };
                                    addDisplayDataToCache(videoTime, localData);
                                    updateDisplaysWithData(localData);
                                    lastRequestedVideoTime = videoTime;
                                    updateCount++;

                                    if (updateCount <= 10 || updateCount % 500 === 0) {
                                        console.log(`[MAIN] Local HMD #${updateCount}: vt=${videoTime.toFixed(2)}s → dataTs=${dataTs.toFixed(2)}s, VALT=${localData.VALT.toFixed(1)}, VQW=${localData.VQW.toFixed(3)}`);
                                    }
                                }
                            } else {
                                // HMD binary not loaded — fall back to server fetch (handles map/chart updates too)
                                if (!window._lastFetchTime) window._lastFetchTime = 0;
                                const videoTimeChangedForFetch = lastRequestedVideoTime < 0 || Math.abs(videoTime - lastRequestedVideoTime) >= 0.1;
                                const timeSinceLastFetch = now - window._lastFetchTime;
                                if (lastRequestedVideoTime >= 0 && !videoTimeChangedForFetch && timeSinceLastFetch < 100) return;
                                if (pendingDataRequest) return;
                                window._lastFetchTime = now;
                                lastRequestedVideoTime = videoTime;
                                updateCount++;

                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 3000);
                                const fetchPromise = fetch(`/api/data-for-video-time/${videoTime}`, { signal: controller.signal })
                                    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
                                    .then(result => {
                                        if (pendingDataRequest !== fetchPromise) return;
                                        clearTimeout(timeoutId);
                                        pendingDataRequest = null;
                                        if (result.success && result.data) {
                                            const data = result.data;
                                            data.index = result.index;
                                            if (result.timestamp_info) data.timestamp_info = result.timestamp_info;
                                            addDisplayDataToCache(videoTime, data);
                                            const godotData = {
                                                VQX: data.VQX || 0, VQY: data.VQY || 0, VQZ: data.VQZ || 0, VQW: data.VQW || 1,
                                                HQX: data.HQX || 0, HQY: data.HQY || 0, HQZ: data.HQZ || 0, HQW: data.HQW || 1,
                                                GSPEED: data.GSPEED || 0, VALT: data.VALT || 0,
                                            };
                                            window.addToCache(videoTime, godotData);
                                            window._lastGodotDataSent = godotData;
                                            try {
                                                const godotIframe = document.getElementById('godot-iframe');
                                                if (godotIframe && godotIframe.contentWindow) {
                                                    godotIframe.contentWindow.godotLatestData = godotData;
                                                    godotIframe.contentWindow.godotDataReceivedCount = (godotIframe.contentWindow.godotDataReceivedCount || 0) + 1;
                                                    godotIframe.contentWindow.godotLastDataTime = Date.now();
                                                }
                                            } catch (e) { /* cross-origin */ }
                                            if (playbackEngine.socket && playbackEngine.socket.connected) playbackEngine.socket.emit('godot_data', godotData);
                                            updateDisplaysWithData(data);
                                        }
                                    })
                                    .catch(err => { clearTimeout(timeoutId); pendingDataRequest = null; });
                                fetchPromise._abortController = controller;
                                fetchPromise._timeoutId = timeoutId;
                                pendingDataRequest = fetchPromise;
                            }
                        }
                    );
                } catch (error) {
                    console.error('❌ YouTube player initialization failed:', error);
                    console.error('  This might be due to:');
                    console.error('  - Invalid video ID');
                    console.error('  - Video is private/restricted');
                    console.error('  - Network issues loading YouTube API');
                    console.error('  - YouTube API blocked by browser');
                    console.error('  - Ad blockers may cause ERR_BLOCKED_BY_CLIENT (usually harmless)');
                    console.warn('  Continuing without YouTube video - flight data will still play');
                    console.warn('  Tip: If you see ERR_BLOCKED_BY_CLIENT, try disabling ad blockers');
                    // Continue without YouTube - don't block the entire page
                    window.youtubePlayer = null;
                }
            } else {
                console.error('YouTube player container not found!');
            }
        }

        // takeoffIndex already declared above for YouTube sync setup

        // Initialize map with preloaded path data
        try {
            if (result.bounds) {
                mapViewer.initialize(result.bounds, result.complete_path, takeoffIndex);
            } else {
                mapViewer.initialize(null, result.complete_path, takeoffIndex);
            }
        } catch (error) {
            console.error('Map initialization error:', error);
        }

        // Initialize chart with preloaded altitude data
        try {
            const downsampleFactor = result.downsample_factor || 1;
            chartViewer.initialize(result.complete_altitudes, takeoffIndex, downsampleFactor);
            console.log(`Chart initialized with ${result.complete_altitudes?.length || 0} altitude points, downsample factor: ${downsampleFactor}`);

            // Initialize altitude gauge with data range
            if (result.complete_altitudes && result.complete_altitudes.length > 0) {
                initializeAltitudeGauge(result.complete_altitudes);
            }

            // Initialize ground speed gauge (will update max as data comes in)
            // Start with a reasonable default, will be updated dynamically
            initializeGroundSpeedGauge([]);
        } catch (error) {
            console.error('Chart initialization error:', error);
        }

        // Initialize attitude chart with preloaded attitude data
        try {
            console.log('[MAIN] Checking attitude data:', {
                hasCompleteAttitudes: !!result.complete_attitudes,
                yawsLength: result.complete_attitudes?.yaws?.length || 0,
                pitchesLength: result.complete_attitudes?.pitches?.length || 0,
                rollsLength: result.complete_attitudes?.rolls?.length || 0
            });

            if (result.complete_attitudes &&
                result.complete_attitudes.yaws &&
                result.complete_attitudes.yaws.length > 0) {
                const downsampleFactor = result.downsample_factor || 1;
                attitudeChartViewer.initialize(result.complete_attitudes, takeoffIndex, downsampleFactor);
                console.log(`[MAIN] ✓ Attitude chart initialized with ${result.complete_attitudes.yaws.length} attitude points, downsample factor: ${downsampleFactor}`);
            } else {
                console.error('[MAIN] ERROR: No attitude data available from backend');
                console.error('[MAIN] result.complete_attitudes:', result.complete_attitudes);
                attitudeChartViewer.initialize(null, takeoffIndex, 1);
            }
        } catch (error) {
            console.error('[MAIN] Attitude chart initialization error:', error);
            console.error('[MAIN] Error stack:', error.stack);
        }

        // 3D viewer disabled - using Godot instead
        // To use Godot: Run Display/main_scene.tscn separately, or export to HTML5
        console.log('3D viewer: Using Godot display (run separately or export to HTML5)');

        // Don't wait for video - it will load in background and sync will work once ready
        if (window.youtubePlayer) {
            console.log('[MAIN] YouTube player initialized - video will load in background');
        } else {
            console.warn('[MAIN] YouTube player not available - continuing without video');
        }

        // Helper function to update all displays with flight data
        // Make it globally accessible for jump functionality
        function updateDisplaysWithData(data) {
            // Debug: Log data structure periodically
            if (!updateDisplaysWithData._callCount) updateDisplaysWithData._callCount = 0;
            updateDisplaysWithData._callCount++;
            if (updateDisplaysWithData._callCount % 50 === 0) {
                console.log('[MAIN] updateDisplaysWithData called:', {
                    hasVLAT: !!data.VLAT,
                    hasVLON: !!data.VLON,
                    hasVALT: !!data.VALT,
                    hasVQX: !!data.VQX,
                    index: data.index,
                    mapViewer: !!mapViewer,
                    chartViewer: !!chartViewer,
                    attitudeChartViewer: !!attitudeChartViewer
                });
            }

            // Update map
            if (mapViewer && mapViewer.map) {
                try {
                    mapViewer.updatePosition(data.VLAT, data.VLON, data.VALT, data.index);
                    if (updateDisplaysWithData._callCount <= 5) {
                        console.log(`[MAIN] Updated map: lat=${data.VLAT?.toFixed(6)}, lon=${data.VLON?.toFixed(6)}, alt=${data.VALT?.toFixed(1)}`);
                    }
                } catch (e) {
                    console.error('[MAIN] Error updating map:', e);
                }
            } else if (updateDisplaysWithData._callCount % 50 === 0) {
                console.warn('[MAIN] Map viewer not available:', { mapViewer: !!mapViewer, hasMap: !!(mapViewer && mapViewer.map) });
            }

            // Update chart
            if (chartViewer && chartViewer.chart) {
                try {
                    chartViewer.updatePosition(data.VALT, data.index);
                    if (updateDisplaysWithData._callCount <= 5) {
                        console.log(`[MAIN] Updated altitude chart: alt=${data.VALT?.toFixed(1)}, index=${data.index}`);
                    }
                } catch (e) {
                    console.error('[MAIN] Error updating altitude chart:', e);
                }
            } else if (updateDisplaysWithData._callCount % 50 === 0) {
                console.warn('[MAIN] Chart viewer not available:', { chartViewer: !!chartViewer, hasChart: !!(chartViewer && chartViewer.chart) });
            }

            // Update attitude chart
            if (attitudeChartViewer && attitudeChartViewer.chart) {
                try {
                    const euler = quaternionToEuler(data.VQX, data.VQY, data.VQZ, data.VQW);
                    attitudeChartViewer.updatePosition(euler.yaw, euler.pitch, euler.roll, data.index);
                    if (updateDisplaysWithData._callCount <= 5) {
                        console.log(`[MAIN] Updated attitude chart: yaw=${euler.yaw?.toFixed(2)}, pitch=${euler.pitch?.toFixed(2)}, roll=${euler.roll?.toFixed(2)}`);
                    }
                } catch (e) {
                    console.error('[MAIN] Error updating attitude chart:', e);
                }
            } else if (updateDisplaysWithData._callCount % 50 === 0) {
                console.warn('[MAIN] Attitude chart viewer not available:', { attitudeChartViewer: !!attitudeChartViewer, hasChart: !!(attitudeChartViewer && attitudeChartViewer.chart) });
            }

            // Update 3D viewer (Godot receives data via WebSocket)
            // Note: viewer3d is for Three.js fallback, but we're using Godot which gets data via WebSocket
            if (viewer3d && viewer3d.scene) {
                viewer3d.updateOrientation(
                    data.VQX, data.VQY, data.VQZ, data.VQW,
                    data.HQX, data.HQY, data.HQZ, data.HQW
                );
            }

            // NOTE: Godot data is now sent directly from video time updates for high frequency
            // This function is called less frequently (throttled) for other displays
            // Godot updates happen in the onVideoTimeUpdate callback above

            // Update info displays
            try {
                const altEl = document.getElementById('alt-display');
                const speedEl = document.getElementById('speed-display');
                const timestampEl = document.getElementById('timestamp-display');
                if (altEl && data.VALT !== undefined) altEl.textContent = data.VALT.toFixed(1);
                if (speedEl && data.GSPEED !== undefined) speedEl.textContent = data.GSPEED.toFixed(1);
                // Update timestamp display if available (from video-driven sync)
                if (timestampEl && data.timestamp_info) {
                    timestampEl.textContent = data.timestamp_info.timestamp_display;
                } else if (timestampEl && data.timestamp_seconds !== undefined) {
                    // Fallback: show data timestamp only
                    timestampEl.textContent = `Data: ${data.timestamp_seconds.toFixed(2)}s`;
                }

                // Update altitude gauge
                if (data.VALT !== undefined) {
                    updateAltitudeGauge(data.VALT);
                }

                // Update ground speed gauge
                if (data.GSPEED !== undefined) {
                    // Dynamically update max speed if current speed exceeds it
                    if (data.GSPEED > gaugeMaxSpeed) {
                        gaugeMaxSpeed = Math.ceil(data.GSPEED / 10) * 10;
                        const gaugeMax = document.getElementById('gauge-max-speed');
                        if (gaugeMax) {
                            gaugeMax.textContent = gaugeMaxSpeed.toString();
                        }
                    }
                    updateGroundSpeedGauge(data.GSPEED);
                }
            } catch (error) {
                // Silently handle DOM errors
            }
        }

        // Make updateDisplaysWithData globally accessible
        window.updateDisplaysWithData = updateDisplaysWithData;

        // Get takeoff timestamp for seeking YouTube video
        const takeoffTimestamp = result.timestamps && result.timestamps[0] ? result.timestamps[0] : 2643.0;

        // Load initial frame from takeoff marker
        if (loadingStatus) {
            loadingStatus.textContent = 'Loading initial data...';
        }
        console.log(`Loading initial data at takeoff index ${takeoffIndex} (timestamp ${takeoffTimestamp.toFixed(2)}s)...`);
        const initialData = await playbackEngine.fetchDataAtIndex(takeoffIndex);

        // Initialize ground speed gauge with initial data if available
        if (initialData && initialData.GSPEED !== undefined) {
            // Set initial max speed based on initial data
            if (initialData.GSPEED > gaugeMaxSpeed) {
                gaugeMaxSpeed = Math.ceil(initialData.GSPEED / 10) * 10;
                const gaugeMax = document.getElementById('gauge-max-speed');
                if (gaugeMax) {
                    gaugeMax.textContent = gaugeMaxSpeed.toString();
                }
            }
            updateGroundSpeedGauge(initialData.GSPEED);
        }
        console.log('Initial data received:', initialData);

        if (initialData) {
            console.log('Updating UI with initial data...');

            // Update displays with initial data
            initialData.index = takeoffIndex;
            updateDisplaysWithData(initialData);

            // CRITICAL: Initialize Godot data cache with initial data
            // This ensures 3D view has data immediately, even before video starts
            // Send initial data regardless of WebSocket connection status (it will connect later)
            {
                const initialGodotData = {
                    "VQX": initialData.VQX || 0,
                    "VQY": initialData.VQY || 0,
                    "VQZ": initialData.VQZ || 0,
                    "VQW": initialData.VQW || 1,
                    "HQX": initialData.HQX || 0,
                    "HQY": initialData.HQY || 0,
                    "HQZ": initialData.HQZ || 0,
                    "HQW": initialData.HQW || 1,
                    "GSPEED": initialData.GSPEED || 0,
                    "VALT": initialData.VALT || 0,
                };
                // Initialize cache with initial data
                if (window._godotDataCache) {
                    // Get video time for initial data if available
                    const initialVideoTime = 0; // Will be updated when video starts
                    if (window.addToCache) {
                        window.addToCache(initialVideoTime, initialGodotData);
                    } else {
                        window._godotDataCache = [{ videoTime: initialVideoTime, data: initialGodotData }];
                    }
                } else {
                    window._godotDataCache = [{ videoTime: 0, data: initialGodotData }];
                }
                // Store as last sent data for fallback
                window._lastGodotDataSent = initialGodotData;

                // CRITICAL: Send initial data to Godot immediately
                // This ensures Godot has data even before video time callbacks fire
                console.log('[MAIN] Sending initial data to Godot:', initialGodotData);

                // Send directly to Godot iframe (with retry if not ready)
                let sentDirectly = false;
                const sendToGodotIframe = (data, retryCount = 0) => {
                    try {
                        const godotIframe = document.getElementById('godot-iframe');
                        if (godotIframe) {
                            if (godotIframe.contentWindow) {
                                // Check if getGodotData function exists (iframe is fully loaded)
                                if (typeof godotIframe.contentWindow.getGodotData === 'function') {
                                    godotIframe.contentWindow.godotLatestData = data;
                                    if (!godotIframe.contentWindow.godotDataReceivedCount) {
                                        godotIframe.contentWindow.godotDataReceivedCount = 0;
                                    }
                                    godotIframe.contentWindow.godotDataReceivedCount++;
                                    godotIframe.contentWindow.godotLastDataTime = Date.now();
                                    sentDirectly = true;
                                    console.log('[MAIN] ✓ Initial data sent directly to Godot iframe');
                                    return true;
                                } else if (retryCount < 10) {
                                    // Iframe loaded but bridge not ready yet - retry
                                    console.log(`[MAIN] Godot bridge not ready yet, retrying... (${retryCount + 1}/10)`);
                                    setTimeout(() => sendToGodotIframe(data, retryCount + 1), 200);
                                    return false;
                                } else {
                                    console.warn('[MAIN] Godot bridge not ready after 10 retries');
                                    return false;
                                }
                            } else {
                                if (retryCount < 10) {
                                    console.log(`[MAIN] Godot iframe contentWindow not ready yet, retrying... (${retryCount + 1}/10)`);
                                    setTimeout(() => sendToGodotIframe(data, retryCount + 1), 200);
                                    return false;
                                } else {
                                    console.warn('[MAIN] Godot iframe contentWindow not ready after 10 retries');
                                    return false;
                                }
                            }
                        } else {
                            if (retryCount < 10) {
                                console.log(`[MAIN] Godot iframe not found, retrying... (${retryCount + 1}/10)`);
                                setTimeout(() => sendToGodotIframe(data, retryCount + 1), 200);
                                return false;
                            } else {
                                console.warn('[MAIN] Godot iframe not found after 10 retries');
                                return false;
                            }
                        }
                    } catch (e) {
                        if (retryCount < 10) {
                            console.log(`[MAIN] Direct iframe access failed, retrying... (${retryCount + 1}/10):`, e.message);
                            setTimeout(() => sendToGodotIframe(data, retryCount + 1), 200);
                            return false;
                        } else {
                            console.warn('[MAIN] Direct iframe access failed after 10 retries:', e.message);
                            return false;
                        }
                    }
                };
                sendToGodotIframe(initialGodotData);

                // ALWAYS also send via WebSocket as backup (even if direct access worked)
                // If WebSocket isn't connected yet, it will be sent when it connects
                if (playbackEngine.socket && playbackEngine.socket.connected) {
                    playbackEngine.socket.emit("godot_data", initialGodotData);
                    console.log('[MAIN] ✓ Initial data sent via WebSocket');
                } else {
                    // WebSocket not connected yet - store data to send when it connects
                    window._pendingInitialGodotData = initialGodotData;
                    console.log('[MAIN] WebSocket not connected yet, will send initial data when connected');
                }

                console.log('[MAIN] Initialized Godot data cache with takeoff data');
            }

            console.log('Initial data display complete');
        } else {
            console.error('Failed to fetch initial data');
        }

        // In video-driven mode, seek YouTube video to takeoff position and start data updates
        if (window.youtubePlayer) {
            // Wait for video to be fully ready, then seek to takeoff
            const seekToTakeoff = async () => {
                if (!window.youtubePlayer || !window.youtubePlayer.isReady) {
                    console.log('[MAIN] Waiting for YouTube player to be ready...');
                    setTimeout(seekToTakeoff, 500);
                    return;
                }

                try {
                    // Get video time for takeoff timestamp
                    console.log(`[MAIN] Fetching video time for takeoff timestamp: ${takeoffTimestamp}`);
                    const videoTimeResponse = await fetch(`/api/video-time/${takeoffTimestamp}`);
                    console.log(`[MAIN] Video time response status: ${videoTimeResponse.status}`);

                    if (videoTimeResponse.ok) {
                        const videoTimeResult = await videoTimeResponse.json();
                        console.log('[MAIN] Video time result:', videoTimeResult);

                        if (videoTimeResult.success && videoTimeResult.video_time !== undefined) {
                            const takeoffVideoTime = videoTimeResult.video_time;
                            console.log(`[MAIN] Seeking YouTube video to takeoff: ${takeoffVideoTime.toFixed(2)}s (flight time: ${takeoffTimestamp.toFixed(2)}s)`);

                            // Wait a bit longer before seeking to avoid triggering YouTube's verification
                            // YouTube may flag immediate seeks as suspicious behavior
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

                            // Check if player is still ready before seeking
                            if (window.youtubePlayer && window.youtubePlayer.isReady && window.youtubePlayer.player) {
                                try {
                                    // Seek video to takeoff position
                                    window.youtubePlayer.setUserControlling(true);
                                    window.youtubePlayer.player.seekTo(takeoffVideoTime, true);
                                } catch (seekError) {
                                    console.error('[MAIN] Error seeking to takeoff:', seekError);
                                    console.warn('[MAIN] Video may have restrictions preventing seek. Try:');
                                    console.warn('  1. Check YouTube Studio → Content → Video → Copyright tab for Content ID claims');
                                    console.warn('  2. Clear browser cache and cookies');
                                    console.warn('  3. Check YouTube Restricted Mode (profile icon → Restricted Mode)');
                                    console.warn('  4. Try incognito/private mode');
                                }
                            } else {
                                console.warn('[MAIN] YouTube player not ready, skipping seek');
                            }

                            // Wait a moment for seek to complete, then request data
                            setTimeout(() => {
                                const currentVideoTime = window.youtubePlayer.getCurrentTime();
                                console.log(`[MAIN] Video seeked to ${currentVideoTime.toFixed(2)}s, requesting data...`);

                                // Request data for current video time
                                fetch(`/api/data-for-video-time/${currentVideoTime}`)
                                    .then(response => {
                                        if (!response.ok) {
                                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                        }
                                        return response.json();
                                    })
                                    .then(result => {
                                        if (result.success && result.data) {
                                            const data = result.data;
                                            data.index = result.index;

                                            // Attach timestamp info for display
                                            if (result.timestamp_info) {
                                                data.timestamp_info = result.timestamp_info;
                                            } else if (result.data_timestamp !== undefined) {
                                                data.timestamp_info = {
                                                    video_time: result.video_time || currentVideoTime,
                                                    data_timestamp: result.data_timestamp,
                                                    data_index: result.index,
                                                    timestamp_display: `Video: ${(result.video_time || currentVideoTime).toFixed(2)}s | Data: ${result.data_timestamp.toFixed(2)}s`
                                                };
                                            }

                                            updateDisplaysWithData(data);
                                            console.log('[MAIN] Data updated to match video at takeoff position');
                                        } else {
                                            console.warn('[MAIN] Failed to get data for takeoff position:', result.error);
                                        }
                                    })
                                    .catch(error => {
                                        console.warn('[MAIN] Failed to get data for video time:', error);
                                    });

                                // Start video playback automatically
                                console.log('[MAIN] Starting YouTube video playback...');
                                window.youtubePlayer.setUserControlling(true);

                                // Wait a moment for seek to settle, then play
                                setTimeout(() => {
                                    try {
                                        window.youtubePlayer.play();
                                        console.log('[MAIN] ✓ Video play() called');
                                    } catch (playError) {
                                        console.error('[MAIN] Error starting playback:', playError);
                                    }
                                }, 500);

                                // Reset video time tracking to ensure immediate updates
                                if (window.resetVideoTimeTracking) {
                                    window.resetVideoTimeTracking();
                                }
                            }, 1000); // Wait 1 second for seek to complete
                        } else {
                            console.warn('[MAIN] Failed to get video time for takeoff, using offset calculation');
                            // Fallback: use offset from init result
                            const startOffset = result.youtube ? result.youtube.start_offset : 0;
                            const takeoffVideoTime = Math.max(0, takeoffTimestamp - startOffset);
                            console.log(`[MAIN] Using fallback offset calculation: ${takeoffVideoTime.toFixed(2)}s (offset: ${startOffset}s)`);
                            window.youtubePlayer.setUserControlling(true);
                            window.youtubePlayer.player.seekTo(takeoffVideoTime, true);
                            setTimeout(() => {
                                window.youtubePlayer.play();
                                if (window.resetVideoTimeTracking) {
                                    window.resetVideoTimeTracking();
                                }
                            }, 1000);
                        }
                    } else {
                        const errorText = await videoTimeResponse.text();
                        console.error(`[MAIN] Failed to fetch video time for takeoff: ${videoTimeResponse.status} - ${errorText}`);
                        // Fallback: use offset calculation
                        const startOffset = result.youtube ? result.youtube.start_offset : 0;
                        const takeoffVideoTime = Math.max(0, takeoffTimestamp - startOffset);
                        console.log(`[MAIN] Using fallback offset calculation after API error: ${takeoffVideoTime.toFixed(2)}s (offset: ${startOffset}s)`);
                        window.youtubePlayer.setUserControlling(true);
                        window.youtubePlayer.player.seekTo(takeoffVideoTime, true);
                        setTimeout(() => {
                            window.youtubePlayer.play();
                            if (window.resetVideoTimeTracking) {
                                window.resetVideoTimeTracking();
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error('[MAIN] Error seeking to takeoff:', error);
                    // Fallback: use offset calculation
                    const startOffset = result.youtube ? result.youtube.start_offset : 0;
                    const takeoffVideoTime = Math.max(0, takeoffTimestamp - startOffset);
                    console.log(`[MAIN] Using fallback offset calculation after exception: ${takeoffVideoTime.toFixed(2)}s (offset: ${startOffset}s)`);
                    if (window.youtubePlayer) {
                        window.youtubePlayer.setUserControlling(true);
                        window.youtubePlayer.player.seekTo(takeoffVideoTime, true);
                        setTimeout(() => {
                            window.youtubePlayer.play();
                            if (window.resetVideoTimeTracking) {
                                window.resetVideoTimeTracking();
                            }
                        }, 1000);
                    }
                }
            };

            // Start seeking to takeoff after a short delay to ensure player is ready
            setTimeout(seekToTakeoff, 1000);
        }

        // In pure video-driven mode, we don't use backend frame updates
        // The video time monitoring is the ONLY source of data updates
        // We keep this handler empty but registered to avoid errors
        playbackEngine.onFrameUpdate((data) => {
            // In video-driven mode, backend frame updates are ignored
            // All updates come from video time monitoring
            // This is just here to prevent errors if backend sends frames
        });

        playbackEngine.onStatusChange((status) => {
            statusEl.textContent = status;
            if (status === 'Connected') {
                statusEl.classList.add('connected');
                statusEl.classList.remove('error');
            } else if (status.includes('Error')) {
                statusEl.classList.add('error');
                statusEl.classList.remove('connected');
            }
        });

        // Connect playback engine
        if (loadingStatus) {
            loadingStatus.textContent = 'Connecting to playback engine...';
        }
        await playbackEngine.connect();

        // Wait a moment to ensure WebSocket is fully ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify WebSocket is connected
        if (!playbackEngine.socket || !playbackEngine.socket.connected) {
            console.error('[MAIN] WebSocket not connected, cannot start playback');
            if (loadingStatus) {
                loadingStatus.textContent = 'WebSocket connection failed';
            }
            throw new Error('WebSocket not connected');
        }
        console.log('[MAIN] ✓ WebSocket connected, ready to start playback');
        console.log(`[MAIN] Takeoff index: ${takeoffIndex}, will start playback from this index`);

        // Send any pending initial Godot data that was queued before WebSocket connected
        if (window._pendingInitialGodotData && playbackEngine.socket && playbackEngine.socket.connected) {
            playbackEngine.socket.emit("godot_data", window._pendingInitialGodotData);
            console.log('[MAIN] ✓ Sent pending initial data via WebSocket');
            window._pendingInitialGodotData = null;
        }

        // Wait for initial data to be displayed before starting playback
        // This ensures all UI components are ready
        if (loadingStatus) {
            loadingStatus.textContent = 'Initializing display...';
        }

        // Wait a bit more to ensure initial data is rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if YouTube video is available (takeoffIndex already declared above)
        // Make sure youtubePlayer is actually set (not null due to initialization error)
        if (result.youtube && result.youtube.enabled && window.youtubePlayer && window.youtubePlayer.isReady) {
            // In video-driven mode, we don't start automatic playback
            // Instead, we wait for YouTube video time updates to drive data requests
            // The video will automatically start requesting data once it's playing
            statusEl.textContent = 'Ready - Video-driven mode';

            // Ensure video time monitoring is active and trigger initial data load
            if (youtubePlayer && youtubePlayer.isReady) {
                console.log('[MAIN] YouTube player ready, video time monitoring should be active');
                // Video time monitoring should already be started by enableBidirectionalSync
                // But trigger an initial update to ensure displays are populated
                // Try multiple times with delays to catch when video is ready
                const tryInitialUpdate = (attempt = 0) => {
                    setTimeout(() => {
                        if (youtubePlayer && youtubePlayer.player && youtubePlayer.onVideoTimeUpdate) {
                            try {
                                const currentTime = youtubePlayer.player.getCurrentTime();
                                if (!isNaN(currentTime) && currentTime >= 0) {
                                    console.log(`[MAIN] Triggering initial video time update (attempt ${attempt + 1}):`, currentTime);
                                    youtubePlayer.onVideoTimeUpdate(currentTime);
                                } else if (attempt < 10) {
                                    // Retry if video time not ready yet
                                    tryInitialUpdate(attempt + 1);
                                }
                            } catch (e) {
                                console.warn(`[MAIN] Error getting video time (attempt ${attempt + 1}):`, e);
                                if (attempt < 10) {
                                    tryInitialUpdate(attempt + 1);
                                }
                            }
                        } else if (attempt < 10) {
                            // Retry if player not ready yet
                            tryInitialUpdate(attempt + 1);
                        }
                    }, attempt === 0 ? 500 : 1000); // First attempt after 500ms, then every 1s
                };
                tryInitialUpdate();
            }
        } else {
            // No YouTube video - start automatic playback
            statusEl.textContent = 'Ready - Starting playback...';
            console.log('[MAIN] No YouTube video - starting automatic playback');

            // Start playback from takeoff index after a short delay
            setTimeout(() => {
                if (playbackEngine && playbackEngine.socket && playbackEngine.socket.connected) {
                    playbackEngine.socket.emit('start_playback', {
                        index: takeoffIndex,
                        speed: 2.0
                    });
                    console.log(`[MAIN] Started playback from index ${takeoffIndex}`);
                    statusEl.textContent = 'Playing...';
                } else {
                    console.warn('[MAIN] Cannot start playback - WebSocket not connected');
                    statusEl.textContent = 'Ready - Click Play to start';
                }
            }, 1000);
        }

        statusEl.classList.add('connected');

        // Hide loading overlay after initialization completes
        // Always hide it, regardless of YouTube player state
        const hideLoadingOverlay = () => {
            if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                if (loadingStatus) {
                    loadingStatus.textContent = 'Ready!';
                }
                setTimeout(() => {
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('hidden');
                        console.log('[MAIN] Loading overlay hidden');
                    }
                }, 500);
            }
        };

        // Hide overlay after a short delay to ensure everything is rendered
        setTimeout(hideLoadingOverlay, 1000);

        // Fallback: Force hide overlay after 10 seconds maximum
        setTimeout(() => {
            if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                console.warn('[MAIN] Force hiding loading overlay after timeout');
                loadingOverlay.classList.add('hidden');
            }
        }, 10000);

    } catch (error) {
        console.error('Initialization error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('error');

        // Update loading status on error with more details
        if (loadingStatus) {
            let errorMsg = error.message;
            if (error.message.includes('timeout')) {
                errorMsg = 'Server is taking too long to respond. This may be due to processing a large dataset. Please wait or refresh the page.';
            } else if (error.message.includes('Failed to connect')) {
                errorMsg = 'Cannot connect to server. Please check your internet connection and try again.';
            }
            loadingStatus.textContent = `Error: ${errorMsg}`;
            loadingStatus.style.color = '#ff6b6b';
        }

        // Try to get health check info
        fetch('/api/health')
            .then(res => res.json())
            .then(health => {
                console.log('[MAIN] Server health:', health);
                if (health.data_file_exists === false) {
                    if (loadingStatus) {
                        loadingStatus.textContent = 'Error: Data file not found on server';
                    }
                }
            })
            .catch(e => console.warn('[MAIN] Could not fetch health check:', e));

        // Hide overlay after showing error message (after 5 seconds to allow reading)
        setTimeout(() => {
            if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                console.log('[MAIN] Hiding loading overlay after error');
                loadingOverlay.classList.add('hidden');
            }
        }, 5000);

        // Fallback: Force hide overlay after 15 seconds even on error
        setTimeout(() => {
            if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                console.warn('[MAIN] Force hiding loading overlay after error timeout');
                loadingOverlay.classList.add('hidden');
            }
        }, 15000);
    }
});

