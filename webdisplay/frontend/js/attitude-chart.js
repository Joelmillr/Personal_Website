/**
 * Attitude chart using Chart.js - shows yaw, pitch, and roll over time
 */
class AttitudeChartViewer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.chart = null;
        this.completeAttitudes = { yaws: [], pitches: [], rolls: [] };
        this.startIndex = 0;
        this.currentIndex = 0;
        this.downsampleFactor = 1;  // Factor by which data was downsampled (default: no downsampling)
    }
    
    initialize(completeAttitudes = null, startIndex = 0, downsampleFactor = 1) {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${this.canvasId}' not found`);
            return;
        }
        
        // Store complete attitude data
        if (completeAttitudes && completeAttitudes.yaws && completeAttitudes.yaws.length > 0) {
            this.completeAttitudes = completeAttitudes;
            this.startIndex = startIndex;
            this.downsampleFactor = downsampleFactor || 1;
            console.log(`Preloaded complete attitude profile with ${completeAttitudes.yaws.length} points, starting from index ${startIndex}, downsample factor: ${this.downsampleFactor}`);
        } else {
            this.completeAttitudes = { yaws: [], pitches: [], rolls: [] };
            this.startIndex = 0;
            this.downsampleFactor = 1;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Yaw',
                        data: [],
                        borderColor: '#4a9eff',
                        backgroundColor: 'rgba(74, 158, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Pitch',
                        data: [],
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Roll',
                        data: [],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e0e0e0',
                            usePointStyle: true,
                            padding: 15
                        }
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
                            text: 'Angle (degrees)',
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
        
        console.log('Attitude chart initialized successfully');
    }
    
    updatePosition(yaw, pitch, roll, index, forceUpdate = false) {
        if (!this.chart) {
            return;
        }
        
        // Use preloaded complete attitude data and slice to current_index
        if (this.completeAttitudes && this.completeAttitudes.yaws && this.completeAttitudes.yaws.length > 0) {
            // Only show data from startIndex (takeoff) onwards
            if (index < this.startIndex) {
                return;  // Don't display anything before takeoff
            }
            
            // Detect timestamp jumps (forward or backward) by comparing with currentIndex
            const indexJumped = Math.abs(index - this.currentIndex) > 10;
            
            // Convert indices to downsampled indices if data was downsampled
            const downsampledStartIndex = Math.floor(this.startIndex / this.downsampleFactor);
            const downsampledCurrentIndex = Math.floor(index / this.downsampleFactor);
            
            // Slice from startIndex to current index (using downsampled indices)
            const startSlice = Math.max(0, downsampledStartIndex);
            const maxIndex = Math.min(downsampledCurrentIndex + 1, this.completeAttitudes.yaws.length);
            
            const traveledYaws = this.completeAttitudes.yaws.slice(startSlice, maxIndex);
            const traveledPitches = this.completeAttitudes.pitches.slice(startSlice, maxIndex);
            const traveledRolls = this.completeAttitudes.rolls.slice(startSlice, maxIndex);
            
            // Update the last point with current values for accuracy
            if (traveledYaws.length > 0) {
                traveledYaws[traveledYaws.length - 1] = yaw;
                traveledPitches[traveledPitches.length - 1] = pitch;
                traveledRolls[traveledRolls.length - 1] = roll;
            }
            
            // Convert to chart data format (x = relative index from start, y = angle)
            // X-axis represents original indices (not downsampled), so we scale back
            const yawData = traveledYaws.map((angle, i) => {
                // Map back to original index space: (downsampledStartIndex + i) * downsampleFactor
                // Then make relative to startIndex
                const originalIndex = (downsampledStartIndex + i) * this.downsampleFactor;
                const relativeIndex = originalIndex - this.startIndex;
                return { x: relativeIndex, y: angle };
            });
            const pitchData = traveledPitches.map((angle, i) => {
                const originalIndex = (downsampledStartIndex + i) * this.downsampleFactor;
                const relativeIndex = originalIndex - this.startIndex;
                return { x: relativeIndex, y: angle };
            });
            const rollData = traveledRolls.map((angle, i) => {
                const originalIndex = (downsampledStartIndex + i) * this.downsampleFactor;
                const relativeIndex = originalIndex - this.startIndex;
                return { x: relativeIndex, y: angle };
            });
            
            // Only skip update if index hasn't changed AND not forcing update AND not a jump
            // Always update on jumps or forced updates
            if (!forceUpdate && !indexJumped && index === this.currentIndex && this.chart.data.datasets[0].data.length === yawData.length) {
                return; // Same index, no update needed
            }
            
            this.chart.data.datasets[0].data = yawData;
            this.chart.data.datasets[1].data = pitchData;
            this.chart.data.datasets[2].data = rollData;
            
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
            // This shouldn't happen if backend is working correctly
            console.warn('Attitude chart: Complete attitude data not available, using fallback');
        }
        
        this.currentIndex = index;
    }
    
    reset() {
        this.currentIndex = 0;
        if (this.chart) {
            this.chart.data.datasets[0].data = [];
            this.chart.data.datasets[1].data = [];
            this.chart.data.datasets[2].data = [];
            this.chart.update();
        }
    }
}

