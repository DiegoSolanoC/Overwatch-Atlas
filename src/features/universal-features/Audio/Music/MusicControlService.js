/**
 * MusicControlService - Handles control button event handlers (volume, mute, pause, skip, shuffle, loop)
 */

class MusicControlService {
    constructor(backgroundMusic, volumeService, shuffleService, iconService, onStateChange, musicManager) {
        this.backgroundMusic = backgroundMusic;
        this.volumeService = volumeService;
        this.shuffleService = shuffleService;
        this.iconService = iconService;
        this.onStateChange = onStateChange; // Callback for state changes (e.g., saveMusicState)
        this.musicManager = musicManager || null;
        /** Optional: called after shuffle is enabled (e.g. leave startup/ambient). */
        this.onShuffleEnabled = null;
        
        // DOM elements (will be set in init)
        this.volumeSlider = null;
        this.volumeValue = null;
        this.muteBtn = null;
        this.pauseBtn = null;
        this.skipBtn = null;
        this.loopBtn = null;
        this.shuffleBtn = null;
    }

    /**
     * Match HTMLMediaElement.loop to catalog mode (loop wins over shuffle; mutually exclusive with shuffle).
     */
    syncCatalogLoopFlag() {
        if (!this.backgroundMusic || !this.musicManager) return;
        if (this.musicManager._musicMode !== 'catalog') return;
        this.backgroundMusic.loop = !!(this.musicManager.isLooping && !this.shuffleService.isShuffling);
    }

    /**
     * Initialize DOM element references
     */
    init() {
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.muteBtn = document.getElementById('muteBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.skipBtn = document.getElementById('skipBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
    }

    /**
     * Setup volume slider handler
     */
    setupVolumeSlider() {
        if (!this.volumeSlider) return;
        
        this.volumeSlider.addEventListener('input', () => {
            const volume = this.volumeSlider.value / 100;
            this.volumeService.setTargetVolume(volume);
            this.volumeService.setVolume(volume);
            
            if (this.volumeValue) {
                this.volumeValue.textContent = Math.round(volume * 100) + '%';
            } else {
                // Fallback: try to get element directly
                const volumeValueEl = document.getElementById('volumeValue');
                if (volumeValueEl) {
                    volumeValueEl.textContent = Math.round(volume * 100) + '%';
                }
            }
            
            if (this.onStateChange) {
                this.onStateChange();
            }
            
            if (volume === 0 && this.muteBtn) {
                this.muteBtn.classList.add('active');
                this.iconService.updateMuteIcon(true);
            } else if (this.muteBtn) {
                if (!this.backgroundMusic.muted) {
                    this.muteBtn.classList.remove('active');
                    this.iconService.updateMuteIcon(false);
                }
            }
        });
    }

    /**
     * Setup mute button handler
     */
    setupMuteButton() {
        if (!this.muteBtn) return;
        
        this.muteBtn.addEventListener('click', () => {
            if (this.backgroundMusic.muted) {
                this.backgroundMusic.muted = false;
                this.muteBtn.classList.remove('active');
                this.iconService.updateMuteIcon(false);
                if (!this.volumeService.isFading()) {
                    this.backgroundMusic.volume = this.volumeService.getTargetVolume();
                }
            } else {
                this.backgroundMusic.muted = true;
                this.muteBtn.classList.add('active');
                this.iconService.updateMuteIcon(true);
            }
            
            if (this.onStateChange) {
                this.onStateChange();
            }
        });
    }

    /**
     * Setup pause button handler
     */
    setupPauseButton() {
        if (!this.pauseBtn) return;
        
        this.pauseBtn.addEventListener('click', () => {
            if (this.backgroundMusic.paused) {
                this.backgroundMusic.play();
                this.pauseBtn.classList.remove('active');
                this.iconService.updatePauseIcon(false);
            } else {
                this.backgroundMusic.pause();
                this.pauseBtn.classList.add('active');
                this.iconService.updatePauseIcon(true);
            }
            
            if (this.onStateChange) {
                this.onStateChange();
            }
        });
    }

    /**
     * Setup skip button handler
     */
    setupSkipButton(onSkip) {
        if (!this.skipBtn) return;
        
        this.skipBtn.addEventListener('click', () => {
            if (onSkip) {
                onSkip();
            }
        });
    }

    /**
     * Loop current catalog track (exclusive with shuffle; loop takes priority when both would apply).
     */
    setupLoopButton() {
        if (!this.loopBtn || !this.musicManager) return;

        const old = this.loopBtn._loopHandler;
        if (old) {
            try { this.loopBtn.removeEventListener('click', old); } catch (_) {}
        }

        const handler = () => {
            const next = !this.musicManager.isLooping;
            this.musicManager.isLooping = next;

            if (next && this.shuffleService.isShuffling) {
                this.shuffleService.disableShuffle();
                if (this.shuffleBtn) this.shuffleBtn.classList.remove('active');
                this.iconService.updateShuffleIcon(false);
            }

            this.loopBtn.classList.toggle('active', next);
            this.iconService.updateLoopIcon(next);
            this.syncCatalogLoopFlag();

            if (this.onStateChange) {
                this.onStateChange();
            }
        };

        this.loopBtn._loopHandler = handler;
        this.loopBtn.addEventListener('click', handler);
    }

    /**
     * Setup shuffle button handler
     */
    setupShuffleButton(musicFiles, currentSong) {
        if (!this.shuffleBtn) return;

        // Support passing dynamic providers (functions) so we always use the latest
        // musicFiles/currentSong even though they are loaded asynchronously.
        const resolve = (v) => (typeof v === 'function') ? v() : v;

        // Avoid duplicate listeners across re-inits.
        const old = this.shuffleBtn._shuffleHandler;
        if (old) {
            try { this.shuffleBtn.removeEventListener('click', old); } catch (_) {}
        }

        const handler = () => {
            const files = resolve(musicFiles) || [];
            const song = resolve(currentSong) || null;

            if (this.shuffleService.isShuffling) {
                this.shuffleService.disableShuffle();
                this.shuffleBtn.classList.remove('active');
                this.iconService.updateShuffleIcon(false);
            } else {
                if (!files || files.length === 0) {
                    return; // nothing to shuffle yet
                }
                if (this.musicManager) {
                    this.musicManager.isLooping = false;
                    if (this.loopBtn) {
                        this.loopBtn.classList.remove('active');
                    }
                    this.iconService.updateLoopIcon(false);
                }
                this.shuffleService.enableShuffle(files, song);
                this.shuffleBtn.classList.add('active');
                this.iconService.updateShuffleIcon(true);
                if (this.onShuffleEnabled && typeof this.onShuffleEnabled === 'function') {
                    this.onShuffleEnabled();
                }
            }

            this.syncCatalogLoopFlag();
            
            if (this.onStateChange) {
                this.onStateChange();
            }
        };

        this.shuffleBtn._shuffleHandler = handler;
        this.shuffleBtn.addEventListener('click', handler);
    }

    /**
     * Setup all control buttons
     */
    setupAllControls(musicFiles, currentSong, onSkip) {
        this.setupVolumeSlider();
        this.setupMuteButton();
        this.setupPauseButton();
        this.setupSkipButton(onSkip);
        this.setupLoopButton();
        this.setupShuffleButton(musicFiles, currentSong);
    }

    /**
     * Initialize button states based on current playback state
     */
    initializeButtonStates() {
        if (this.backgroundMusic.paused) {
            this.iconService.updatePauseIcon(true);
            if (this.pauseBtn) this.pauseBtn.classList.add('active');
        } else {
            this.iconService.updatePauseIcon(false);
            if (this.pauseBtn) this.pauseBtn.classList.remove('active');
        }
        
        if (this.backgroundMusic.muted) {
            this.iconService.updateMuteIcon(true);
            if (this.muteBtn) this.muteBtn.classList.add('active');
        } else {
            this.iconService.updateMuteIcon(false);
            if (this.muteBtn) this.muteBtn.classList.remove('active');
        }

        if (this.musicManager && this.loopBtn) {
            const looping = !!this.musicManager.isLooping;
            this.loopBtn.classList.toggle('active', looping);
            this.iconService.updateLoopIcon(looping);
        }

        if (this.shuffleBtn && this.shuffleService) {
            const shuffling = !!this.shuffleService.isShuffling;
            this.shuffleBtn.classList.toggle('active', shuffling);
            this.iconService.updateShuffleIcon(shuffling);
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicControlService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicControlService = MusicControlService;
}

