/**
 * MusicProgressService - Handles progress bar, seeking, and time display
 */

class MusicProgressService {
    constructor(backgroundMusic) {
        this.backgroundMusic = backgroundMusic;
        this.isDragging = false;
        this.isSeeking = false;
        this.progressBar = null;
        this.currentTimeEl = null;
        this.totalTimeEl = null;
    }

    /**
     * Initialize DOM element references
     */
    init() {
        this.progressBar = document.getElementById('musicProgressBar');
        this.currentTimeEl = document.getElementById('musicCurrentTime');
        this.totalTimeEl = document.getElementById('musicTotalTime');
    }

    /**
     * Format time as MM:SS
     */
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Update progress bar and time displays
     */
    updateProgressBar() {
        if (!this.backgroundMusic) return;
        
        // Check for valid duration
        const duration = this.backgroundMusic.duration;
        const isValidDuration = duration && !isNaN(duration) && isFinite(duration) && duration > 0;
        
        if (!isValidDuration) {
            // Still update current time display even if duration isn't ready
            if (this.currentTimeEl && !isNaN(this.backgroundMusic.currentTime)) {
                this.currentTimeEl.textContent = this.formatTime(this.backgroundMusic.currentTime);
            }
            if (this.totalTimeEl) {
                this.totalTimeEl.textContent = '0:00';
            }
            return;
        }
        
        const current = this.backgroundMusic.currentTime;
        const total = duration;
        const percent = (current / total) * 100;
        
        // Only update progress bar if not currently seeking/dragging
        if (this.progressBar && !this.isSeeking && !this.isDragging) {
            this.progressBar.value = percent;
        }
        
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(current);
        }
        
        if (this.totalTimeEl) {
            this.totalTimeEl.textContent = this.formatTime(total);
        }
    }

    /**
     * Seek to a specific time
     */
    seekTo(percent) {
        if (!this.backgroundMusic) return false;
        
        const duration = this.backgroundMusic.duration;
        if (!duration || isNaN(duration) || !isFinite(duration) || duration <= 0) {
            return false;
        }
        
        const newTime = (Math.max(0, Math.min(100, percent)) / 100) * duration;
        this.backgroundMusic.currentTime = newTime;
        this.updateProgressBar();
        return true;
    }

    /**
     * Seek to a specific time by click position
     */
    seekToPosition(clientX) {
        if (!this.progressBar) return false;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = ((clientX - rect.left) / rect.width) * 100;
        return this.seekTo(percent);
    }

    /**
     * Set seeking flag
     */
    setSeeking(isSeeking) {
        this.isSeeking = isSeeking;
    }

    /**
     * Set dragging flag
     */
    setDragging(isDragging) {
        this.isDragging = isDragging;
    }

    /**
     * Check if currently seeking or dragging
     */
    isInteracting() {
        return this.isSeeking || this.isDragging;
    }

    /**
     * Setup progress bar event listeners
     */
    setupEventListeners(onSeek) {
        if (!this.progressBar) return;
        
        // Set seeking flag on any interaction
        this.progressBar.addEventListener('mousedown', () => {
            this.isSeeking = true;
            this.isDragging = true;
        });
        
        this.progressBar.addEventListener('click', (e) => {
            if (this.backgroundMusic) {
                const duration = this.backgroundMusic.duration;
                if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    this.seekToPosition(e.clientX);
                    if (onSeek) onSeek();
                }
            }
        });
        
        this.progressBar.addEventListener('mouseup', () => {
            this.isSeeking = false;
            this.isDragging = false;
        });
        
        this.progressBar.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isSeeking = false;
                this.isDragging = false;
            }
        });
        
        // Handle input events (dragging)
        this.progressBar.addEventListener('input', () => {
            if (this.backgroundMusic && (this.isSeeking || this.isDragging)) {
                const duration = this.backgroundMusic.duration;
                if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    const percent = this.progressBar.value;
                    const newTime = (percent / 100) * duration;
                    this.backgroundMusic.currentTime = newTime;
                    this.updateProgressBar();
                    if (onSeek) onSeek();
                }
            }
        });
        
        this.progressBar.addEventListener('change', () => {
            if (this.backgroundMusic) {
                const duration = this.backgroundMusic.duration;
                if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    const percent = this.progressBar.value;
                    const newTime = (percent / 100) * duration;
                    this.backgroundMusic.currentTime = newTime;
                    this.updateProgressBar();
                    if (onSeek) onSeek();
                }
            }
            this.isSeeking = false;
            this.isDragging = false;
        });
        
        // Touch events for mobile
        this.progressBar.addEventListener('touchstart', () => {
            this.isSeeking = true;
            this.isDragging = true;
        });
        
        this.progressBar.addEventListener('touchend', () => {
            this.isSeeking = false;
            this.isDragging = false;
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicProgressService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicProgressService = MusicProgressService;
}
