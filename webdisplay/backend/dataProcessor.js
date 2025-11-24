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
        console.log(`[DataProcessor] Loading data from ${this.dataFile}...`);
        
        // Check if file exists
        if (!fs.existsSync(this.dataFile)) {
            console.error(`[DataProcessor] ERROR: Data file not found: ${this.dataFile}`);
            this.dataList = [];
            return;
        }
        
        const fileContent = fs.readFileSync(this.dataFile, 'utf-8');
        console.log(`[DataProcessor] File size: ${fileContent.length} bytes`);
        
        const records = parse(fileContent, {
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

        // Only log errors
        if (records.length === 0) {
            console.error(`[DataProcessor] ERROR: No records parsed from CSV file!`);
        } else {
            const firstRecord = records[0];
            const columns = Object.keys(firstRecord);
            const requiredColumns = ['lat', 'lon', 'alt', 'x_vehicle', 'y_vehicle', 'z_vehicle', 'w_vehicle'];
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));
            if (missingColumns.length > 0) {
                console.error(`[DataProcessor] ERROR: Missing required columns: ${missingColumns.join(', ')}`);
                console.error(`[DataProcessor] Available columns: ${columns.join(', ')}`);
            }
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
        this.dataList.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

        // Pre-compute numeric timestamps for fast binary search
        this.timestampNsList = this.dataList.map(d => d.timestampNs);

        if (this.dataList.length === 0) {
            console.error(`[DataProcessor] ERROR: No data rows loaded! Check CSV file format.`);
        }
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
        if (this.dataList.length === 0) {
            console.error('[getAllPathData] ERROR: dataList is empty!');
            return { lats: [], lons: [], alts: [] };
        }
        
        // Memory-efficient extraction: use pre-allocated arrays
        const length = this.dataList.length;
        const lats = new Array(length);
        const lons = new Array(length);
        const alts = new Array(length);
        
        // Extract in single pass
        for (let i = 0; i < length; i++) {
            const row = this.dataList[i].row;
            lats[i] = parseFloat(row.lat) || 0;
            lons[i] = parseFloat(row.lon) || 0;
            alts[i] = parseFloat(row.alt) || 0;
        }
        
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
        const length = this.dataList.length;
        const yaws = new Array(length);
        const pitches = new Array(length);
        const rolls = new Array(length);

        if (length === 0) {
            console.error('[getAllAttitudeData] ERROR: dataList is empty');
            return { yaws: [], pitches: [], rolls: [] };
        }

        // Check first row for quaternion columns
        const firstRow = this.dataList[0].row;
        const hasVehicleQuat = firstRow.x_vehicle !== undefined && firstRow.x_vehicle !== null;
        
        if (!hasVehicleQuat) {
            console.error('[getAllAttitudeData] ERROR: No vehicle quaternion data found');
            return { yaws: [], pitches: [], rolls: [] };
        }

        // Memory-efficient extraction: pre-allocated arrays, single pass
        let errorCount = 0;
        for (let i = 0; i < length; i++) {
            const row = this.dataList[i].row;
            
            try {
                const vehicleWorld = quat.fromValues(
                    parseFloat(row.x_vehicle) || 0,
                    parseFloat(row.y_vehicle) || 0,
                    parseFloat(row.z_vehicle) || 0,
                    parseFloat(row.w_vehicle) || 1
                );

                const euler = this._quaternionToEuler(vehicleWorld);
                rolls[i] = euler.roll;
                pitches[i] = euler.pitch;
                yaws[i] = euler.yaw;
            } catch (error) {
                errorCount++;
                // Push default values
                rolls[i] = 0;
                pitches[i] = 0;
                yaws[i] = 0;
            }
        }

        if (errorCount > 0 && errorCount <= 10) {
            console.warn(`[getAllAttitudeData] ${errorCount} errors during extraction`);
        }

        return {
            yaws,
            pitches,
            rolls
        };
    }
}

module.exports = FlightDataProcessor;

