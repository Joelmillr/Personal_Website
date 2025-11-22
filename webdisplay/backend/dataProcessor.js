/**
 * Data processing module for flight test data.
 * Handles CSV loading, quaternion calculations, and frame matching.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { quat, mat4 } = require('gl-matrix');

class FlightDataProcessor {
    /**
     * Initialize processor with data file.
     * @param {string} dataFile - Path to merged_data.csv
     */
    constructor(dataFile) {
        this.dataFile = dataFile;
        this.dataList = [];
        this.timestampNsList = [];
        this._loadData();
    }

    /**
     * Load and process the merged_data.csv file
     */
    _loadData() {
        const startTime = Date.now();
        console.log(`[DATA] Loading data from ${this.dataFile}...`);
        
        try {
            const fileStats = fs.statSync(this.dataFile);
            const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
            console.log(`[DATA] File size: ${fileSizeMB} MB`);
        } catch (e) {
            console.warn(`[DATA] Could not get file stats: ${e.message}`);
        }
        
        let fileContent;
        try {
            fileContent = fs.readFileSync(this.dataFile, 'utf-8');
            const loadTime = Date.now() - startTime;
            console.log(`[DATA] File read completed in ${loadTime}ms`);
        } catch (error) {
            console.error(`[DATA] ❌ Error reading file: ${error.message}`);
            throw new Error(`Failed to read data file: ${error.message}`);
        }
        console.log(`[DATA] Parsing CSV (${(fileContent.length / 1024 / 1024).toFixed(2)} MB)...`);
        const parseStartTime = Date.now();
        
        let records;
        try {
            records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                cast: (value, context) => {
                    // Don't cast timestamp column - it needs special parsing
                    if (context.column === 'timestamp') {
                        return value; // Keep as string for timestamp parsing
                    }
                    // Try to parse as number for other columns
                    const num = parseFloat(value);
                    if (!isNaN(num) && isFinite(num)) {
                        return num;
                    }
                    return value;
                }
            });
            const parseTime = Date.now() - parseStartTime;
            console.log(`[DATA] CSV parsed: ${records.length} records in ${parseTime}ms`);
        } catch (error) {
            console.error(`[DATA] ❌ Error parsing CSV: ${error.message}`);
            throw new Error(`Failed to parse CSV: ${error.message}`);
        }

        // Process timestamps and convert to seconds
        this.dataList = records.map((row, index) => {
            // Parse timestamp - handle both timedelta strings and numeric seconds
            let timestampSeconds = 0;
            if (typeof row.timestamp === 'string') {
                // Try parsing as timedelta (e.g., "0 days 00:00:02.643000")
                const tdMatch = row.timestamp.match(/(\d+) days?\s+(\d+):(\d+):([\d.]+)/);
                if (tdMatch) {
                    const days = parseInt(tdMatch[1]) || 0;
                    const hours = parseInt(tdMatch[2]) || 0;
                    const minutes = parseInt(tdMatch[3]) || 0;
                    const seconds = parseFloat(tdMatch[4]) || 0;
                    timestampSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
                } else {
                    // Try as numeric seconds
                    timestampSeconds = parseFloat(row.timestamp) || 0;
                }
            } else {
                timestampSeconds = parseFloat(row.timestamp) || 0;
            }

            return {
                index,
                timestampSeconds,
                timestampNs: timestampSeconds * 1e9, // Convert to nanoseconds for binary search
                row
            };
        });

        // Sort by timestamp
        console.log(`[DATA] Sorting ${this.dataList.length} records by timestamp...`);
        const sortStartTime = Date.now();
        this.dataList.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
        const sortTime = Date.now() - sortStartTime;
        console.log(`[DATA] Sorting completed in ${sortTime}ms`);

        // Pre-compute numeric timestamps for fast binary search
        console.log(`[DATA] Pre-computing timestamp list...`);
        const mapStartTime = Date.now();
        this.timestampNsList = this.dataList.map(d => d.timestampNs);
        const mapTime = Date.now() - mapStartTime;
        console.log(`[DATA] Timestamp list computed in ${mapTime}ms`);

        const totalTime = Date.now() - startTime;
        console.log(`[DATA] ✓ Successfully loaded ${this.dataList.length} data rows in ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    }

    /**
     * Get summary of loaded data
     */
    getSummary() {
        if (this.dataList.length === 0) {
            return {
                data_count: 0,
                data_columns: []
            };
        }

        const columns = Object.keys(this.dataList[0].row);
        return {
            data_count: this.dataList.length,
            data_columns: columns
        };
    }

    /**
     * Get total number of data points
     */
    getDataCount() {
        return this.dataList.length;
    }

    /**
     * Calculate quaternion multiplication (q1 * q2)
     */
    _multiplyQuaternions(q1, q2) {
        const result = quat.create();
        quat.multiply(result, q1, q2);
        return result;
    }

    /**
     * Convert quaternion to Euler angles (xyz convention: roll, pitch, yaw)
     * Returns angles in degrees
     */
    _quaternionToEuler(q) {
        const [x, y, z, w] = q;
        
        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (w * x + y * z);
        const cosr_cosp = 1 - 2 * (x * x + y * y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);

        // Pitch (y-axis rotation)
        const sinp = 2 * (w * y - z * x);
        let pitch;
        if (Math.abs(sinp) >= 1) {
            pitch = Math.sign(sinp) * Math.PI / 2; // Use 90 degrees if out of range
        } else {
            pitch = Math.asin(sinp);
        }

        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (w * z + x * y);
        const cosy_cosp = 1 - 2 * (y * y + z * z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);

        return {
            roll: roll * 180 / Math.PI,
            pitch: pitch * 180 / Math.PI,
            yaw: yaw * 180 / Math.PI
        };
    }

    /**
     * Get flight data at a specific index.
     * Returns dict with all relevant data including quaternions.
     */
    getDataAtIndex(index) {
        if (index < 0 || index >= this.dataList.length) {
            return null;
        }

        const data = this.dataList[index];
        const row = data.row;

        // Calculate quaternions
        // Helmet quaternion (corrected)
        const helmetCorrected = quat.fromValues(
            row.x_helmet || 0,
            row.y_helmet || 0,
            row.z_helmet || 0,
            row.w_helmet || 1
        );

        // Vehicle quaternion (world-relative)
        const vehicleWorld = quat.fromValues(
            row.x_vehicle || 0,
            row.y_vehicle || 0,
            row.z_vehicle || 0,
            row.w_vehicle || 1
        );

        // Helmet world quaternion = vehicle * helmet_corrected
        const helmetWorld = this._multiplyQuaternions(vehicleWorld, helmetCorrected);

        // Calculate ground speed
        const vvn = row.north || 0;
        const vve = row.east || 0;
        const vvd = row.down || 0;
        const gspeed = Math.sqrt(vvn * vvn + vve * vve + vvd * vvd);

        return {
            index: index,
            timestamp_seconds: data.timestampSeconds,
            timestamp_ns: data.timestampNs,

            // Vehicle quaternion (world-relative)
            VQX: vehicleWorld[0],
            VQY: vehicleWorld[1],
            VQZ: vehicleWorld[2],
            VQW: vehicleWorld[3],

            // Helmet quaternion (world-relative)
            HQX: helmetWorld[0],
            HQY: helmetWorld[1],
            HQZ: helmetWorld[2],
            HQW: helmetWorld[3],

            // Vehicle position and velocity
            VLAT: parseFloat(row.lat) || 0,
            VLON: parseFloat(row.lon) || 0,
            VALT: parseFloat(row.alt) || 0,
            VVN: parseFloat(vvn) || 0,
            VVE: parseFloat(vve) || 0,
            VVD: parseFloat(vvd) || 0,
            VINS: parseInt(row.mode) || 0,
            GSPEED: gspeed,
        };
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
     * Find the data index closest to a given timestamp (in seconds).
     * Uses binary search for O(log n) performance.
     */
    findIndexForTimestamp(timestampSeconds) {
        if (this.dataList.length === 0) {
            return null;
        }

        const targetNs = timestampSeconds * 1e9;

        // Binary search for closest timestamp
        let idx = this._bisectLeft(this.timestampNsList, targetNs);

        // Handle edge cases
        if (idx === 0) {
            return 0;
        } else if (idx >= this.timestampNsList.length) {
            return this.timestampNsList.length - 1;
        }

        // Check which of the two adjacent points is closer
        const prevDiff = Math.abs(this.timestampNsList[idx - 1] - targetNs);
        const nextDiff = Math.abs(this.timestampNsList[idx] - targetNs);

        if (prevDiff < nextDiff) {
            return idx - 1;
        } else {
            return idx;
        }
    }

    /**
     * Efficiently extract all lat/lon/alt data.
     * Returns dict with 'lats', 'lons', 'alts' lists.
     */
    getAllPathData() {
        const lats = this.dataList.map(d => parseFloat(d.row.lat) || 0);
        const lons = this.dataList.map(d => parseFloat(d.row.lon) || 0);
        const alts = this.dataList.map(d => parseFloat(d.row.alt) || 0);

        return {
            lats,
            lons,
            alts
        };
    }

    /**
     * Efficiently extract all attitude data (yaw, pitch, roll) from vehicle quaternions.
     * Returns dict with 'yaws', 'pitches', 'rolls' lists (in degrees).
     */
    getAllAttitudeData() {
        const yaws = [];
        const pitches = [];
        const rolls = [];

        for (const data of this.dataList) {
            const row = data.row;
            const vehicleWorld = quat.fromValues(
                row.x_vehicle || 0,
                row.y_vehicle || 0,
                row.z_vehicle || 0,
                row.w_vehicle || 1
            );

            const euler = this._quaternionToEuler(vehicleWorld);
            rolls.push(euler.roll);
            pitches.push(euler.pitch);
            yaws.push(euler.yaw);
        }

        return {
            yaws,
            pitches,
            rolls
        };
    }
}

module.exports = FlightDataProcessor;

