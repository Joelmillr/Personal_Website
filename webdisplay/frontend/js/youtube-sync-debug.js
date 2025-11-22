/**
 * YouTube Sync Diagnostic Tool
 * Add this to browser console to debug sync issues
 */

window.youtubeSyncDebug = {
    /**
     * Get current sync status
     */
    status: function() {
        if (!window.youtubePlayer) {
            console.log('YouTube player not initialized');
            return;
        }
        
        const status = window.youtubePlayer.getSyncStatus();
        console.table(status);
        return status;
    },
    
    /**
     * Monitor sync for a period of time
     */
    monitor: function(durationSeconds = 10) {
        if (!window.youtubePlayer) {
            console.log('YouTube player not initialized');
            return;
        }
        
        console.log(`Monitoring sync for ${durationSeconds} seconds...`);
        const startTime = Date.now();
        const interval = setInterval(() => {
            const status = window.youtubePlayer.getSyncStatus();
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[${elapsed}s]`, status);
            
            if (Date.now() - startTime > durationSeconds * 1000) {
                clearInterval(interval);
                console.log('Monitoring complete');
            }
        }, 1000);
    },
    
    /**
     * Test sync at a specific flight timestamp
     */
    testSync: function(flightTimestamp) {
        if (!window.youtubePlayer) {
            console.log('YouTube player not initialized');
            return;
        }
        
        console.log(`Testing sync at flight time: ${flightTimestamp}s`);
        const before = window.youtubePlayer.getSyncStatus();
        window.youtubePlayer.syncToFlightTime(flightTimestamp);
        
        setTimeout(() => {
            const after = window.youtubePlayer.getSyncStatus();
            console.log('Before:', before);
            console.log('After:', after);
        }, 500);
    },
    
    /**
     * Get offset recommendation
     */
    recommendOffset: function() {
        if (!window.youtubePlayer || !playbackEngine) {
            console.log('YouTube player or playback engine not available');
            return;
        }
        
        // Get current flight time
        const currentData = playbackEngine.currentIndex;
        // This would need access to the data, so we'll use a simpler approach
        console.log('To calculate offset:');
        console.log('1. Note the current flight data timestamp');
        console.log('2. Note what time the YouTube video should be at');
        console.log('3. Offset = flight_timestamp - video_time');
        console.log('4. Set YOUTUBE_START_OFFSET to this value');
    }
};

console.log('YouTube Sync Debug tools loaded!');
console.log('Usage:');
console.log('  youtubeSyncDebug.status() - Get current sync status');
console.log('  youtubeSyncDebug.monitor(10) - Monitor sync for 10 seconds');
console.log('  youtubeSyncDebug.testSync(2643.0) - Test sync at specific timestamp');




