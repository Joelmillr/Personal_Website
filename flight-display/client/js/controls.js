/**
 * Controls handler for UI interactions
 */
class Controls {
    constructor() {
        this.jumpButtons = document.querySelectorAll('.btn-jump');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Jump buttons
        this.jumpButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const timestampId = parseInt(btn.dataset.id);
                if (playbackEngine) {
                    console.log(`Jump button clicked for timestamp ${timestampId}`);
                    
                    const index = await playbackEngine.jumpToTimestamp(timestampId);
                    if (index !== null) {
                        console.log(`[CONTROLS] Jumped to timestamp ${timestampId}, index ${index}`);
                        // If YouTube video is not available, start playback after jump
                        if (!window.youtubePlayer && playbackEngine.socket && playbackEngine.socket.connected) {
                            playbackEngine.socket.emit('start_playback', {
                                index: index,
                                speed: playbackEngine.speed || 2.0
                            });
                        }
                    }
                }
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Number keys 0-9 for timestamps
            if (e.key >= '0' && e.key <= '9') {
                const id = parseInt(e.key);
                const btn = document.querySelector(`.btn-jump[data-id="${id}"]`);
                if (btn) btn.click();
            }
            
            // Letters a-d for timestamps 10-13
            if (e.key >= 'a' && e.key <= 'd') {
                const id = 10 + (e.key.charCodeAt(0) - 'a'.charCodeAt(0));
                const btn = document.querySelector(`.btn-jump[data-id="${id}"]`);
                if (btn) btn.click();
            }
            
            // 'e' for timestamp 12 (landing)
            if (e.key === 'e') {
                const btn = document.querySelector(`.btn-jump[data-id="12"]`);
                if (btn) btn.click();
            }
        });
    }
    
}

