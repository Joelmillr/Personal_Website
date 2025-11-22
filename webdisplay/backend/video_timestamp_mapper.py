"""
Video timestamp mapping utility
Converts flight data timestamps to YouTube video times using the timestamp mapping file
"""
import json
from pathlib import Path
from bisect import bisect_left

class VideoTimestampMapper:
    """Maps flight data timestamps to video times"""
    
    def __init__(self, timestamp_map_file=None):
        self.timestamps = []  # List of (data_timestamp, video_time) tuples
        self.data_timestamps = []  # Sorted list of data timestamps for binary search
        self.video_times = []  # Corresponding video times
        
        if timestamp_map_file and Path(timestamp_map_file).exists():
            self.load_mapping(timestamp_map_file)
    
    def load_mapping(self, timestamp_map_file):
        """Load timestamp mapping from JSON file"""
        try:
            with open(timestamp_map_file, 'r') as f:
                mapping = json.load(f)
                # Create sorted list of (data_timestamp, video_time) tuples
                self.timestamps = sorted([(entry['data_timestamp'], entry['video_time']) 
                                         for entry in mapping])
                self.data_timestamps = [ts[0] for ts in self.timestamps]
                self.video_times = [ts[1] for ts in self.timestamps]
                # Also create sorted list by video_time for reverse lookup
                self.timestamps_by_video = sorted(self.timestamps, key=lambda x: x[1])
                self.video_times_sorted = [ts[1] for ts in self.timestamps_by_video]
                self.data_timestamps_by_video = [ts[0] for ts in self.timestamps_by_video]
                return True
        except Exception as e:
            print(f"Error loading video timestamp mapping: {e}")
            return False
    
    def data_to_video_time(self, data_timestamp):
        """
        Convert flight data timestamp to video time using interpolation
        
        Args:
            data_timestamp: Flight data timestamp in seconds
            
        Returns:
            Video time in seconds, or None if mapping not available
        """
        if not self.timestamps:
            return None
        
        # Binary search for closest timestamp
        idx = bisect_left(self.data_timestamps, data_timestamp)
        
        # Handle edge cases
        if idx == 0:
            # Before first timestamp - use first mapping
            return self.video_times[0]
        elif idx >= len(self.timestamps):
            # After last timestamp - use last mapping
            return self.video_times[-1]
        
        # Interpolate between two points
        prev_data_ts, prev_video_ts = self.timestamps[idx - 1]
        next_data_ts, next_video_ts = self.timestamps[idx]
        
        # If exact match
        if prev_data_ts == data_timestamp:
            return prev_video_ts
        if next_data_ts == data_timestamp:
            return next_video_ts
        
        # Linear interpolation
        if next_data_ts == prev_data_ts:
            return prev_video_ts
        
        ratio = (data_timestamp - prev_data_ts) / (next_data_ts - prev_data_ts)
        video_time = prev_video_ts + ratio * (next_video_ts - prev_video_ts)
        
        return video_time
    
    def video_to_data_time(self, video_time):
        """
        Convert video time to flight data timestamp using interpolation (reverse mapping)
        
        Args:
            video_time: Video time in seconds
            
        Returns:
            Flight data timestamp in seconds, or None if mapping not available
        """
        if not self.timestamps or not hasattr(self, 'timestamps_by_video'):
            return None
        
        # Binary search for closest video time
        idx = bisect_left(self.video_times_sorted, video_time)
        
        # Handle edge cases
        if idx == 0:
            # Before first video time - use first mapping
            return self.data_timestamps_by_video[0]
        elif idx >= len(self.timestamps_by_video):
            # After last video time - use last mapping
            return self.data_timestamps_by_video[-1]
        
        # Interpolate between two points
        prev_data_ts, prev_video_ts = self.timestamps_by_video[idx - 1]
        next_data_ts, next_video_ts = self.timestamps_by_video[idx]
        
        # If exact match
        if prev_video_ts == video_time:
            return prev_data_ts
        if next_video_ts == video_time:
            return next_data_ts
        
        # Linear interpolation
        if next_video_ts == prev_video_ts:
            return prev_data_ts
        
        ratio = (video_time - prev_video_ts) / (next_video_ts - prev_video_ts)
        data_timestamp = prev_data_ts + ratio * (next_data_ts - prev_data_ts)
        
        return data_timestamp
    
    def is_available(self):
        """Check if mapping is available"""
        return len(self.timestamps) > 0




