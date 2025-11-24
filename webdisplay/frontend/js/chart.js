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
        this.downsampleFactor = 1;  // Factor by which data was downsampled (default: no downsampling)
    }
    
    initialize(completeAltitudes = null, startIndex = 0, downsampleFactor = 1) {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${this.canvasId}' not found`);
            return;
        }
        
        // Store complete altitude profile (like playback.py's all_alts)
        if (completeAltitudes && completeAltitudes.length > 0) {
            this.completeAltitudes = completeAltitudes;
            this.startIndex = startIndex;  // Index to start displaying from (e.g., takeoff)
            this.downsampleFactor = downsampleFactor || 1;
            console.log(`Preloaded complete altitude profile with ${completeAltitudes.length} points, starting from index ${startIndex}, downsample factor: ${this.downsampleFactor}`);
        } else {
            this.completeAltitudes = [];
            this.startIndex = 0;
            this.downsampleFactor = 1;
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
            
            // Detect timestamp jumps (forward or backward) by comparing with currentIndex
            const indexJumped = Math.abs(index - this.currentIndex) > 10;
            
            // Convert indices to downsampled indices if data was downsampled
            // Downsampled data contains every Nth point, so we need to map original indices
            const downsampledStartIndex = Math.floor(this.startIndex / this.downsampleFactor);
            const downsampledCurrentIndex = Math.floor(index / this.downsampleFactor);
            
            // Slice from startIndex to current index (using downsampled indices)
            const startSlice = Math.max(0, downsampledStartIndex);
            const maxIndex = Math.min(downsampledCurrentIndex + 1, this.completeAltitudes.length);
            const traveledAltsSlice = this.completeAltitudes.slice(startSlice, maxIndex);
            
            // Update the last point with current altitude for accuracy
            if (traveledAltsSlice.length > 0) {
                traveledAltsSlice[traveledAltsSlice.length - 1] = alt;
            }
            
            // Convert to chart data format (x = relative index from start, y = altitude)
            // X-axis represents original indices (not downsampled), so we scale back
            const traveledData = traveledAltsSlice.map((altitude, i) => {
                // Map back to original index space: (downsampledStartIndex + i) * downsampleFactor
                // Then make relative to startIndex
                const originalIndex = (downsampledStartIndex + i) * this.downsampleFactor;
                const relativeIndex = originalIndex - this.startIndex;
                return { x: relativeIndex, y: altitude };
            });
            // Current position uses original index (not downsampled)
            const relativeIndex = index - this.startIndex;
            
            // Only skip update if index hasn't changed AND not forcing update AND not a jump
            // Always update on jumps or forced updates
            if (!forceUpdate && !indexJumped && index === this.currentIndex && this.chart.data.datasets[0].data.length === traveledData.length) {
                return; // Same index, no update needed
            }
            
            this.chart.data.datasets[0].data = traveledData;
            this.chart.data.datasets[1].data = [{ x: relativeIndex, y: alt }];
            
            // Update chart immediately on jumps or forced updates, otherwise throttle
            if (forceUpdate || indexJumped) {
                // Immediate update for jumps and forced updates
                this.chart.update('none');
                // Reset throttling counters on jump
                this._updateCounter = 0;
                this._lastIndex = index;
            } else {
                // Throttled update for normal playback
                if (!this._updateCounter) this._updateCounter = 0;
                if (this._lastIndex === undefined) this._lastIndex = index;
                this._updateCounter++;
                this._lastIndex = index;
                
                // Update chart on first call or every 5 calls
                if (this._updateCounter === 1 || this._updateCounter % 5 === 0) {
                    this.chart.update('none');
                }
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
            
            // Detect jumps in fallback mode too
            const indexJumped = Math.abs(index - this.currentIndex) > 10;
            if (forceUpdate || indexJumped || index % 50 === 0) {
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

