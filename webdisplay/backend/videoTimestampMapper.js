/**
 * Video timestamp mapping utility
 * Converts flight data timestamps to YouTube video times using the timestamp mapping file
 */

const fs = require('fs');
const path = require('path');

class VideoTimestampMapper {
    /**
     * Initialize mapper with timestamp map file
     * @param {string} timestampMapFile - Path to JSON mapping file
     */
    constructor(timestampMapFile = null) {
        this.timestamps = []; // List of [data_timestamp, video_time] pairs
        this.dataTimestamps = []; // Sorted list of data timestamps for binary search
        this.videoTimes = []; // Corresponding video times
        this.timestampsByVideo = []; // Sorted by video time for reverse lookup
        this.videoTimesSorted = [];
        this.dataTimestampsByVideo = [];

        if (timestampMapFile && fs.existsSync(timestampMapFile)) {
            this.loadMapping(timestampMapFile);
        }
    }

    /**
     * Load timestamp mapping from JSON file
     */
    loadMapping(timestampMapFile) {
        try {
            const fileContent = fs.readFileSync(timestampMapFile, 'utf-8');
            const mapping = JSON.parse(fileContent);

            // Create sorted list of [data_timestamp, video_time] pairs
            this.timestamps = mapping
                .map(entry => [entry.data_timestamp, entry.video_time])
                .sort((a, b) => a[0] - b[0]);

            this.dataTimestamps = this.timestamps.map(ts => ts[0]);
            this.videoTimes = this.timestamps.map(ts => ts[1]);

            // Also create sorted list by video_time for reverse lookup
            this.timestampsByVideo = [...this.timestamps].sort((a, b) => a[1] - b[1]);
            this.videoTimesSorted = this.timestampsByVideo.map(ts => ts[1]);
            this.dataTimestampsByVideo = this.timestampsByVideo.map(ts => ts[0]);

            return true;
        } catch (error) {
            console.log(`Error loading video timestamp mapping: ${error}`);
            return false;
        }
    }

    /**
     * Binary search helper
     */
    _bisectLeft(arr, value) {
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

    /**
     * Convert flight data timestamp to video time using interpolation
     * @param {number} dataTimestamp - Flight data timestamp in seconds
     * @returns {number|null} Video time in seconds, or null if mapping not available
     */
    dataToVideoTime(dataTimestamp) {
        if (this.timestamps.length === 0) {
            return null;
        }

        // Binary search for closest timestamp
        let idx = this._bisectLeft(this.dataTimestamps, dataTimestamp);

        // Handle edge cases
        if (idx === 0) {
            return this.videoTimes[0];
        } else if (idx >= this.timestamps.length) {
            return this.videoTimes[this.videoTimes.length - 1];
        }

        // Interpolate between two points
        const [prevDataTs, prevVideoTs] = this.timestamps[idx - 1];
        const [nextDataTs, nextVideoTs] = this.timestamps[idx];

        // If exact match
        if (prevDataTs === dataTimestamp) {
            return prevVideoTs;
        }
        if (nextDataTs === dataTimestamp) {
            return nextVideoTs;
        }

        // Linear interpolation
        if (nextDataTs === prevDataTs) {
            return prevVideoTs;
        }

        const ratio = (dataTimestamp - prevDataTs) / (nextDataTs - prevDataTs);
        const videoTime = prevVideoTs + ratio * (nextVideoTs - prevVideoTs);

        return videoTime;
    }

    /**
     * Convert video time to flight data timestamp using interpolation (reverse mapping)
     * @param {number} videoTime - Video time in seconds
     * @returns {number|null} Flight data timestamp in seconds, or null if mapping not available
     */
    videoToDataTime(videoTime) {
        if (this.timestamps.length === 0 || this.timestampsByVideo.length === 0) {
            return null;
        }

        // Binary search for closest video time
        let idx = this._bisectLeft(this.videoTimesSorted, videoTime);

        // Handle edge cases
        if (idx === 0) {
            return this.dataTimestampsByVideo[0];
        } else if (idx >= this.timestampsByVideo.length) {
            return this.dataTimestampsByVideo[this.dataTimestampsByVideo.length - 1];
        }

        // Interpolate between two points
        const [prevDataTs, prevVideoTs] = this.timestampsByVideo[idx - 1];
        const [nextDataTs, nextVideoTs] = this.timestampsByVideo[idx];

        // If exact match
        if (prevVideoTs === videoTime) {
            return prevDataTs;
        }
        if (nextVideoTs === videoTime) {
            return nextDataTs;
        }

        // Linear interpolation
        if (nextVideoTs === prevVideoTs) {
            return prevDataTs;
        }

        const ratio = (videoTime - prevVideoTs) / (nextVideoTs - prevVideoTs);
        const dataTimestamp = prevDataTs + ratio * (nextDataTs - prevDataTs);

        return dataTimestamp;
    }

    /**
     * Check if mapping is available
     */
    isAvailable() {
        return this.timestamps.length > 0;
    }
}

module.exports = VideoTimestampMapper;

