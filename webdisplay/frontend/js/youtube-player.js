/**
 * YouTube video player integration
 * Syncs YouTube video playback with flight data timestamps
 */
class YouTubePlayer {
    constructor(containerId, videoId, startOffset = 0, hasTimestampMap = false, timestampMapData = null) {
        this.containerId = containerId;
        this.videoId = videoId;
        this.startOffset = startOffset; // Offset in seconds from flight data start (fallback)
        this.hasTimestampMap = hasTimestampMap; // Whether to use timestamp mapping
        this.timestampMap = null; // Client-side cached mapping
        this.timestampMapData = []; // Sorted array of [data_timestamp, video_time] pairs
        this.player = null;
        this.isReady = false;
        this.isPlaying = false;
        this.currentFlightTime = 0;
        this.lastSyncTime = 0;
        this.lastSeekTime = 0;
        this.syncInterval = null;
        this.debugMode = true; // Enable verbose logging to diagnose sync issues
        this.lastSyncCall = 0; // Throttle sync calls
        this.driftHistory = []; // Track drift over time to calculate drift rate
        this.lastDriftCheck = 0;

        // Bidirectional sync: YouTube → PlaybackEngine
        this.bidirectionalSyncEnabled = false;
        this.lastVideoTime = 0;
        this.videoTimeMonitorInterval = null;
        this.onPlaybackStateChange = null; // Callback: (isPlaying) => void
        this.onSeek = null; // Callback: (dataTimestamp) => void
        this.onVideoTimeUpdate = null; // Callback: (videoTime) => void - for video-driven sync
        this.isUserControlling = false; // Flag to prevent feedback loops
        this.lastControlActionTime = 0; // Timestamp of last time we controlled the video

        // Initialize timestamp mapping cache if provided
        if (hasTimestampMap && timestampMapData && timestampMapData.length > 0) {
            this.timestampMapData = timestampMapData.map(entry => [entry.data_timestamp, entry.video_time]).sort((a, b) => a[0] - b[0]);
            console.log(`[YouTube] Loaded ${this.timestampMapData.length} timestamp mappings for client-side caching`);
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            // Set a timeout for the entire initialization
            const initTimeout = setTimeout(() => {
                console.error('[YouTube] Initialization timeout after 15 seconds');
                reject(new Error('YouTube player initialization timeout'));
            }, 15000);

            const clearTimeoutAndResolve = () => {
                clearTimeout(initTimeout);
                resolve();
            };

            const clearTimeoutAndReject = (error) => {
                clearTimeout(initTimeout);
                reject(error);
            };

            // Load YouTube IFrame API if not already loaded
            if (!window.YT) {
                console.log('[YouTube] Loading YouTube IFrame API...');
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                // Wait for API to load with timeout
                const apiTimeout = setTimeout(() => {
                    console.error('[YouTube] YouTube API failed to load');
                    clearTimeoutAndReject(new Error('YouTube API failed to load'));
                }, 10000);

                window.onYouTubeIframeAPIReady = () => {
                    clearTimeout(apiTimeout);
                    console.log('[YouTube] YouTube IFrame API loaded');
                    this.createPlayer(clearTimeoutAndResolve, clearTimeoutAndReject);
                };
            } else {
                console.log('[YouTube] YouTube IFrame API already loaded');
                this.createPlayer(clearTimeoutAndResolve, clearTimeoutAndReject);
            }
        });
    }

    createPlayer(resolve, reject) {
        const container = document.getElementById(this.containerId);
        if (!container) {
            reject(new Error(`Container ${this.containerId} not found`));
            return;
        }

        console.log('[YouTube] Creating player in container:', this.containerId);
        console.log('[YouTube] Video ID:', this.videoId);
        console.log('[YouTube] Container element:', container);
        console.log('[YouTube] Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);

        if (!this.videoId || this.videoId.trim() === '') {
            reject(new Error('Video ID is empty or invalid'));
            return;
        }

        try {
            // Build player parameters - using only documented YouTube IFrame API parameters
            // Reference: https://support.google.com/youtube/answer/171780
            // Note: The origin is automatically set by YouTube based on the HTTP Referer header
            const playerVars = {
                'autoplay': 0,              // Don't autoplay (required for proper sync)
                'controls': 1,              // Show player controls
                'rel': 0,                   // Don't show related videos from other channels
                'modestbranding': 1,        // Reduce YouTube branding
                'playsinline': 1,           // Play inline on mobile devices
                'enablejsapi': 1,           // REQUIRED: Enable JavaScript API for programmatic control
                'fs': 1,                    // Allow fullscreen
                'cc_load_policy': 0,        // Don't show captions by default
                'disablekb': 0             // Allow keyboard controls
            };

            // Clean video ID (extract from various YouTube URL formats)
            let cleanVideoId = this.videoId.trim();

            // Extract video ID from various YouTube URL formats
            // Handles: youtu.be/VIDEO_ID, youtube.com/watch?v=VIDEO_ID, youtube.com/embed/VIDEO_ID, or plain VIDEO_ID
            const videoIdPattern = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)?([a-zA-Z0-9_-]{11})/;
            const match = cleanVideoId.match(videoIdPattern);
            if (match) {
                cleanVideoId = match[1];
            } else {
                // If no URL pattern, try to extract 11-character ID
                const idMatch = cleanVideoId.match(/([a-zA-Z0-9_-]{11})/);
                if (idMatch) {
                    cleanVideoId = idMatch[1];
                } else {
                    // Remove query parameters and use as-is
                    cleanVideoId = cleanVideoId.split('?')[0].split('&')[0];
                }
            }

            console.log('[YouTube] Original video ID input:', this.videoId);
            console.log('[YouTube] Cleaned video ID:', cleanVideoId);
            console.log('[YouTube] Origin:', window.location.origin);
            console.log('[YouTube] Player vars:', playerVars);

            // Use Privacy-Enhanced Mode (youtube-nocookie.com) to avoid tracking restrictions
            // This may help with error 150 issues
            console.log('[YouTube] Using Privacy-Enhanced Mode (youtube-nocookie.com)');

            // Log detailed information for debugging
            console.log('[YouTube] Player configuration:', {
                containerId: this.containerId,
                videoId: cleanVideoId,
                playerVars: playerVars,
                origin: window.location.origin,
                protocol: window.location.protocol,
                hostname: window.location.hostname,
                port: window.location.port,
                referrer: document.referrer || 'none'
            });

            // Let YouTube create the iframe normally, then modify it to use privacy-enhanced domain
            this.player = new YT.Player(this.containerId, {
                videoId: cleanVideoId,
                playerVars: playerVars,
                events: {
                    'onReady': (event) => {
                        this.isReady = true;
                        console.log('[YouTube] Player ready');
                        console.log('[YouTube] Video ID:', this.videoId);
                        console.log('[YouTube] Start offset:', this.startOffset, 'seconds');

                        // Try to modify iframe to use privacy-enhanced domain after YouTube creates it
                        try {
                            const iframe = container.querySelector('iframe');
                            if (iframe) {
                                console.log('[YouTube] Found iframe, current src:', iframe.src);
                                if (iframe.src.includes('youtube.com/embed')) {
                                    // Replace youtube.com with youtube-nocookie.com
                                    const newSrc = iframe.src.replace('youtube.com/embed', 'youtube-nocookie.com/embed');
                                    console.log('[YouTube] Modifying iframe to use privacy-enhanced domain');
                                    console.log('[YouTube] Original src:', iframe.src);
                                    console.log('[YouTube] New src:', newSrc);
                                    iframe.src = newSrc;
                                    console.log('[YouTube] ✓ Iframe src updated to privacy-enhanced mode');
                                } else if (iframe.src.includes('youtube-nocookie.com')) {
                                    console.log('[YouTube] ✓ Iframe already using privacy-enhanced domain');
                                } else {
                                    console.warn('[YouTube] Iframe src does not match expected pattern:', iframe.src);
                                }
                            } else {
                                console.warn('[YouTube] No iframe found in container');
                            }
                        } catch (e) {
                            console.warn('[YouTube] Could not modify iframe src:', e);
                        }

                        // Get initial player state
                        try {
                            const playerState = this.player.getPlayerState();
                            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                            this.isPlaying = (playerState === YT.PlayerState.PLAYING);
                            console.log('[YouTube] Initial player state:', playerState, 'isPlaying:', this.isPlaying);
                        } catch (e) {
                            // Player might not be fully ready yet, default to false
                            this.isPlaying = false;
                            console.log('[YouTube] Could not get initial state, defaulting to paused');
                        }

                        // Resolve immediately - don't wait for video metadata
                        // Video will load in background and sync will work once ready
                        if (this.hasTimestampMap) {
                            console.log('[YouTube] Using timestamp mapping:', this.timestampMapData.length, 'entries cached');
                        }

                        // Start monitoring video time for seek detection
                        this.startVideoTimeMonitoring();
                        
                        // Immediately trigger a video time update to send initial data
                        // This ensures Godot gets data even before video starts playing
                        // Try multiple times with increasing delays to catch when video is ready
                        const tryInitialUpdate = (attempt = 0) => {
                            setTimeout(() => {
                                try {
                                    const initialVideoTime = this.player.getCurrentTime();
                                    if (!isNaN(initialVideoTime) && initialVideoTime >= 0 && this.onVideoTimeUpdate) {
                                        console.log(`[YouTube] Triggering initial video time update (attempt ${attempt + 1}):`, initialVideoTime);
                                        this.onVideoTimeUpdate(initialVideoTime);
                                    } else if (attempt < 5) {
                                        // Retry if video not ready yet (up to 5 times)
                                        tryInitialUpdate(attempt + 1);
                                    }
                                } catch (e) {
                                    // Video might not be ready yet, will retry
                                    if (attempt < 5) {
                                        tryInitialUpdate(attempt + 1);
                                    }
                                }
                            }, 100 * (attempt + 1)); // Increasing delay: 100ms, 200ms, 300ms, etc.
                        };
                        tryInitialUpdate(0);

                        resolve();
                    },
                    'onStateChange': (event) => {
                        // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                        const stateValue = event.data;
                        const wasPlaying = this.isPlaying;

                        // Get state name for logging (map correctly)
                        let stateName = 'unknown';
                        if (stateValue === YT.PlayerState.UNSTARTED) stateName = 'unstarted';
                        else if (stateValue === YT.PlayerState.ENDED) stateName = 'ended';
                        else if (stateValue === YT.PlayerState.PLAYING) stateName = 'playing';
                        else if (stateValue === YT.PlayerState.PAUSED) stateName = 'paused';
                        else if (stateValue === YT.PlayerState.BUFFERING) stateName = 'buffering';
                        else if (stateValue === YT.PlayerState.CUED) stateName = 'cued';

                        // Update isPlaying based on actual player state
                        // Only PLAYING (1) means playing
                        // PAUSED (2) and ENDED (0) mean not playing
                        // BUFFERING (3) and CUED (5) are transitional - keep current state
                        // UNSTARTED (-1) means not playing
                        let nowPlaying = this.isPlaying; // Default to current state
                        if (stateValue === YT.PlayerState.PLAYING) {
                            nowPlaying = true;
                        } else if (stateValue === YT.PlayerState.PAUSED || stateValue === YT.PlayerState.ENDED || stateValue === YT.PlayerState.UNSTARTED) {
                            nowPlaying = false;
                        }
                        // For BUFFERING and CUED, keep the current playing state (don't change)
                        this.isPlaying = nowPlaying;

                        console.log('[YouTube] State changed:', {
                            state: stateName,
                            stateValue: stateValue,
                            YT_PLAYING: YT.PlayerState.PLAYING,
                            YT_PAUSED: YT.PlayerState.PAUSED,
                            wasPlaying: wasPlaying,
                            nowPlaying: nowPlaying,
                            isPlaying: this.isPlaying,
                            isUserControlling: this.isUserControlling
                        });

                        if (stateValue === YT.PlayerState.CUED) {
                            // Video is cued and ready
                            console.log('[YouTube] Video cued and ready for playback');
                        }

                        // Notify playback state change if bidirectional sync is enabled and state actually changed
                        if (this.bidirectionalSyncEnabled && this.onPlaybackStateChange) {
                            const stateChanged = wasPlaying !== this.isPlaying;
                            const timeSinceLastControl = Date.now() - this.lastControlActionTime;
                            // Only block for a very short window (200ms) to prevent immediate feedback loops
                            // This allows user actions to work even if we just controlled the video
                            const recentlyControlled = timeSinceLastControl < 200;

                            console.log('[YouTube] State change check:', {
                                state: stateName,
                                stateValue: stateValue,
                                wasPlaying,
                                isPlaying: this.isPlaying,
                                nowPlaying,
                                stateChanged,
                                recentlyControlled,
                                timeSinceLastControl: timeSinceLastControl + 'ms',
                                bidirectionalSyncEnabled: this.bidirectionalSyncEnabled
                            });

                            if (stateChanged && !recentlyControlled) {
                                console.log('[YouTube] ✓ Calling onPlaybackStateChange with isPlaying:', this.isPlaying);
                                this.onPlaybackStateChange(this.isPlaying);
                            } else if (stateChanged && recentlyControlled) {
                                console.log('[YouTube] Skipping callback - we controlled the video recently (' + timeSinceLastControl + 'ms ago)');
                            } else if (!stateChanged) {
                                console.log('[YouTube] No state change detected (wasPlaying === isPlaying === ' + wasPlaying + ')');
                            }
                        }
                    },
                    'onError': (event) => {
                        console.error('[YouTube] Player error:', event.data);
                        console.error('[YouTube] Error event details:', event);

                        // Check for blocked requests in console (ad blockers, privacy extensions)
                        const hasBlockedRequests = performance.getEntriesByType('resource')
                            .some(entry => entry.name.includes('youtubei') && entry.transferSize === 0);

                        const errorMessages = {
                            2: 'Invalid video ID or video not found',
                            5: 'HTML5 player error',
                            100: 'Video not found or removed',
                            101: 'Video not allowed to be played in embedded players',
                            150: 'Video not allowed to be played in embedded players',
                            151: 'Video owner has disabled playback on other websites (embedding disabled)',
                            152: 'Video owner has disabled playback on mobile devices'
                        };
                        const errorMsg = errorMessages[event.data] || `YouTube error code: ${event.data}`;
                        console.error('[YouTube] Error details:', errorMsg);
                        console.error('[YouTube] Current origin:', window.location.origin);
                        console.error('[YouTube] Video ID:', cleanVideoId);

                        if (hasBlockedRequests || event.data === 150) {
                            console.warn('[YouTube] ⚠️ Possible ad blocker or privacy extension blocking YouTube requests');
                            console.warn('[YouTube] Check browser console for "ERR_BLOCKED_BY_CLIENT" errors');
                            console.warn('[YouTube] Try disabling ad blockers or privacy extensions and refresh');
                        }

                        // Display user-friendly error message in the UI
                        const container = document.getElementById(this.containerId);
                        if (container) {
                            const isAgeRestrictedError = (event.data === 150 || event.data === 101);
                            const videoUrl = `https://www.youtube.com/watch?v=${cleanVideoId}`;
                            const embedTestUrl = `https://www.youtube.com/embed/${cleanVideoId}`;

                            container.innerHTML = `
                                <div style="padding: 20px; text-align: center; color: #ff6b6b; background: #fff5f5; border: 2px solid #ff6b6b; border-radius: 8px;">
                                    <h3 style="margin-top: 0;">⚠️ YouTube Video Error (Code: ${event.data})</h3>
                                    <p><strong>${errorMsg}</strong></p>
                                    <p style="font-size: 0.85em; color: #666; margin-top: 10px;">
                                        Video ID: <code>${cleanVideoId}</code><br>
                                        Origin: <code>${window.location.origin}</code>
                                    </p>
                                    ${isAgeRestrictedError ? `
                                    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin: 10px 0;">
                                        <strong>⚠️ Error 150/101 - Common Causes:</strong>
                                        <ul style="text-align: left; margin: 10px 0;">
                                            <li>Age restrictions (even if you think it's disabled, check again)</li>
                                            <li>Video is <strong>Private</strong> (must be Public or Unlisted)</li>
                                            <li>Embedding disabled in Advanced settings</li>
                                            <li>Content ID claim or copyright restrictions</li>
                                            <li>Regional restrictions</li>
                                        </ul>
                                    </div>
                                    ` : ''}
                                    <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                                        <strong>Step-by-Step Fix:</strong>
                                    </p>
                                    <ol style="text-align: left; display: inline-block; margin: 10px 0; font-size: 0.9em;">
                                        <li>Go to <a href="https://studio.youtube.com" target="_blank" style="color: #0066cc;">YouTube Studio</a></li>
                                        <li>Click <strong>Content</strong> → Find video <code>${cleanVideoId}</code></li>
                                        <li>Click the video → <strong>Details</strong></li>
                                        <li>Check <strong>Visibility</strong>: Must be "Public" or "Unlisted" (NOT Private)</li>
                                        <li>Scroll to <strong>Age restriction</strong>: Must be "No, don't restrict"</li>
                                        <li>Click <strong>SHOW MORE</strong> → Verify <strong>"Allow embedding"</strong> is checked</li>
                                        <li><strong>Save</strong> all changes</li>
                                        <li>Wait 1-2 minutes, then refresh this page</li>
                                    </ol>
                                    <div style="margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 4px;">
                                        <strong>Test Links:</strong><br>
                                        <a href="${videoUrl}" target="_blank" style="color: #0066cc; margin: 0 10px;">Watch on YouTube</a> |
                                        <a href="${embedTestUrl}" target="_blank" style="color: #0066cc; margin: 0 10px;">Test Embed Directly</a>
                                    </div>
                                    <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                                        <strong>⚠️ ERR_BLOCKED_BY_CLIENT Error - Something is blocking YouTube requests:</strong>
                                        <ul style="text-align: left; margin: 10px 0; font-size: 0.9em;">
                                            <li><strong>Browser Privacy Settings:</strong>
                                                <ul style="margin-left: 20px; margin-top: 5px;">
                                                    <li><strong>Firefox:</strong> Settings → Privacy & Security → Enhanced Tracking Protection (try disabling for this site)</li>
                                                    <li><strong>Chrome:</strong> Settings → Privacy and security → Privacy Sandbox (try disabling)</li>
                                                    <li><strong>Edge:</strong> Settings → Privacy, search, and services → Tracking prevention (try "Basic")</li>
                                                </ul>
                                            </li>
                                            <li><strong>Browser Extensions:</strong> Check ALL extensions (not just ad blockers) - disable them one by one to find the culprit</li>
                                            <li><strong>Corporate Firewall/Proxy:</strong> If on a corporate network, YouTube requests may be blocked</li>
                                            <li><strong>Antivirus Software:</strong> Some antivirus software blocks tracking/analytics requests</li>
                                            <li><strong>Content ID Claim:</strong> Check YouTube Studio → Content → Video → Copyright tab</li>
                                            <li><strong>Regional Restrictions:</strong> Check YouTube Studio → Content → Video → Details → Distribution</li>
                                        </ul>
                                    </div>
                                    <div style="margin-top: 10px; padding: 10px; background: #ffebee; border: 1px solid #f44336; border-radius: 4px;">
                                        <strong>🔴 Error 150 - Final Checklist:</strong>
                                        <p style="font-size: 0.9em; margin: 10px 0;"><strong>Since video is unlisted, embedding enabled, and no age restriction, error 150 is almost certainly one of these:</strong></p>
                                        <ol style="text-align: left; margin: 10px 0; font-size: 0.9em;">
                                            <li><strong>Content ID Claim (MOST LIKELY):</strong> 
                                                <ul style="margin-left: 20px; margin-top: 5px;">
                                                    <li>Go to YouTube Studio → Content → Find video <code>${cleanVideoId}</code></li>
                                                    <li>Click the video → <strong>Copyright</strong> tab (NOT Details tab)</li>
                                                    <li>Look for any Content ID claims or copyright restrictions</li>
                                                    <li>Even a single claim can block embedding</li>
                                                </ul>
                                            </li>
                                            <li><strong>YouTube Restricted Mode:</strong> 
                                                <ul style="margin-left: 20px; margin-top: 5px;">
                                                    <li>Go to YouTube.com (not Studio)</li>
                                                    <li>Click your profile icon (top right)</li>
                                                    <li>Scroll down → Find "Restricted Mode"</li>
                                                    <li>Toggle it OFF if it's ON</li>
                                                </ul>
                                            </li>
                                            <li><strong>Video Visibility:</strong> Double-check it's "Unlisted" not "Private" in YouTube Studio</li>
                                            <li><strong>Embedding Setting:</strong> Double-check "Allow embedding" is checked in Advanced settings</li>
                                        </ol>
                                    </div>
                                    <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
                                        <strong>⚠️ If none of the above work:</strong>
                                        <p style="font-size: 0.9em; margin: 10px 0;">
                                            Error 150 with these settings typically means YouTube has applied a restriction you can't see in the normal settings. 
                                            You may need to contact YouTube Support or try uploading a new video.
                                        </p>
                                    </div>
                                    <p style="font-size: 0.85em; color: #999; margin-top: 15px;">
                                        If the "Test Embed Directly" link works but this doesn't, there may be a CORS, referrer, or localhost detection issue.
                                    </p>
                                </div>
                            `;
                        }

                        reject(new Error(`YouTube player error: ${errorMsg} (code: ${event.data})`));
                    }
                }
            });
        } catch (e) {
            console.error('[YouTube] Exception creating player:', e);
            reject(e);
        }
    }

    /**
     * Sync video to flight data timestamp
     * Throttled to avoid too many operations
     * @param {number} flightTimestamp - Flight data timestamp in seconds
     */
    async syncToFlightTime(flightTimestamp) {
        if (!this.isReady || !this.player) {
            return; // Silently return if not ready
        }

        // Throttle sync calls - only sync every 500ms to avoid lag and reduce seeking
        const now = Date.now();
        if (now - this.lastSyncCall < 500) {
            return; // Skip this sync call
        }
        this.lastSyncCall = now;

        // Calculate video time - always try server API first (has full mapping)
        let targetVideoTime;

        // Always try server API first (has full mapping, even if client cache is incomplete)
        const mappedTime = await this.getVideoTimeFromTimestamp(flightTimestamp);
        if (mappedTime !== null && mappedTime !== undefined) {
            targetVideoTime = Math.max(0, mappedTime);
        } else {
            // Fallback to offset if mapping fails
            targetVideoTime = Math.max(0, flightTimestamp - this.startOffset);
            console.warn(`[YouTube] Mapping failed for ${flightTimestamp.toFixed(2)}s, using offset: ${targetVideoTime.toFixed(2)}s`);
        }

        try {
            // Try to get current time - if it fails, video isn't ready yet
            const currentVideoTime = this.player.getCurrentTime();
            if (isNaN(currentVideoTime) || currentVideoTime < 0) {
                // Video not ready yet, try to seek anyway (might work)
                try {
                    this.player.seekTo(targetVideoTime, true);
                    this.currentFlightTime = flightTimestamp;
                } catch (e) {
                    // Ignore - video not ready
                }
                return;
            }

            const timeDiff = currentVideoTime - targetVideoTime; // Positive = video ahead, negative = video behind
            const absDiff = Math.abs(timeDiff);

            // Track drift over time to detect systematic drift (rate mismatch)
            const now = Date.now();
            if (now - this.lastDriftCheck > 2000) { // Check drift rate every 2 seconds
                this.driftHistory.push({
                    time: now,
                    drift: timeDiff,
                    flightTime: flightTimestamp
                });
                // Keep only last 5 measurements (10 seconds of history)
                if (this.driftHistory.length > 5) {
                    this.driftHistory.shift();
                }
                this.lastDriftCheck = now;

                // Calculate drift rate if we have enough history
                if (this.driftHistory.length >= 3) {
                    const first = this.driftHistory[0];
                    const last = this.driftHistory[this.driftHistory.length - 1];
                    const timeSpan = (last.time - first.time) / 1000; // seconds
                    const driftChange = last.drift - first.drift; // seconds
                    const driftRate = driftChange / timeSpan; // seconds per second

                    // If drift rate is significant (>0.1s per second), we have a rate mismatch
                    if (Math.abs(driftRate) > 0.1) {
                        console.warn(`[YouTube Sync] Detected drift rate: ${driftRate.toFixed(3)}s/s (video ${driftRate > 0 ? 'ahead' : 'behind'})`);
                        // Could adjust playback rate here, but YouTube max is 2x
                        // Instead, we'll seek more aggressively when drift is systematic
                    }
                }
            }

            // Adaptive sync threshold based on drift rate
            // If we're drifting quickly, use smaller threshold to catch it early
            // If drift is slow, use larger threshold to avoid constant seeking
            let syncThreshold = 1.0; // Default 1 second
            if (this.driftHistory.length >= 3) {
                const first = this.driftHistory[0];
                const last = this.driftHistory[this.driftHistory.length - 1];
                const timeSpan = (last.time - first.time) / 1000;
                const driftChange = last.drift - first.drift;
                const driftRate = Math.abs(driftChange / timeSpan);

                // If drifting fast (>0.2s/s), use smaller threshold (0.5s)
                // If drifting slow (<0.05s/s), use larger threshold (2.0s)
                if (driftRate > 0.2) {
                    syncThreshold = 0.5;
                } else if (driftRate < 0.05) {
                    syncThreshold = 2.0;
                }
            }

            // Predictive sync: if we're drifting, adjust target to account for drift
            let adjustedTargetVideoTime = targetVideoTime;
            if (this.driftHistory.length >= 3) {
                const first = this.driftHistory[0];
                const last = this.driftHistory[this.driftHistory.length - 1];
                const timeSpan = (last.time - first.time) / 1000;
                const driftChange = last.drift - first.drift;
                const driftRate = driftChange / timeSpan; // seconds per second

                // If we're consistently drifting, predict where we'll be and adjust
                // Estimate time until next sync (500ms based on throttle)
                const timeUntilNextSync = 0.5;
                const predictedDrift = driftRate * timeUntilNextSync;

                // Adjust target to compensate for predicted drift
                adjustedTargetVideoTime = targetVideoTime - predictedDrift;
            }

            // Recalculate difference with adjusted target
            const adjustedTimeDiff = currentVideoTime - adjustedTargetVideoTime;
            const adjustedAbsDiff = Math.abs(adjustedTimeDiff);

            // Sync threshold - only seek if difference is significant
            const shouldSeek = adjustedAbsDiff > syncThreshold;

            if (shouldSeek) {
                // Log sync attempts occasionally (only if debug mode)
                if (this.debugMode && (this.lastSeekTime === 0 || Date.now() - this.lastSeekTime > 5000)) {
                    const playbackRate = this.player.getPlaybackRate ? this.player.getPlaybackRate() : 1;
                    console.log('[YouTube Sync] Seeking:', {
                        flightTime: flightTimestamp.toFixed(2) + 's',
                        targetVideoTime: targetVideoTime.toFixed(2) + 's',
                        adjustedTargetVideoTime: adjustedTargetVideoTime.toFixed(2) + 's',
                        currentVideoTime: currentVideoTime.toFixed(2) + 's',
                        difference: timeDiff > 0 ? '+' + timeDiff.toFixed(2) : timeDiff.toFixed(2) + 's',
                        adjustedDifference: adjustedTimeDiff > 0 ? '+' + adjustedTimeDiff.toFixed(2) : adjustedTimeDiff.toFixed(2) + 's'
                    });
                    this.lastSeekTime = Date.now();
                }

                // Don't set isUserControlling for automatic syncs - only for explicit user actions
                // This allows user pausing to work even during sync
                // Use adjusted target to compensate for drift
                this.player.seekTo(adjustedTargetVideoTime, true);
                this.currentFlightTime = flightTimestamp;
                this.lastSyncTime = adjustedTargetVideoTime;
                this.lastVideoTime = adjustedTargetVideoTime; // Update last video time to prevent false seek detection

                // Clear drift history after seeking to start fresh
                this.driftHistory = [];
            }
        } catch (e) {
            // Silently ignore errors - video might not be ready yet
            // Will retry on next sync call
        }
    }

    /**
     * Start playback
     */
    play() {
        if (this.isReady && this.player) {
            this.setUserControlling(true); // Prevent feedback loop
            this.player.playVideo();
            this.isPlaying = true;
            if (this.debugMode) {
                console.log('[YouTube] Playback started');
            }
        }
    }

    /**
     * Pause playback
     */
    pause() {
        if (this.isReady && this.player) {
            this.setUserControlling(true); // Prevent feedback loop
            this.player.pauseVideo();
            this.isPlaying = false;
            if (this.debugMode) {
                console.log('[YouTube] Playback paused');
            }
        }
    }

    /**
     * Set playback speed (YouTube supports 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)
     * YouTube maximum is 2x, so we cap at 2x
     * @param {number} speed - Playback speed multiplier
     * @returns {number} - Actual speed set (capped at 2x)
     */
    setSpeed(speed) {
        if (this.isReady && this.player) {
            // YouTube maximum is 2x - cap the speed
            const cappedSpeed = Math.min(speed, 2.0);

            // YouTube only supports specific speeds, round to nearest
            const youtubeSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
            const closestSpeed = youtubeSpeeds.reduce((prev, curr) =>
                Math.abs(curr - cappedSpeed) < Math.abs(prev - cappedSpeed) ? curr : prev
            );

            try {
                this.player.setPlaybackRate(closestSpeed);
                if (this.debugMode) {
                    console.log('[YouTube] Speed set to:', closestSpeed + 'x (requested:', speed + 'x)');
                }
                return closestSpeed; // Return actual speed set
            } catch (e) {
                console.warn('[YouTube] Error setting speed:', e);
                return cappedSpeed;
            }
        }
        return Math.min(speed, 2.0); // Return capped speed even if player not ready
    }

    /**
     * Jump to a specific flight timestamp
     * @param {number} flightTimestamp - Flight data timestamp in seconds
     */
    async jumpTo(flightTimestamp) {
        if (this.debugMode) {
            console.log('[YouTube] Jumping to flight time:', flightTimestamp.toFixed(2));
        }
        // Set control flag since this is an explicit jump action
        this.setUserControlling(true);
        this.syncToFlightTime(flightTimestamp);
    }

    /**
     * Get current video time
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        if (this.isReady && this.player) {
            try {
                return this.player.getCurrentTime();
            } catch (e) {
                console.warn('[YouTube] Error getting current time:', e);
                return 0;
            }
        }
        return 0;
    }

    /**
     * Get video duration
     * @returns {number} Duration in seconds
     */
    getDuration() {
        if (this.isReady && this.player) {
            try {
                return this.player.getDuration();
            } catch (e) {
                console.warn('[YouTube] Error getting duration:', e);
                return 0;
            }
        }
        return 0;
    }

    /**
     * Get video time from flight data timestamp using cached mapping
     * Uses client-side interpolation to avoid API calls
     * @param {number} flightTimestamp - Flight data timestamp in seconds
     * @returns {number|null} - Video time in seconds, or null if mapping unavailable
     */
    async getVideoTimeFromTimestamp(flightTimestamp) {
        // Always use server-side API lookup (has full mapping)
        // Client-side cache is incomplete (only first 2000 entries)
        try {
            const response = await fetch(`/api/video-time/${flightTimestamp}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.video_time !== undefined) {
                    return result.video_time;
                } else {
                    console.warn(`[YouTube] Server response missing video_time for ${flightTimestamp.toFixed(2)}s`);
                }
            } else {
                console.warn(`[YouTube] API error ${response.status} for ${flightTimestamp.toFixed(2)}s`);
            }
        } catch (e) {
            console.error('[YouTube] Failed to fetch video time:', e);
        }

        return null;
    }

    /**
     * Get sync status for debugging
     */
    getSyncStatus() {
        if (!this.isReady || !this.player) {
            return { ready: false, error: 'Player not ready' };
        }

        try {
            const videoTime = this.player.getCurrentTime();
            const expectedVideoTime = Math.max(0, this.currentFlightTime - this.startOffset);
            const difference = videoTime - expectedVideoTime; // Positive = video ahead
            const absDifference = Math.abs(difference);

            return {
                ready: true,
                videoTime: parseFloat(videoTime.toFixed(2)),
                flightTime: parseFloat(this.currentFlightTime.toFixed(2)),
                expectedVideoTime: parseFloat(expectedVideoTime.toFixed(2)),
                difference: parseFloat(difference.toFixed(2)), // Positive = video ahead, negative = video behind
                absDifference: parseFloat(absDifference.toFixed(2)),
                offset: this.startOffset,
                isPlaying: this.isPlaying,
                playbackRate: this.player.getPlaybackRate ? this.player.getPlaybackRate() : 'unknown',
                videoId: this.videoId,
                status: absDifference < 0.2 ? 'IN_SYNC' : (difference > 0 ? 'VIDEO_AHEAD' : 'VIDEO_BEHIND')
            };
        } catch (e) {
            return { ready: true, error: e.message };
        }
    }

    /**
     * Enable bidirectional sync: YouTube video controls playback
     * @param {Function} onPlaybackStateChange - Callback when play/pause state changes: (isPlaying) => void
     * @param {Function} onSeek - Callback when video is seeked: (dataTimestamp) => void
     * @param {Function} onVideoTimeUpdate - Callback when video time updates: (videoTime) => void
     */
    enableBidirectionalSync(onPlaybackStateChange, onSeek, onVideoTimeUpdate = null) {
        this.bidirectionalSyncEnabled = true;
        this.onPlaybackStateChange = onPlaybackStateChange;
        this.onSeek = onSeek;
        this.onVideoTimeUpdate = onVideoTimeUpdate;
        console.log('[YouTube] Bidirectional sync enabled (video-driven mode)');
    }

    /**
     * Disable bidirectional sync
     */
    disableBidirectionalSync() {
        this.bidirectionalSyncEnabled = false;
        this.onPlaybackStateChange = null;
        this.onSeek = null;
        this.onVideoTimeUpdate = null;
        if (this.videoTimeMonitorInterval) {
            clearInterval(this.videoTimeMonitorInterval);
            this.videoTimeMonitorInterval = null;
        }
        console.log('[YouTube] Bidirectional sync disabled');
    }

    /**
     * Start monitoring video time to detect seeks and drive data updates
     */
    startVideoTimeMonitoring() {
        if (this.videoTimeMonitorInterval) {
            console.log('[YouTube] Video time monitoring already active');
            return; // Already monitoring
        }

        console.log('[YouTube] Starting video time monitoring...');
        
        // Poll video time at high frequency for smooth 3D view updates
        // Increased to 16ms (~60 FPS) to match video exactly for head movement sync
        this.videoTimeMonitorInterval = setInterval(() => {
            if (!this.isReady || !this.player) {
                return;
            }

            try {
                const currentVideoTime = this.player.getCurrentTime();
                if (isNaN(currentVideoTime) || currentVideoTime < 0) {
                    return; // Video not ready
                }

                const playerState = this.player.getPlayerState();
                const isPlaying = (playerState === YT.PlayerState.PLAYING);

                // Check if video time changed (either from playing or from user seeking while paused)
                const timeChanged = (this.lastVideoTime >= 0 && Math.abs(currentVideoTime - this.lastVideoTime) > 0.001);

                // Emit video time update if:
                // 1. Video is playing (normal playback), OR
                // 2. Video time changed while paused (user seeked), OR
                // 3. First time we get valid video time (initialization), OR
                // 4. Video is paused but we haven't sent an update recently (keep data flowing)
                // Always emit on first valid time to ensure initial data is sent
                const isFirstValidTime = (this.lastVideoTime < 0 && currentVideoTime >= 0);
                const timeSinceLastUpdate = Date.now() - (this.lastUpdateTime || 0);
                const shouldUpdate = isPlaying || timeChanged || isFirstValidTime || (timeSinceLastUpdate > 100); // Update at least every 100ms even when paused
                
                // Debug: Log monitoring activity periodically
                if (!this._monitorDebugCount) this._monitorDebugCount = 0;
                this._monitorDebugCount++;
                if (this._monitorDebugCount <= 10 || this._monitorDebugCount % 500 === 0) {
                    console.log(`[YouTube] Monitor tick #${this._monitorDebugCount}: videoTime=${currentVideoTime.toFixed(3)}s, isPlaying=${isPlaying}, timeChanged=${timeChanged}, shouldUpdate=${shouldUpdate}, hasCallback=${!!this.onVideoTimeUpdate}`);
                }
                
                if (shouldUpdate) {
                    // Emit video time update (for video-driven sync)
                    // This is the ONLY job: check video time and let the frontend fetch corresponding data
                    // High frequency polling ensures 3D view matches video exactly
                    if (this.onVideoTimeUpdate) {
                        // Debug: Log periodically to verify callbacks are firing
                        if (!this._monitorCallCount) this._monitorCallCount = 0;
                        this._monitorCallCount++;
                        if (this._monitorCallCount <= 5 || this._monitorCallCount % 100 === 0) {
                            console.log(`[YouTube] Video time monitoring: videoTime=${currentVideoTime.toFixed(3)}s, isPlaying=${isPlaying}, calling onVideoTimeUpdate`);
                        }
                        this.onVideoTimeUpdate(currentVideoTime);
                        this.lastUpdateTime = Date.now();
                    } else {
                        // Debug: Log if callback not set
                        if (!this._noCallbackWarningLogged) {
                            console.warn('[YouTube] Video time monitoring active but onVideoTimeUpdate callback not set!');
                            this._noCallbackWarningLogged = true;
                        }
                    }
                }

                this.lastVideoTime = currentVideoTime;
            } catch (e) {
                // Silently ignore errors
            }
        }, 16); // Check every 16ms (~60 FPS) for high-frequency 3D view updates
    }

    /**
     * Convert video time to flight data timestamp
     * @param {number} videoTime - Video time in seconds
     * @returns {Promise<number|null>} - Flight data timestamp in seconds, or null if unavailable
     */
    async getDataTimestampFromVideoTime(videoTime) {
        try {
            const response = await fetch(`/api/data-timestamp/${videoTime}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data_timestamp !== undefined) {
                    return result.data_timestamp;
                }
            }
        } catch (e) {
            console.warn('[YouTube] Failed to fetch data timestamp:', e);
        }
        return null;
    }

    /**
     * Set flag to indicate we're controlling the video (prevents feedback loops)
     * @param {boolean} controlling - Whether we're currently controlling the video
     */
    setUserControlling(controlling) {
        this.isUserControlling = controlling;
        if (controlling) {
            this.lastControlActionTime = Date.now();
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.videoTimeMonitorInterval) {
            clearInterval(this.videoTimeMonitorInterval);
            this.videoTimeMonitorInterval = null;
        }
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        this.isReady = false;
    }
}
