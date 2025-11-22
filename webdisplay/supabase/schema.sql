-- Flight Test Data Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Create the flight_data table
CREATE TABLE IF NOT EXISTS flight_data (
    id BIGSERIAL PRIMARY KEY,
    index INTEGER NOT NULL,
    timestamp_seconds DOUBLE PRECISION NOT NULL,
    timestamp_ns BIGINT NOT NULL,
    
    -- Raw CSV columns
    timestamp TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    alt DOUBLE PRECISION,
    x_vehicle DOUBLE PRECISION,
    y_vehicle DOUBLE PRECISION,
    z_vehicle DOUBLE PRECISION,
    w_vehicle DOUBLE PRECISION,
    x_helmet DOUBLE PRECISION,
    y_helmet DOUBLE PRECISION,
    z_helmet DOUBLE PRECISION,
    w_helmet DOUBLE PRECISION,
    north DOUBLE PRECISION,
    east DOUBLE PRECISION,
    down DOUBLE PRECISION,
    mode INTEGER,
    
    -- Computed/derived columns (can be calculated on-the-fly or stored)
    vqx DOUBLE PRECISION,
    vqy DOUBLE PRECISION,
    vqz DOUBLE PRECISION,
    vqw DOUBLE PRECISION,
    hqx DOUBLE PRECISION,
    hqy DOUBLE PRECISION,
    hqz DOUBLE PRECISION,
    hqw DOUBLE PRECISION,
    valt DOUBLE PRECISION,
    vlats DOUBLE PRECISION,
    vlons DOUBLE PRECISION,
    gspeed DOUBLE PRECISION,
    vins INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_flight_data_timestamp_seconds ON flight_data(timestamp_seconds);
CREATE INDEX IF NOT EXISTS idx_flight_data_timestamp_ns ON flight_data(timestamp_ns);
CREATE INDEX IF NOT EXISTS idx_flight_data_index ON flight_data(index);

-- Enable Row Level Security (RLS) - allow public read access
ALTER TABLE flight_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON flight_data
    FOR SELECT
    USING (true);

-- Create policy to allow authenticated users to insert (for import script)
CREATE POLICY "Allow authenticated insert" ON flight_data
    FOR INSERT
    WITH CHECK (true);

