/**
 * Supabase-based Flight Data Processor
 * Queries flight data from Supabase instead of loading CSV into memory
 */

const { createClient } = require('@supabase/supabase-js');
const { quat } = require('gl-matrix');

class SupabaseFlightDataProcessor {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.dataCount = null; // Will be loaded on first query
        this.cache = new Map(); // Cache for frequently accessed data
        this.cacheSize = 1000; // Max cache size
    }

    /**
     * Get total number of data points
     */
    async getDataCount() {
        if (this.dataCount !== null) {
            return this.dataCount;
        }
        
        const { count, error } = await this.supabase
            .from('flight_data')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            throw new Error(`Failed to get data count: ${error.message}`);
        }
        
        this.dataCount = count || 0;
        return this.dataCount;
    }

    /**
     * Get data at a specific index
     */
    async getDataAtIndex(index) {
        // Check cache first
        if (this.cache.has(index)) {
            return this.cache.get(index);
        }
        
        const { data, error } = await this.supabase
            .from('flight_data')
            .select('*')
            .eq('index', index)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get data at index ${index}: ${error.message}`);
        }
        
        if (!data) {
            return null;
        }
        
        // Convert to expected format
        const result = this._formatDataRow(data);
        
        // Cache it
        if (this.cache.size >= this.cacheSize) {
            // Remove oldest entry (simple FIFO)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(index, result);
        
        return result;
    }

    /**
     * Find index for a given timestamp (binary search)
     */
    async findIndexForTimestamp(timestampSeconds) {
        const { data, error } = await this.supabase
            .from('flight_data')
            .select('index')
            .lte('timestamp_seconds', timestampSeconds)
            .order('timestamp_seconds', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !data) {
            return null;
        }
        
        return data.index;
    }

    /**
     * Get all path data (lat, lon, alt) - optimized query
     */
    async getAllPathData() {
        const { data, error } = await this.supabase
            .from('flight_data')
            .select('vlats, vlons, valt')
            .order('index', { ascending: true });
        
        if (error) {
            throw new Error(`Failed to get path data: ${error.message}`);
        }
        
        return {
            lats: data.map(row => row.vlats || 0),
            lons: data.map(row => row.vlons || 0),
            alts: data.map(row => row.valt || 0)
        };
    }

    /**
     * Get all attitude data (yaw, pitch, roll)
     */
    async getAllAttitudeData() {
        const { data, error } = await this.supabase
            .from('flight_data')
            .select('vqx, vqy, vqz, vqw, hqx, hqy, hqz, hqw')
            .order('index', { ascending: true });
        
        if (error) {
            throw new Error(`Failed to get attitude data: ${error.message}`);
        }
        
        const yaws = [];
        const pitches = [];
        const rolls = [];
        
        for (const row of data) {
            const vehicleQ = [row.vqx || 0, row.vqy || 0, row.vqz || 0, row.vqw || 1];
            const euler = this._quaternionToEuler(vehicleQ);
            yaws.push(euler.yaw);
            pitches.push(euler.pitch);
            rolls.push(euler.roll);
        }
        
        return { yaws, pitches, rolls };
    }

    /**
     * Get summary of data
     */
    async getSummary() {
        const count = await this.getDataCount();
        
        if (count === 0) {
            return {
                data_count: 0,
                data_columns: []
            };
        }
        
        // Get first row to determine columns
        const { data, error } = await this.supabase
            .from('flight_data')
            .select('*')
            .limit(1)
            .single();
        
        if (error || !data) {
            return {
                data_count: count,
                data_columns: []
            };
        }
        
        return {
            data_count: count,
            data_columns: Object.keys(data)
        };
    }

    /**
     * Convert quaternion to Euler angles
     */
    _quaternionToEuler(q) {
        const [x, y, z, w] = q;
        
        const sinr_cosp = 2 * (w * x + y * z);
        const cosr_cosp = 1 - 2 * (x * x + y * y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);

        const sinp = 2 * (w * y - z * x);
        let pitch;
        if (Math.abs(sinp) >= 1) {
            pitch = Math.sign(sinp) * Math.PI / 2;
        } else {
            pitch = Math.asin(sinp);
        }

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
     * Format database row to match expected data structure
     */
    _formatDataRow(row) {
        return {
            index: row.index,
            timestamp_seconds: row.timestamp_seconds,
            VQX: row.vqx || 0,
            VQY: row.vqy || 0,
            VQZ: row.vqz || 0,
            VQW: row.vqw || 1,
            HQX: row.hqx || 0,
            HQY: row.hqy || 0,
            HQZ: row.hqz || 0,
            HQW: row.hqw || 1,
            VLAT: row.vlats || 0,
            VLON: row.vlons || 0,
            VALT: row.valt || 0,
            GSPEED: row.gspeed || 0,
            VINS: row.vins || 0
        };
    }
}

module.exports = SupabaseFlightDataProcessor;

