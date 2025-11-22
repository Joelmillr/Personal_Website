#!/usr/bin/env node
/**
 * Quick Supabase Setup Script
 * This will help you set up your Supabase database quickly
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://evqkatxibpkitspjjpmo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cWthdHhpYnBraXRzcGpqcG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MjE4MTEsImV4cCI6MjA3OTM5NzgxMX0.Rl6x_mc0HaGtFusy9DvtgPSP_flgug9mBJgGHG2ygbQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('flight_data').select('count').limit(1);
    
    if (error && error.code === '42P01') {
        console.log('❌ Table does not exist yet. You need to run the schema.sql first.');
        console.log('\nNext steps:');
        console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/evqkatxibpkitspjjpmo');
        console.log('2. Click on "SQL Editor"');
        console.log('3. Copy and paste the contents of webdisplay/supabase/schema.sql');
        console.log('4. Click "Run"');
        console.log('5. Then run: node webdisplay/supabase/import-csv.js');
        return false;
    } else if (error) {
        console.error('❌ Connection error:', error.message);
        return false;
    } else {
        console.log('✅ Connection successful!');
        return true;
    }
}

testConnection().then(success => {
    if (success) {
        console.log('\n✅ Your Supabase is ready!');
        console.log('\nTo import your CSV data, run:');
        console.log('  node webdisplay/supabase/import-csv.js');
    }
    process.exit(success ? 0 : 1);
});

