#!/usr/bin/env node
/**
 * Import CSV data into Supabase
 * 
 * Usage:
 *   node import-csv.js
 * 
 * Requires environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_KEY - Your Supabase anon/service key
 *   CSV_FILE - Path to merged_data.csv (default: ../merged_data.csv)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const { quat, mat4, vec3 } = require('gl-matrix');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://evqkatxibpkitspjjpmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cWthdHhpYnBraXRzcGpqcG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MjE4MTEsImV4cCI6MjA3OTM5NzgxMX0.Rl6x_mc0HaGtFusy9DvtgPSP_flgug9mBJgGHG2ygbQ';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY must be set');
    console.error('   Get these from your Supabase project settings');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CSV file path
const csvFile = process.env.CSV_FILE || path.join(__dirname, '..', 'merged_data.csv');

if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: CSV file not found: ${csvFile}`);
    process.exit(1);
}

console.log('========================================');
console.log('Supabase CSV Import Script');
console.log('========================================');
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`CSV File: ${csvFile}`);
console.log('========================================\n');

// Helper function to parse timestamp
function parseTimestamp(timestamp) {
    if (typeof timestamp === 'string') {
        const tdMatch = timestamp.match(/(\d+) days?\s+(\d+):(\d+):([\d.]+)/);
        if (tdMatch) {
            const days = parseInt(tdMatch[1]) || 0;
            const hours = parseInt(tdMatch[2]) || 0;
            const minutes = parseInt(tdMatch[3]) || 0;
            const seconds = parseFloat(tdMatch[4]) || 0;
            return days * 86400 + hours * 3600 + minutes * 60 + seconds;
        }
        return parseFloat(timestamp) || 0;
    }
    return parseFloat(timestamp) || 0;
}

// Helper function to calculate quaternions and derived values (same as dataProcessor.js)
function calculateDerivedValues(row) {
    // Vehicle quaternion
    const vehicleLocal = quat.fromValues(
        row.x_vehicle || 0,
        row.y_vehicle || 0,
        row.z_vehicle || 0,
        row.w_vehicle || 1
    );

    // Helmet quaternion
    const helmetLocal = quat.fromValues(
        row.x_helmet || 0,
        row.y_helmet || 0,
        row.z_helmet || 0,
        row.w_helmet || 1
    );

    // Convert to world coordinates (same logic as dataProcessor)
    const vehicleWorld = quat.clone(vehicleLocal);
    const helmetWorld = quat.multiply(quat.create(), vehicleLocal, helmetLocal);

    // Calculate ground speed
    const vvn = row.north || 0;
    const vve = row.east || 0;
    const vvd = row.down || 0;
    const gspeed = Math.sqrt(vvn * vvn + vve * vve + vvd * vvd);

    return {
        vqx: vehicleWorld[0],
        vqy: vehicleWorld[1],
        vqz: vehicleWorld[2],
        vqw: vehicleWorld[3],
        hqx: helmetWorld[0],
        hqy: helmetWorld[1],
        hqz: helmetWorld[2],
        hqw: helmetWorld[3],
        valt: parseFloat(row.alt) || 0,
        vlats: parseFloat(row.lat) || 0,
        vlons: parseFloat(row.lon) || 0,
        gspeed: gspeed,
        vins: parseInt(row.mode) || 0
    };
}

async function importCSV() {
    try {
        console.log('📖 Reading CSV file...');
        const fileContent = fs.readFileSync(csvFile, 'utf-8');
        const fileSizeMB = (fileContent.length / 1024 / 1024).toFixed(2);
        console.log(`   File size: ${fileSizeMB} MB\n`);

        console.log('📊 Parsing CSV...');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
        console.log(`   Found ${records.length} records\n`);

        console.log('🔄 Processing records...');
        const processedRecords = [];
        const batchSize = 1000; // Insert in batches

        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            const timestampSeconds = parseTimestamp(row.timestamp);
            const derived = calculateDerivedValues(row);

            processedRecords.push({
                index: i,
                timestamp_seconds: timestampSeconds,
                timestamp_ns: Math.round(timestampSeconds * 1e9),
                timestamp: row.timestamp,
                lat: row.lat ? parseFloat(row.lat) : null,
                lon: row.lon ? parseFloat(row.lon) : null,
                alt: row.alt ? parseFloat(row.alt) : null,
                x_vehicle: row.x_vehicle ? parseFloat(row.x_vehicle) : null,
                y_vehicle: row.y_vehicle ? parseFloat(row.y_vehicle) : null,
                z_vehicle: row.z_vehicle ? parseFloat(row.z_vehicle) : null,
                w_vehicle: row.w_vehicle ? parseFloat(row.w_vehicle) : null,
                x_helmet: row.x_helmet ? parseFloat(row.x_helmet) : null,
                y_helmet: row.y_helmet ? parseFloat(row.y_helmet) : null,
                z_helmet: row.z_helmet ? parseFloat(row.z_helmet) : null,
                w_helmet: row.w_helmet ? parseFloat(row.w_helmet) : null,
                north: row.north ? parseFloat(row.north) : null,
                east: row.east ? parseFloat(row.east) : null,
                down: row.down ? parseFloat(row.down) : null,
                mode: row.mode ? parseInt(row.mode) : null,
                ...derived
            });

            // Show progress
            if ((i + 1) % 10000 === 0) {
                console.log(`   Processed ${i + 1}/${records.length} records...`);
            }
        }

        console.log(`✓ Processed ${processedRecords.length} records\n`);

        console.log('🗑️  Clearing existing data...');
        const { error: deleteError } = await supabase
            .from('flight_data')
            .delete()
            .neq('id', 0); // Delete all records

        if (deleteError) {
            console.warn(`   Warning: ${deleteError.message}`);
        } else {
            console.log('✓ Cleared existing data\n');
        }

        console.log('💾 Inserting data into Supabase...');
        console.log(`   Batch size: ${batchSize} records\n`);

        let inserted = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds between retries

        for (let i = 0; i < processedRecords.length; i += batchSize) {
            const batch = processedRecords.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            let retries = 0;
            let success = false;

            while (retries < maxRetries && !success) {
                try {
                    const { data, error } = await supabase
                        .from('flight_data')
                        .insert(batch);

                    if (error) {
                        throw error;
                    }

                    inserted += batch.length;
                    const progress = ((inserted / processedRecords.length) * 100).toFixed(1);
                    console.log(`   Inserted ${inserted}/${processedRecords.length} records (${progress}%)...`);
                    success = true;

                    // Small delay between batches to avoid rate limiting
                    if (i + batchSize < processedRecords.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    retries++;
                    if (retries >= maxRetries) {
                        console.error(`❌ Error inserting batch ${batchNumber} after ${maxRetries} retries:`, error.message);
                        console.error(`   Last successful batch: ${inserted} records`);
                        console.error(`   You can resume by running the script again (it will clear and restart)`);
                        throw error;
                    } else {
                        console.warn(`⚠ Retry ${retries}/${maxRetries} for batch ${batchNumber}...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
                    }
                }
            }
        }

        console.log('\n========================================');
        console.log('✅ Import completed successfully!');
        console.log(`   Total records: ${inserted}`);
        console.log('========================================');

    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run import
importCSV();

