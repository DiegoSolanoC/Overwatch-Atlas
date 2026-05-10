/**
 * MusicPlaybackService - Handles music playback control (play, pause, skip, next song)
 */

class MusicPlaybackService {
    constructor(backgroundMusic) {
        this.backgroundMusic = backgroundMusic;
        this.currentSong = null;
        this.musicFiles = [];
    }

    /**
     * Encode music path to handle special characters
     */
    encodeMusicPath(path) {
        if (!path) return path;
        const parts = path.split('/');
        if (parts.length < 2) return path;
        const filename = parts[parts.length - 1];
        const dir = parts.slice(0, -1).join('/');
        return `${dir}/${encodeURIComponent(filename)}`;
    }

    /**
     * Set music files list
     */
    setMusicFiles(musicFiles) {
        this.musicFiles = musicFiles;
    }

    /**
     * Get current song
     */
    getCurrentSong() {
        return this.currentSong;
    }

    /**
     * Set current song
     */
    setCurrentSong(songPath) {
        this.currentSong = songPath;
    }

    /**
     * Load a song (set source and prepare for playback)
     */
    loadSong(songPath, isShuffling, onMetadataLoaded, loopOverride) {
        if (!songPath || !this.backgroundMusic) return;

        if (typeof loopOverride === 'boolean') {
            this.backgroundMusic.loop = loopOverride;
        } else {
            this.backgroundMusic.loop = !isShuffling;
        }
        
        // Encode the path to handle special characters
        const encodedPath = this.encodeMusicPath(songPath);
        this.backgroundMusic.src = encodedPath;
        this.currentSong = songPath; // Keep original for comparison
        
        // Force load metadata
        this.backgroundMusic.load();
        
        // Setup metadata loaded handlers
        if (onMetadataLoaded) {
            const handleMetadataLoaded = (eventType) => {
                const duration = this.backgroundMusic.duration;
                const readyState = this.backgroundMusic.readyState;
                
                // Check if duration is valid
                if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    onMetadataLoaded(duration, readyState);
                    // Remove all listeners once we have valid metadata
                    this.backgroundMusic.removeEventListener('loadedmetadata', handleMetadataLoaded);
                    this.backgroundMusic.removeEventListener('canplay', handleMetadataLoaded);
                    this.backgroundMusic.removeEventListener('loadeddata', handleMetadataLoaded);
                    this.backgroundMusic.removeEventListener('canplaythrough', handleMetadataLoaded);
                }
            };
            
            // Listen for multiple events to catch metadata loading
            this.backgroundMusic.addEventListener('loadedmetadata', () => handleMetadataLoaded('loadedmetadata'));
            this.backgroundMusic.addEventListener('canplay', () => handleMetadataLoaded('canplay'));
            this.backgroundMusic.addEventListener('loadeddata', () => handleMetadataLoaded('loadeddata'));
            this.backgroundMusic.addEventListener('canplaythrough', () => handleMetadataLoaded('canplaythrough'));
            
            // Fallback: Check periodically if metadata loaded
            let metadataCheckCount = 0;
            const maxMetadataChecks = 100;
            const metadataCheckInterval = setInterval(() => {
                metadataCheckCount++;
                const duration = this.backgroundMusic.duration;
                
                if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    onMetadataLoaded(duration, this.backgroundMusic.readyState);
                    clearInterval(metadataCheckInterval);
                } else if (metadataCheckCount >= maxMetadataChecks) {
                    clearInterval(metadataCheckInterval);
                }
            }, 100);
        }
    }

    /**
     * Play the currently loaded song
     */
    async play(onFadeIn) {
        if (!this.backgroundMusic) return;
        
        // Check if already playing the same song
        const encodedPath = this.encodeMusicPath(this.currentSong);
        if (!this.backgroundMusic.paused && this.backgroundMusic.src.endsWith(encodedPath.split('/').pop())) {
            return;
        }
        
        this.backgroundMusic.volume = 0;
        const playPromise = this.backgroundMusic.play();
        
        if (playPromise !== undefined) {
            try {
                await playPromise;
                if (onFadeIn) onFadeIn();
            } catch (error) {
                console.log('Autoplay prevented:', error);
            }
        } else {
            if (onFadeIn) onFadeIn();
        }
    }

    /**
     * Pause playback
     */
    pause() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
        }
    }

    /**
     * Resume playback
     */
    resume() {
        if (this.backgroundMusic) {
            return this.backgroundMusic.play();
        }
    }

    /**
     * Get next song to play (for shuffle or default)
     */
    getNextSong(isShuffling, shuffleQueue, currentSongIndex) {
        if (isShuffling && shuffleQueue && shuffleQueue.length > 0) {
            const nextIndex = (currentSongIndex + 1) % shuffleQueue.length;
            return shuffleQueue[nextIndex];
        }
        if (this.musicFiles.length === 0) return null;
        const cur = this.currentSong || '';
        let idx = this.musicFiles.findIndex(s =>
            cur.endsWith('/' + s.filename) || decodeURIComponent(cur).endsWith('/' + s.filename)
        );
        if (idx < 0) idx = 0;
        else idx = (idx + 1) % this.musicFiles.length;
        return this.musicFiles[idx];
    }

    /**
     * Check if a song path matches (handles encoding variations)
     */
    matchesSongPath(btnPath, songPath) {
        if (!btnPath || !songPath) return false;
        return btnPath === songPath || 
               btnPath === songPath.replace(/ /g, '%20') ||
               btnPath.replace(/ /g, '%20') === songPath ||
               decodeURIComponent(btnPath) === decodeURIComponent(songPath);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicPlaybackService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicPlaybackService = MusicPlaybackService;
    // Make encodeMusicPath available globally for comparisons
    window.encodeMusicPath = (path) => {
        const service = new MusicPlaybackService(null);
        return service.encodeMusicPath(path);
    };
}
