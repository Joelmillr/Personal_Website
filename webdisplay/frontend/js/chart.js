/**
 * Altitude chart using Chart.js
 */
class ChartViewer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.chart = null;
        this.allAlts = [];  // Complete altitude profile (preloaded, not drawn)
        this.completeAltitudes = [];  // Store complete altitudes like playback.py's all_alts
        this.traveledAlts = [];
        this.currentIndex = 0;
    }
    
    initialize(completeAltitudes = null, startIndex = 0) {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${this.canvasId}' not found`);
            return;
        }
        
        // Store complete altitude profile (like playback.py's all_alts)
        if (completeAltitudes && completeAltitudes.length > 0) {
            this.completeAltitudes = completeAltitudes;
            this.startIndex = startIndex;  // Index to start displaying from (e.g., takeoff)
            console.log(`Preloaded complete altitude profile with ${completeAltitudes.length} points, starting from index ${startIndex}`);
        } else {
            this.completeAltitudes = [];
            this.startIndex = 0;
        }
        
        // Build altitude profile incrementally (like playback.py)
        this.traveledAlts = [];
        
        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Traveled',
                        data: [],
                        borderColor: '#4a9eff',
                        backgroundColor: 'rgba(74, 158, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Current',
                        data: [],
                        borderColor: '#ff0000',
                        backgroundColor: '#ff0000',
                        borderWidth: 0,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Flight Progress',
                            color: '#e0e0e0'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Altitude (m)',
                            color: '#e0e0e0'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
        
        console.log('Chart initialized successfully');
    }
    
    setCompleteProfile(alts) {
        // Store complete altitude profile (like playback.py's all_alts)
        // Don't draw it - we'll only show the traveled portion
        this.completeAltitudes = alts;
        console.log(`Set complete altitude profile with ${alts.length} points (not drawing - will show traveled portion only)`);
    }
    
    updatePosition(alt, index, forceUpdate = false) {
        if (!this.chart) {
            return;
        }
        
        // Use preloaded complete altitude data and slice to current_index (like playback.py)
        if (this.completeAltitudes && this.completeAltitudes.length > 0) {
            // Only show data from startIndex (takeoff) onwards
            if (index < this.startIndex) {
                return;  // Don't display anything before takeoff
            }
            // Slice from startIndex to current index
            const startSlice = this.startIndex;
            const maxIndex = Math.min(index + 1, this.completeAltitudes.length);
            const traveledAltsSlice = this.completeAltitudes.slice(startSlice, maxIndex);
            
            // Update the last point with current altitude for accuracy
            if (traveledAltsSlice.length > 0) {
                traveledAltsSlice[traveledAltsSlice.length - 1] = alt;
            }
            
            // Convert to chart data format (x = relative index from start, y = altitude)
            const traveledData = traveledAltsSlice.map((altitude, i) => ({ x: i, y: altitude }));
            // Current position is relative to startIndex
            const relativeIndex = index - this.startIndex;
            
            // Only update if index actually changed (prevents updates when paused)
            if (index === this.currentIndex && this.chart.data.datasets[0].data.length === traveledData.length) {
                return; // Same index, no update needed
            }
            
            this.chart.data.datasets[0].data = traveledData;
            this.chart.data.datasets[1].data = [{ x: relativeIndex, y: alt }];
            
            // Update chart (throttled to every 5 calls to reduce load)
            // Always update on significant index changes (seeks/jumps)
            if (!this._updateCounter) this._updateCounter = 0;
            if (!this._lastIndex) this._lastIndex = index;
            const indexJumped = Math.abs(index - this._lastIndex) > 50;
            this._updateCounter++;
            this._lastIndex = index;
            
            // Update chart on first call, significant jumps, or every 5 calls
            if (this._updateCounter === 1 || this._updateCounter % 5 === 0 || indexJumped) {
                this.chart.update('none');
            }
        } else {
            // Fallback: build incrementally if complete profile not available
            if (index < this.currentIndex) {
                this.traveledAlts = [];
                this.chart.data.datasets[0].data = [];
            }
            if (index >= this.traveledAlts.length) {
                this.traveledAlts.push(alt);
            } else {
                this.traveledAlts[index] = alt;
            }
            const traveledData = this.traveledAlts.map((alt, i) => ({ x: i, y: alt }));
            this.chart.data.datasets[0].data = traveledData;
            this.chart.data.datasets[1].data = [{ x: index, y: alt }];
            if (index % 50 === 0) {
                this.chart.update('none');
            }
        }
        
        this.currentIndex = index;
    }
    
    // Method to rebuild chart data from array of altitude values
    rebuildFromData(alts) {
        if (!this.chart) return;
        
        this.traveledAlts = alts.slice();
        
        // Update traveled dataset
        const traveledData = this.traveledAlts.map((alt, i) => ({ x: i, y: alt }));
        this.chart.data.datasets[1].data = traveledData;
        
        // Update current position marker if we have data
        if (this.traveledAlts.length > 0) {
            const lastIndex = this.traveledAlts.length - 1;
            this.chart.data.datasets[2].data = [{ x: lastIndex, y: this.traveledAlts[lastIndex] }];
        }
        
        this.chart.update('none');
    }
    
    reset() {
        this.traveledAlts = [];
        this.currentIndex = 0;
        if (this.chart) {
            this.chart.data.datasets[0].data = [];
            this.chart.data.datasets[1].data = [];
            this.chart.update();
        }
    }
}

