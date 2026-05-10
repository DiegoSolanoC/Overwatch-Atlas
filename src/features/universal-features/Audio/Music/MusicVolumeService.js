/**
 * MusicVolumeService - Handles volume control, mute, and fade in/out
 */

class MusicVolumeService {
    constructor(backgroundMusic) {
        this.backgroundMusic = backgroundMusic;
        this.currentTargetVolume = 0.1; // Default 10%
        this.fadeInInterval = null;
        this.fadeOutInterval = null;
        this.fadeDuration = 2000; // 2 seconds
        this.fadeSteps = 20;
        this.fadeStepTime = this.fadeDuration / this.fadeSteps;
    }

    /**
     * Set target volume (without immediate fade)
     */
    setTargetVolume(volume) {
        this.currentTargetVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Get current target volume
     */
    getTargetVolume() {
        return this.currentTargetVolume;
    }

    /**
     * Set volume immediately (no fade)
     */
    setVolume(volume) {
        if (!this.backgroundMusic) return;
        this.currentTargetVolume = Math.max(0, Math.min(1, volume));
        if (!this.backgroundMusic.muted && !this.fadeInInterval && !this.fadeOutInterval) {
            this.backgroundMusic.volume = this.currentTargetVolume;
        }
    }

    /**
     * Fade in to target volume
     */
    fadeIn(isSeeking = false, isDragging = false) {
        if (!this.backgroundMusic) return;
        
        // Clear any existing fade intervals
        if (this.fadeInInterval) clearInterval(this.fadeInInterval);
        if (this.fadeOutInterval) clearInterval(this.fadeOutInterval);
        
        this.backgroundMusic.volume = 0;
        let currentStep = 0;
        const targetVolume = this.backgroundMusic.muted ? 0 : this.currentTargetVolume;
        
        this.fadeInInterval = setInterval(() => {
            if (this.backgroundMusic.muted) {
                clearInterval(this.fadeInInterval);
                this.fadeInInterval = null;
                return;
            }
            
            // Don't fade if user is seeking
            if (isSeeking || isDragging) {
                clearInterval(this.fadeInInterval);
                this.fadeInInterval = null;
                return;
            }
            
            currentStep++;
            const progress = currentStep / this.fadeSteps;
            this.backgroundMusic.volume = targetVolume * progress;
            
            if (currentStep >= this.fadeSteps) {
                clearInterval(this.fadeInInterval);
                this.fadeInInterval = null;
                this.backgroundMusic.volume = targetVolume;
            }
        }, this.fadeStepTime);
    }

    /**
     * Fade out from current volume
     * @param {boolean} isSeeking - Whether user is seeking
     * @param {boolean} isDragging - Whether user is dragging
     * @param {Function} onComplete - Callback when fade completes (for looping)
     */
    fadeOut(isSeeking = false, isDragging = false, onComplete = null) {
        if (!this.backgroundMusic) return;
        if (this.fadeOutInterval) return;
        if (this.fadeInInterval) clearInterval(this.fadeInInterval);
        
        // Don't fade out if user is seeking
        if (isSeeking || isDragging) return;
        
        const startVolume = this.backgroundMusic.volume;
        let currentStep = 0;
        
        this.fadeOutInterval = setInterval(() => {
            // Check again during fade - user might start seeking
            if (isSeeking || isDragging) {
                clearInterval(this.fadeOutInterval);
                this.fadeOutInterval = null;
                // Restore volume if fade was interrupted
                this.backgroundMusic.volume = startVolume;
                return;
            }
            
            currentStep++;
            const progress = currentStep / this.fadeSteps;
            this.backgroundMusic.volume = startVolume * (1 - progress);
            
            if (currentStep >= this.fadeSteps) {
                clearInterval(this.fadeOutInterval);
                this.fadeOutInterval = null;
                this.backgroundMusic.volume = 0;
                
                // Call completion callback if provided
                if (onComplete) {
                    onComplete();
                }
            }
        }, this.fadeStepTime);
    }

    /**
     * Stop all fade operations
     */
    stopFade() {
        if (this.fadeInInterval) {
            clearInterval(this.fadeInInterval);
            this.fadeInInterval = null;
        }
        if (this.fadeOutInterval) {
            clearInterval(this.fadeOutInterval);
            this.fadeOutInterval = null;
        }
    }

    /**
     * Check if currently fading
     */
    isFading() {
        return this.fadeInInterval !== null || this.fadeOutInterval !== null;
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicVolumeService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicVolumeService = MusicVolumeService;
}
