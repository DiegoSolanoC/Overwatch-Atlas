/**
 * MusicStateService - Persists music playback state.
 * Production: localStorage. Local dev (localhost / 127.0.0.1): sessionStorage so
 * music memory is scoped to the tab session; color palette keeps using localStorage elsewhere.
 */

import { normalizeMusicAssetPath } from '../musicPaletteThemes.js';

export class MusicStateService {
    constructor() {
        this.storageKey = 'musicState';
    }

    /**
     * @returns {boolean}
     */
    static isLocalDevHost() {
        try {
            if (typeof window === 'undefined' || !window.location) return false;
            const h = window.location.hostname;
            return h === 'localhost' || h === '127.0.0.1';
        } catch (e) {
            return false;
        }
    }

    _storage() {
        return MusicStateService.isLocalDevHost() ? sessionStorage : localStorage;
    }

    /**
     * Remove saved music state from both storages (avoids stale entries when switching modes).
     */
    clearState() {
        try {
            localStorage.removeItem(this.storageKey);
            sessionStorage.removeItem(this.storageKey);
        } catch (e) {
            console.error('Error clearing music state:', e);
        }
    }

    /**
     * Save current music state
     */
    saveState(musicState) {
        try {
            this._storage().setItem(this.storageKey, JSON.stringify(musicState));
        } catch (e) {
            console.error('Error saving music state:', e);
        }
    }

    /**
     * Load music state
     */
    loadState() {
        try {
            const savedState = this._storage().getItem(this.storageKey);
            if (!savedState) return null;
            const parsed = JSON.parse(savedState);
            if (parsed && typeof parsed.currentSong === 'string') {
                parsed.currentSong = normalizeMusicAssetPath(parsed.currentSong);
            }
            return parsed;
        } catch (e) {
            console.error('Error loading music state:', e);
            return null;
        }
    }

    /**
     * Build music state object from current playback state.
     * @param {number} [targetVolume] Preferred user volume (slider / MusicVolumeService target).
     *   Do not pass `backgroundMusic.volume` — fades set that to 0.
     * @param {number} [lastAudibleVolume] Last non-zero level for unmute restore.
     */
    buildState(
        backgroundMusic,
        currentSong,
        isShuffling,
        currentSongIndex,
        shuffleQueue,
        isLooping,
        targetVolume,
        lastAudibleVolume,
    ) {
        if (!backgroundMusic) return null;

        const volume = (typeof targetVolume === 'number' && !Number.isNaN(targetVolume))
            ? Math.max(0, Math.min(1, targetVolume))
            : backgroundMusic.volume;
        const lastAudible = (typeof lastAudibleVolume === 'number' && lastAudibleVolume > 0)
            ? Math.min(1, lastAudibleVolume)
            : (volume > 0 ? volume : 0.1);

        return {
            currentSong: currentSong,
            currentTime: backgroundMusic.currentTime,
            paused: backgroundMusic.paused,
            volume,
            lastAudibleVolume: lastAudible,
            muted: backgroundMusic.muted,
            isShuffling: isShuffling,
            currentSongIndex: currentSongIndex,
            shuffleQueue: isShuffling ? shuffleQueue.map(s => s.filename) : null,
            isLooping: !!isLooping && !isShuffling
        };
    }
}

