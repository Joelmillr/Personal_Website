"""
Data processing module for flight test data.
Handles CSV loading, quaternion calculations, and frame matching.
"""
import os
import pandas as pd
import math
from pathlib import Path
from bisect import bisect_left
from scipy.spatial.transform import Rotation

class FlightDataProcessor:
    """Processes flight test data and provides access methods"""
    
    def __init__(self, data_file, frames_directory=None):
        """
        Initialize processor with data file.
        
        Args:
            data_file: Path to merged_data.csv
            frames_directory: Optional - not used anymore (kept for backward compatibility)
        """
        self.data_file = Path(data_file)
        
        # Load and process data
        self._load_data()
        
    def _load_data(self):
        """Load and process the merged_data.csv file"""
        print(f"Loading data from {self.data_file}...")
        self.merged_data = pd.read_csv(self.data_file)
        
        # Robust timestamp parsing
        ts_as_td = pd.to_timedelta(self.merged_data['timestamp'], errors='coerce')
        if ts_as_td.isna().all():
            # Fallback: treat as numeric seconds
            sec = pd.to_numeric(self.merged_data['timestamp'], errors='coerce')
            ts_as_td = pd.to_timedelta(sec, unit='s', errors='coerce')
        
        self.merged_data['timestamp'] = ts_as_td
        self.merged_data = self.merged_data.dropna(subset=['timestamp'])
        self.merged_data.set_index('timestamp', inplace=True)
        
        # Convert to list for easier access
        self.data_list = list(self.merged_data.iterrows())
        
        # CRITICAL: Pre-compute numeric timestamps for fast binary search
        # This avoids converting timedelta to seconds on every lookup
        self.timestamp_ns_list = [idx.value for idx, _ in self.data_list]
        
        print(f"Loaded {len(self.data_list)} data rows")
        
    def get_summary(self):
        """Get summary of loaded data"""
        return {
            'data_count': len(self.data_list),
            'data_columns': list(self.merged_data.columns)
        }
    
    def get_data_count(self):
        """Get total number of data points"""
        return len(self.data_list)
    
    def get_data_at_index(self, index):
        """
        Get flight data at a specific index.
        Returns dict with all relevant data including quaternions.
        """
        if index < 0 or index >= len(self.data_list):
            return None
        
        idx, row = self.data_list[index]
        timestamp = idx  # pandas Timedelta
        
        # Calculate quaternions (same logic as playback.py)
        helmet_corrected = Rotation.from_quat([
            row['x_helmet'], row['y_helmet'], row['z_helmet'], row['w_helmet']
        ])
        vehicle_world = Rotation.from_quat([
            row['x_vehicle'], row['y_vehicle'], row['z_vehicle'], row['w_vehicle']
        ])
        helmet_world = vehicle_world * helmet_corrected
        
        vqx, vqy, vqz, vqw = vehicle_world.as_quat()
        hqx, hqy, hqz, hqw = helmet_world.as_quat()
        
        # Calculate ground speed
        vvn = row['north']
        vve = row['east']
        vvd = row['down']
        gspeed = math.sqrt(vvn**2 + vve**2 + vvd**2)
        
        return {
            'index': index,
            'timestamp_seconds': timestamp.total_seconds(),
            'timestamp_ns': timestamp.value,
            
            # Vehicle quaternion (world-relative)
            'VQX': float(vqx),
            'VQY': float(vqy),
            'VQZ': float(vqz),
            'VQW': float(vqw),
            
            # Helmet quaternion (world-relative)
            'HQX': float(hqx),
            'HQY': float(hqy),
            'HQZ': float(hqz),
            'HQW': float(hqw),
            
            # Vehicle position and velocity
            'VLAT': float(row['lat']),
            'VLON': float(row['lon']),
            'VALT': float(row['alt']),
            'VVN': float(vvn),
            'VVE': float(vve),
            'VVD': float(vvd),
            'VINS': int(row['mode']) if 'mode' in row else 0,
            'GSPEED': float(gspeed),
        }
    
    def find_index_for_timestamp(self, timestamp_seconds):
        """
        Find the data index closest to a given timestamp (in seconds).
        Uses binary search for O(log n) performance instead of O(n) linear search.
        """
        if not self.data_list:
            return None
        
        # Ensure timestamp_ns_list exists (for backward compatibility with old instances)
        if not hasattr(self, 'timestamp_ns_list') or not self.timestamp_ns_list:
            # Fallback: create it now if it doesn't exist
            self.timestamp_ns_list = [idx.value for idx, _ in self.data_list]
        
        # Convert target timestamp to nanoseconds for comparison
        target_td = pd.to_timedelta(timestamp_seconds, unit='s')
        target_ns = target_td.value
        
        # Binary search for closest timestamp
        # bisect_left finds the insertion point, which gives us the closest index
        idx = bisect_left(self.timestamp_ns_list, target_ns)
        
        # Handle edge cases
        if idx == 0:
            return 0
        elif idx >= len(self.timestamp_ns_list):
            return len(self.timestamp_ns_list) - 1
        
        # Check which of the two adjacent points is closer
        prev_diff = abs(self.timestamp_ns_list[idx - 1] - target_ns)
        next_diff = abs(self.timestamp_ns_list[idx] - target_ns)
        
        if prev_diff < next_diff:
            return idx - 1
        else:
            return idx
    
    def get_all_path_data(self):
        """
        Efficiently extract all lat/lon/alt data (like playback.py lines 202-204).
        Returns dict with 'lats', 'lons', 'alts' lists.
        """
        # Fast list comprehension over already-loaded data
        lats = [row['lat'] for _, row in self.data_list]
        lons = [row['lon'] for _, row in self.data_list]
        alts = [row['alt'] for _, row in self.data_list]
        
        return {
            'lats': lats,
            'lons': lons,
            'alts': alts
        }
    
    def get_all_attitude_data(self):
        """
        Efficiently extract all attitude data (yaw, pitch, roll) from vehicle quaternions.
        Returns dict with 'yaws', 'pitches', 'rolls' lists (in degrees).
        """
        yaws = []
        pitches = []
        rolls = []
        
        for _, row in self.data_list:
            # Calculate vehicle quaternion (same as get_data_at_index)
            vehicle_world = Rotation.from_quat([
                row['x_vehicle'], row['y_vehicle'], row['z_vehicle'], row['w_vehicle']
            ])
            
            # Convert quaternion to Euler angles (in radians)
            # scipy uses 'xyz' convention: roll (x), pitch (y), yaw (z)
            euler = vehicle_world.as_euler('xyz', degrees=False)
            
            # Extract and convert to degrees
            roll = math.degrees(euler[0])   # Roll (x-axis rotation)
            pitch = math.degrees(euler[1])   # Pitch (y-axis rotation)
            yaw = math.degrees(euler[2])     # Yaw (z-axis rotation)
            
            pitches.append(pitch)
            rolls.append(roll)
            yaws.append(yaw)
        
        return {
            'yaws': yaws,
            'pitches': pitches,
            'rolls': rolls
        }

