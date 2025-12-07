/**
 * Controls handler for UI interactions
 */
class Controls {
    constructor() {
        this.jumpButtons = document.querySelectorAll('.btn-jump');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.jumpControls = document.querySelector('.jump-controls');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mobile menu toggle
        if (this.mobileMenuToggle && this.jumpControls) {
            this.mobileMenuToggle.addEventListener('click', () => {
                const isExpanded = this.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
                this.mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
                this.jumpControls.classList.toggle('active');
            });

            // Close menu when clicking on a jump button (optional - can be removed if you want menu to stay open)
            this.jumpButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Only close on mobile (when menu toggle is visible)
                    if (window.innerWidth <= 768 && this.jumpControls.classList.contains('active')) {
                        // Small delay to allow the jump action to complete
                        setTimeout(() => {
                            this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
                            this.jumpControls.classList.remove('active');
                        }, 300);
                    }
                });
            });
        }

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

