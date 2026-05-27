/**
 * MusicProgressService — progress bar, seeking, and time display.
 */

import { wireMusicProgressBar } from '../panel/wireMusicProgressBar.js';

export class MusicProgressService {
    constructor(backgroundMusic) {
        this.backgroundMusic = backgroundMusic;
        this.isDragging = false;
        this.isSeeking = false;
        this.progressBar = null;
        this.currentTimeEl = null;
        this.totalTimeEl = null;
    }

    init() {
        this.progressBar = document.getElementById('musicProgressBar');
        this.currentTimeEl = document.getElementById('musicCurrentTime');
        this.totalTimeEl = document.getElementById('musicTotalTime');
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateProgressBar() {
        if (!this.backgroundMusic) return;

        const duration = this.backgroundMusic.duration;
        const isValidDuration = duration && !isNaN(duration) && isFinite(duration) && duration > 0;

        if (!isValidDuration) {
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

    seekToPosition(clientX) {
        if (!this.progressBar) return false;

        const rect = this.progressBar.getBoundingClientRect();
        const percent = ((clientX - rect.left) / rect.width) * 100;
        return this.seekTo(percent);
    }

    isInteracting() {
        return this.isSeeking || this.isDragging;
    }

    setupEventListeners(onSeek) {
        wireMusicProgressBar(this, onSeek);
    }
}
