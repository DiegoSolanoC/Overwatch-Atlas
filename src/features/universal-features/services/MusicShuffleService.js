/**
 * MusicShuffleService - Handles shuffle queue management and logic
 */

class MusicShuffleService {
    constructor() {
        this.isShuffling = false;
        this.shuffleQueue = [];
        this.currentSongIndex = 0;
    }

    /**
     * Shuffle an array using Fisher-Yates algorithm
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Enable shuffle mode and create shuffle queue
     */
    enableShuffle(musicFiles, currentSong) {
        this.isShuffling = true;
        this.shuffleQueue = this.shuffleArray(musicFiles);
        
        // Find current song in shuffle queue
        if (currentSong) {
            this.currentSongIndex = this.shuffleQueue.findIndex(s => 
                currentSong.endsWith(`/${s.filename}`)
            );
        }
        if (this.currentSongIndex === -1) {
            this.currentSongIndex = 0;
        }
        
        return this.shuffleQueue;
    }

    /**
     * Disable shuffle mode
     */
    disableShuffle() {
        this.isShuffling = false;
        this.shuffleQueue = [];
        this.currentSongIndex = 0;
    }

    /**
     * Get next song in shuffle queue
     */
    getNextSong() {
        if (!this.isShuffling || this.shuffleQueue.length === 0) {
            return null;
        }
        
        this.currentSongIndex = (this.currentSongIndex + 1) % this.shuffleQueue.length;
        return this.shuffleQueue[this.currentSongIndex];
    }

    /**
     * Get current song from shuffle queue
     */
    getCurrentSong() {
        if (!this.isShuffling || this.shuffleQueue.length === 0) {
            return null;
        }
        return this.shuffleQueue[this.currentSongIndex];
    }

    /**
     * Restore shuffle state from saved state
     */
    restoreShuffleState(musicFiles, savedShuffleQueue, savedSongIndex) {
        if (savedShuffleQueue && musicFiles.length > 0) {
            this.isShuffling = true;
            this.shuffleQueue = musicFiles.filter(s => 
                savedShuffleQueue.includes(s.filename)
            );
            this.currentSongIndex = savedSongIndex || 0;
            return true;
        }
        return false;
    }

    /**
     * Get shuffle state for saving
     */
    getShuffleState() {
        return {
            isShuffling: this.isShuffling,
            currentSongIndex: this.currentSongIndex,
            shuffleQueue: this.isShuffling ? this.shuffleQueue.map(s => s.filename) : null
        };
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicShuffleService;
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.MusicShuffleService = MusicShuffleService;
}
