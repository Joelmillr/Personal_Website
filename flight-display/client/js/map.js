/**
 * Map viewer using Leaflet.js
 */
class MapViewer {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.pathLayer = null;
        this.traveledPathLayer = null;
        this.currentMarker = null;
        this.allLatLngs = [];
        this.traveledLatLngs = [];
        this.completePathData = [];  // Store complete path like playback.py
        this.currentIndex = 0;
    }
    
    initialize(bounds = null, completePath = null, startIndex = 0) {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Map container with id '${this.containerId}' not found`);
            return;
        }
        
        // Initialize map
        let center = [0, 0];
        let zoom = 13;
        
        if (bounds) {
            // Calculate center from bounds
            center = [
                (bounds.min_lat + bounds.max_lat) / 2,
                (bounds.min_lon + bounds.max_lon) / 2
            ];
        }
        
        this.map = L.map(this.containerId, {
            center: center,
            zoom: zoom,
            zoomControl: true,
            attributionControl: true
        });
        
        if (bounds) {
            // Fit to bounds
            this.map.fitBounds([
                [bounds.min_lat, bounds.min_lon],
                [bounds.max_lat, bounds.max_lon]
            ], { padding: [20, 20] });
        }
        
        // Add tile layer (using OpenStreetMap, can be changed to satellite)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Initialize layers
        this.traveledPathLayer = L.layerGroup().addTo(this.map);
        
        // Store complete path data (like playback.py's all_lats, all_lons)
        if (completePath && completePath.length > 0) {
            this.completePathData = completePath;
            this.startIndex = startIndex;  // Index to start displaying from (e.g., takeoff)
            console.log(`Preloaded complete path with ${completePath.length} points, starting from index ${startIndex}`);
        } else {
            this.completePathData = [];
            this.startIndex = 0;
        }
        
        // Build path incrementally (like playback.py)
        this.traveledLatLngs = [];
        
        // Create marker for current position
        this.currentMarker = L.circleMarker([0, 0], {
            radius: 8,
            fillColor: '#ff0000',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        console.log('Map initialized successfully');
    }
    
    setCompletePath(lats, lons) {
        // Store all coordinates
        this.allLatLngs = lats.map((lat, i) => [lat, lons[i]]);
        
        // Draw complete path in gray
        if (this.pathLayer) {
            this.pathLayer.clearLayers();
            const path = L.polyline(this.allLatLngs, {
                color: '#888888',
                weight: 2,
                opacity: 0.5
            });
            this.pathLayer.addLayer(path);
        }
        
        // Fit map to bounds
        if (this.allLatLngs.length > 0) {
            this.map.fitBounds(this.allLatLngs);
        }
    }
    
    updatePosition(lat, lon, alt, index, forceUpdate = false) {
        if (!this.map) {
            return;
        }
        
        // Use preloaded complete path data and slice to current_index (like playback.py)
        if (this.completePathData && this.completePathData.length > 0) {
            // Only show data from startIndex (takeoff) onwards
            if (index < this.startIndex) {
                return;  // Don't display anything before takeoff
            }
            
            // Only update if index actually changed (prevents updates when paused)
            if (index === this.currentIndex && !forceUpdate) {
                // Still update marker position in case of floating point drift
                if (this.currentMarker) {
                    this.currentMarker.setLatLng([lat, lon]);
                }
                return; // Same index, no path update needed
            }
            // Slice from startIndex to current index
            const startSlice = this.startIndex;
            const maxPoints = Math.min(index + 1, this.completePathData.length);
            const traveledPoints = this.completePathData.slice(startSlice, maxPoints);
            
            // Update the last point with current position for accuracy
            if (traveledPoints.length > 0) {
                traveledPoints[traveledPoints.length - 1] = {"lat": lat, "lon": lon, "alt": alt, "index": index};
            }
            
            // Convert to lat/lng array for Leaflet
            const traveledLatLngs = traveledPoints.map(p => [p.lat, p.lon]);
            
            // Always update current marker position (smooth movement)
            if (this.currentMarker) {
                this.currentMarker.setLatLng([lat, lon]);
            }
            
            // Update traveled path line (throttled to every 5 calls to reduce load)
            // Always update on significant index changes (seeks/jumps)
            if (!this._updateCounter) this._updateCounter = 0;
            if (!this._lastIndex) this._lastIndex = index;
            const indexJumped = Math.abs(index - this._lastIndex) > 50;
            this._updateCounter++;
            this._lastIndex = index;
            
            // Update path on first call, significant jumps, or every 5 calls
            if ((this._updateCounter === 1 || this._updateCounter % 5 === 0 || indexJumped) && this.traveledPathLayer) {
                this.traveledPathLayer.clearLayers();
                if (traveledLatLngs.length > 1) {
                    const traveledPath = L.polyline(traveledLatLngs, {
                        color: '#4a9eff',
                        weight: 3,
                        opacity: 0.9,
                        lineJoin: 'round',
                        lineCap: 'round'
                    });
                    this.traveledPathLayer.addLayer(traveledPath);
                }
            }
        } else {
            // Fallback: build incrementally if complete path not available
            if (index < this.currentIndex) {
                this.traveledLatLngs = [];
            }
            if (index >= this.traveledLatLngs.length) {
                this.traveledLatLngs.push([lat, lon]);
            } else {
                this.traveledLatLngs[index] = [lat, lon];
            }
            if (index % 50 === 0 && this.traveledPathLayer && this.traveledLatLngs.length > 1) {
                this.traveledPathLayer.clearLayers();
                const traveledPath = L.polyline(this.traveledLatLngs, {
                    color: '#4a9eff',
                    weight: 3,
                    opacity: 0.9,
                    lineJoin: 'round',
                    lineCap: 'round'
                });
                this.traveledPathLayer.addLayer(traveledPath);
            }
        }
        
        this.currentIndex = index;
    }
    
    setCompletePath(completePath) {
        // Store complete path data (like playback.py's all_lats, all_lons)
        this.completePathData = completePath;
        console.log(`Set complete path with ${completePath.length} points`);
    }
    
    // Method to rebuild path from array of points (useful when jumping)
    rebuildPathFromPoints(points) {
        if (!this.map) return;
        
        // Clear and rebuild traveled path
        this.traveledLatLngs = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point && (point.lat !== undefined && point.lon !== undefined)) {
                this.traveledLatLngs.push([point.lat, point.lon]);
            } else if (point && Array.isArray(point) && point.length >= 2) {
                this.traveledLatLngs.push([point[0], point[1]]);
            }
        }
        
        // Redraw the path
        if (this.traveledPathLayer) {
            this.traveledPathLayer.clearLayers();
            if (this.traveledLatLngs.length > 1) {
                const traveledPath = L.polyline(this.traveledLatLngs, {
                    color: '#4a9eff',
                    weight: 3,
                    opacity: 0.9,
                    lineJoin: 'round',
                    lineCap: 'round'
                });
                this.traveledPathLayer.addLayer(traveledPath);
            }
        }
        
        // Update map view to show the path
        if (this.traveledLatLngs.length > 0) {
            const lastPoint = this.traveledLatLngs[this.traveledLatLngs.length - 1];
            this.map.setView(lastPoint, this.map.getZoom());
        }
        
        console.log(`Rebuilt path with ${this.traveledLatLngs.length} points`);
    }
    
    reset() {
        this.traveledLatLngs = [];
        this.currentIndex = 0;
        if (this.traveledPathLayer) {
            this.traveledPathLayer.clearLayers();
        }
    }
}

