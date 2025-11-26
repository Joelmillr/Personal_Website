/**
 * Pre-process CSV data into a faster format (JSON) for faster loading
 * Run this once after CSV changes: node flight-display/server/preprocessData.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_FILE = path.join(__dirname, '..', 'merged_data.csv');
const JSON_FILE = path.join(__dirname, '..', 'merged_data.json');
const JSON_GZIP_FILE = path.join(__dirname, '..', 'merged_data.json.gz');

function preprocessCSV() {
    console.log('Starting CSV preprocessing...');
    console.log(`Input: ${CSV_FILE}`);
    console.log(`Output: ${JSON_FILE}`);
    
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`ERROR: CSV file not found: ${CSV_FILE}`);
        process.exit(1);
    }
    
    // Read and parse CSV
    console.log('Reading CSV file...');
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    console.log(`File size: ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`);
    
    console.log('Parsing CSV...');
    const parseStart = Date.now();
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
            if (context.column === 'timestamp') {
                return value; // Keep as string
            }
            const num = parseFloat(value);
            return (!isNaN(num) && isFinite(num)) ? num : value;
        }
    });
    const parseTime = Date.now() - parseStart;
    console.log(`Parsed ${records.length} records in ${parseTime}ms`);
    
    // Process timestamps
    console.log('Processing timestamps...');
    const processStart = Date.now();
    const processed = records.map((row, index) => {
        let timestampSeconds = 0;
        if (typeof row.timestamp === 'string') {
            const tdMatch = row.timestamp.match(/(\d+) days?\s+(\d+):(\d+):([\d.]+)/);
            if (tdMatch) {
                const days = parseInt(tdMatch[1]) || 0;
                const hours = parseInt(tdMatch[2]) || 0;
                const minutes = parseInt(tdMatch[3]) || 0;
                const seconds = parseFloat(tdMatch[4]) || 0;
                timestampSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
            } else {
                timestampSeconds = parseFloat(row.timestamp) || 0;
            }
        } else {
            timestampSeconds = parseFloat(row.timestamp) || 0;
        }
        
        return {
            index,
            timestampSeconds,
            timestampNs: timestampSeconds * 1e9,
            row
        };
    });
    
    // Sort by timestamp
    processed.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    const processTime = Date.now() - processStart;
    console.log(`Processed and sorted in ${processTime}ms`);
    
    // Write JSON
    console.log('Writing JSON file...');
    const writeStart = Date.now();
    fs.writeFileSync(JSON_FILE, JSON.stringify(processed), 'utf-8');
    const writeTime = Date.now() - writeStart;
    const jsonSize = fs.statSync(JSON_FILE).size;
    console.log(`Written ${(jsonSize / 1024 / 1024).toFixed(2)}MB in ${writeTime}ms`);
    
    console.log('\n✅ Preprocessing complete!');
    console.log(`Total time: ${Date.now() - parseStart}ms`);
    console.log(`\nJSON file created: ${JSON_FILE}`);
    console.log(`The JSON file will be used automatically if it exists (generated during build on Render)`);
}

if (require.main === module) {
    preprocessCSV();
}

module.exports = { preprocessCSV };

