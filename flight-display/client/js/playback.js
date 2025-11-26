/**
 * Playback engine - handles WebSocket communication and playback state
 */
class PlaybackEngine {
    constructor() {
        this.socket = null;
        this.isPlaying = false;
        this.currentIndex = 0;
        this.speed = 2.0; // Default speed 2x
        this.frameUpdateCallbacks = [];
        this.statusCallbacks = [];
        this.jumpCallbacks = [];
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Use configurable WebSocket URL (set by backend) or connect to same origin
                // Socket.IO will connect to the same server if no URL is provided
                if (window.WS_URL) {
                    this.socket = io(window.WS_URL);
                } else {
                    // Connect to same origin (current server)
                    this.socket = io();
                }
                
                this.socket.on('connect', () => {
                    console.log('[FRONTEND] WebSocket connected to server');
                    this.notifyStatus('Connected');
                    resolve();
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.notifyStatus('Disconnected');
                    this.isPlaying = false;
                });
                
                this.socket.on('connected', (data) => {
                    console.log('Server confirmed connection:', data);
                });
                
                this.socket.on('frame_update', (data) => {
                    // Log ALL frame updates for debugging (first 20, then every 100)
                    if (!this._frameUpdateCount) this._frameUpdateCount = 0;
                    this._frameUpdateCount++;
                    if (this._frameUpdateCount <= 20 || this._frameUpdateCount % 100 === 0) {
                        console.log('[FRONTEND] Received frame_update #' + this._frameUpdateCount + ':', 
                            'index=' + data.index, 
                            'timestamp=' + data.timestamp_seconds?.toFixed(2), 
                            'has_VLAT=' + !!data.VLAT,
                            'has_VQX=' + !!data.VQX);
                    }
                    
                    // Ignore stale updates - if we've jumped to a different index, ignore older data
                    // This prevents race conditions when jumping
                    const receivedIndex = data.index;
                    if (receivedIndex < this.currentIndex && this.currentIndex - receivedIndex > 10) {
                        // This is likely a stale message from before a jump - ignore it
                        if (this._frameUpdateCount <= 20) {
                            console.log('[FRONTEND] Ignoring stale frame_update:', receivedIndex, 'current:', this.currentIndex);
                        }
                        return;
                    }
                    
                    this.currentIndex = receivedIndex;
                    this.notifyFrameUpdate(data);
                });
                
                this.socket.on('playback_started', () => {
                    this.isPlaying = true;
                    console.log('[FRONTEND] ✓ Playback started - waiting for frame_update messages...');
                    console.log('[FRONTEND] isPlaying set to true, should start receiving frames soon');
                    
                    // Debug: Set a timeout to check if frames are actually coming
                    setTimeout(() => {
                        if (!this._frameUpdateCount || this._frameUpdateCount === 0) {
                            console.warn('[FRONTEND] WARNING: No frame_update messages received after playback_started!');
                            console.warn('[FRONTEND] This suggests the backend playback loop may not be running');
                        } else {
                            console.log(`[FRONTEND] ✓ Frame updates are coming (received ${this._frameUpdateCount} so far)`);
                        }
                    }, 2000);
                });
                
                this.socket.on('playback_paused', () => {
                    this.isPlaying = false;
                    console.log('Playback paused');
                });
                
                this.socket.on('playback_finished', () => {
                    this.isPlaying = false;
                    console.log('Playback finished');
                    this.notifyStatus('Playback finished');
                });
                
                this.socket.on('error', (data) => {
                    console.error('Server error:', data);
                    this.notifyStatus(`Error: ${data.message}`);
                });
                
                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    this.notifyStatus('Connection error');
                    reject(error);
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    startPlayback(index = null) {
        if (!this.socket || !this.socket.connected) {
            console.error('Not connected to server');
            return;
        }
        
        const data = { speed: this.speed };
        // Always send current index if not specified, so playback continues from where we are
        if (index !== null) {
            data.index = index;
        } else {
            data.index = this.currentIndex;
        }
        
        console.log('[FRONTEND] Starting playback from index:', data.index, 'at speed:', data.speed);
        console.log('[FRONTEND] Socket connected:', this.socket.connected);
        this.socket.emit('start_playback', data);
        console.log('[FRONTEND] start_playback event emitted, waiting for playback_started confirmation...');
        
        // Also start YouTube video if available
        // YouTube max speed is 2x, so cap our speed to match
        // Set isUserControlling flag to prevent feedback loop
        if (window.youtubePlayer) {
            window.youtubePlayer.setUserControlling(true);
            window.youtubePlayer.play();
            const actualSpeed = window.youtubePlayer.setSpeed(this.speed);
            // If YouTube capped the speed, update our speed to match
            if (actualSpeed < this.speed) {
                this.speed = actualSpeed;
                console.log(`[FRONTEND] Speed capped to ${actualSpeed}x (YouTube maximum is 2x)`);
            }
        }
        
        // Debug: Set a timeout to check if playback_started was received
        // Removed automatic retry - it was causing feedback loops with bidirectional sync
        // If playback doesn't start, it's likely because the backend is paused or there's a real issue
        setTimeout(() => {
            if (!this.isPlaying) {
                console.warn('[FRONTEND] WARNING: playback_started event not received after 2 seconds. isPlaying:', this.isPlaying);
                console.warn('[FRONTEND] This might be normal if playback was paused or if there\'s a backend issue.');
            }
        }, 2000);
    }
    
    pausePlayback() {
        if (!this.socket || !this.socket.connected) {
            return;
        }
        
        console.log('[PLAYBACK] Pausing playback - emitting pause_playback event');
        this.socket.emit('pause_playback');
        
        // Also pause YouTube video if available
        // Set isUserControlling flag FIRST to prevent feedback loop
        if (window.youtubePlayer) {
            window.youtubePlayer.setUserControlling(true);
            window.youtubePlayer.pause();
        }
    }
    
    setSpeed(speed) {
        this.speed = speed;
        if (!this.socket || !this.socket.connected) {
            return;
        }
        
        // YouTube maximum is 2x - cap the speed
        const cappedSpeed = Math.min(speed, 2.0);
        if (cappedSpeed < speed) {
            console.log(`[FRONTEND] Speed capped to ${cappedSpeed}x (YouTube maximum is 2x)`);
        }
        
        this.speed = cappedSpeed;
        this.socket.emit('set_speed', { speed: cappedSpeed });
        
        // Update YouTube speed if available
        if (window.youtubePlayer) {
            const actualSpeed = window.youtubePlayer.setSpeed(cappedSpeed);
            // Ensure we match YouTube's actual speed
            if (actualSpeed !== cappedSpeed) {
                this.speed = actualSpeed;
            }
        }
        
        // Restart with new speed from current position
        if (this.isPlaying) {
            this.startPlayback(this.currentIndex);
        }
    }
    
    seek(index) {
        if (!this.socket || !this.socket.connected) {
            return;
        }
        
        this.currentIndex = index;
        this.socket.emit('seek', { index: index });
        
        // Fetch data for this index
        this.fetchDataAtIndex(index).then(data => {
            if (data) {
                this.notifyFrameUpdate(data);
            }
        });
    }
    
    async jumpToTimestamp(timestampId) {
        try {
            console.log(`[PLAYBACK] Jumping to timestamp ${timestampId}...`);
            
            const response = await fetch(`/api/jump/${timestampId}`);
            if (!response.ok) {
                console.error(`[PLAYBACK] Jump API error: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const result = await response.json();
            
            if (result.success) {
                const targetIndex = result.index;
                const targetTimestamp = result.timestamp;
                console.log(`[PLAYBACK] Jumped to index ${targetIndex}, timestamp ${targetTimestamp.toFixed(2)}s`);
                
                // Update current index
                this.currentIndex = targetIndex;
                
                // Notify that we jumped (so UI can reset tracking)
                this.notifyJump();
                
                // In video-driven mode, we need to find the video time for this timestamp
                // and seek the YouTube video to that time
                if (window.youtubePlayer && targetTimestamp !== undefined) {
                    // Convert flight data timestamp to video time
                    const videoTimeResponse = await fetch(`/api/video-time/${targetTimestamp}`);
                    if (videoTimeResponse.ok) {
                        const videoTimeResult = await videoTimeResponse.json();
                        if (videoTimeResult.success && videoTimeResult.video_time !== undefined) {
                            const targetVideoTime = videoTimeResult.video_time;
                            console.log(`[PLAYBACK] Seeking YouTube video to ${targetVideoTime.toFixed(2)}s (flight time: ${targetTimestamp.toFixed(2)}s)`);
                            
                            // Reset video time tracking to force immediate update after seek
                            if (window.resetVideoTimeTracking) {
                                window.resetVideoTimeTracking();
                            }
                            
                            window.youtubePlayer.setUserControlling(true);
                            window.youtubePlayer.player.seekTo(targetVideoTime, true);
                            
                            // Also immediately fetch and display data for this position
                            // Don't wait for video time monitoring (it might be throttled)
                            setTimeout(async () => {
                                const currentVideoTime = window.youtubePlayer.getCurrentTime();
                                console.log(`[PLAYBACK] Video seeked to ${currentVideoTime.toFixed(2)}s, fetching data...`);
                                try {
                                    const dataResponse = await fetch(`/api/data-for-video-time/${currentVideoTime}`);
                                    if (dataResponse.ok) {
                                        const dataResult = await dataResponse.json();
                                        if (dataResult.success && dataResult.data) {
                                            const data = dataResult.data;
                                            data.index = dataResult.index;
                                            
                                            // Attach timestamp info for display
                                            if (dataResult.timestamp_info) {
                                                data.timestamp_info = dataResult.timestamp_info;
                                            } else if (dataResult.data_timestamp !== undefined) {
                                                data.timestamp_info = {
                                                    video_time: dataResult.video_time || currentVideoTime,
                                                    data_timestamp: dataResult.data_timestamp,
                                                    data_index: dataResult.index,
                                                    timestamp_display: `Video: ${(dataResult.video_time || currentVideoTime).toFixed(2)}s | Data: ${dataResult.data_timestamp.toFixed(2)}s`
                                                };
                                            }
                                            
                                            // Update displays immediately
                                            if (window.updateDisplaysWithData) {
                                                window.updateDisplaysWithData(data);
                                            }
                                            console.log(`[PLAYBACK] Data updated immediately after jump`);
                                        }
                                    }
                                } catch (error) {
                                    console.warn('[PLAYBACK] Failed to fetch data after jump:', error);
                                }
                            }, 500); // Wait 500ms for seek to complete
                            
                            // The video time monitoring will continue to request data for the new video time
                        } else {
                            console.error('[PLAYBACK] Failed to get video time for timestamp:', videoTimeResult);
                        }
                    } else {
                        console.error(`[PLAYBACK] Failed to fetch video time: ${videoTimeResponse.status}`);
                    }
                } else {
                    // Fallback: fetch data directly if no YouTube player
                    const targetData = await this.fetchDataAtIndex(targetIndex);
                    if (targetData) {
                        targetData.index = targetIndex;
                        this.notifyFrameUpdate(targetData);
                    }
                }
                
                return targetIndex;
            } else {
                console.error('[PLAYBACK] Jump failed:', result.error);
            }
        } catch (error) {
            console.error('[PLAYBACK] Jump error:', error);
        }
        return null;
    }
    
    async fetchPathData(startIndex, endIndex) {
        // Fetch path data for rebuilding the flight path
        try {
            const response = await fetch(`/api/path/${startIndex}/${endIndex}`);
            const result = await response.json();
            
            if (result.success) {
                return result.path;
            } else {
                console.error('Failed to fetch path data:', result.error);
                return [];
            }
        } catch (error) {
            console.error('Fetch path error:', error);
            return [];
        }
    }
    
    async fetchDataAtIndex(index) {
        try {
            const response = await fetch(`/api/data/${index}`);
            const result = await response.json();
            
            
            return result;
        } catch (error) {
            console.error('Fetch data error:', error);
            return null;
        }
    }
    
    onFrameUpdate(callback) {
        this.frameUpdateCallbacks.push(callback);
    }
    
    onStatusChange(callback) {
        this.statusCallbacks.push(callback);
    }
    
    onJump(callback) {
        this.jumpCallbacks.push(callback);
    }
    
    notifyFrameUpdate(data) {
        this.frameUpdateCallbacks.forEach(cb => cb(data));
    }
    
    notifyStatus(status) {
        this.statusCallbacks.forEach(cb => cb(status));
    }
    
    notifyJump() {
        this.jumpCallbacks.forEach(cb => cb());
    }
    
    getCurrentIndex() {
        return this.currentIndex;
    }
    
    getIsPlaying() {
        return this.isPlaying;
    }
}

