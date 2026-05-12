/**
 * MusicPlaybackService — load source, `play()`, catalog next-track resolution, path matching.
 */

import { onceFiniteDurationReady } from '../playback/waitForFiniteAudioDuration.js';

export class MusicPlaybackService {
    constructor(backgroundMusic) {
        this.backgroundMusic = backgroundMusic;
        this.currentSong = null;
        this.musicFiles = [];
    }

    encodeMusicPath(path) {
        if (!path) return path;
        const parts = path.split('/');
        if (parts.length < 2) return path;
        const filename = parts[parts.length - 1];
        const dir = parts.slice(0, -1).join('/');
        return `${dir}/${encodeURIComponent(filename)}`;
    }

    setMusicFiles(musicFiles) {
        this.musicFiles = musicFiles;
    }

    setCurrentSong(songPath) {
        this.currentSong = songPath;
    }

    loadSong(songPath, isShuffling, onMetadataLoaded, loopOverride) {
        if (!songPath || !this.backgroundMusic) return;

        if (typeof loopOverride === 'boolean') {
            this.backgroundMusic.loop = loopOverride;
        } else {
            this.backgroundMusic.loop = !isShuffling;
        }

        const encodedPath = this.encodeMusicPath(songPath);
        this.backgroundMusic.src = encodedPath;
        this.currentSong = songPath;

        this.backgroundMusic.load();

        if (onMetadataLoaded) {
            onceFiniteDurationReady(this.backgroundMusic, onMetadataLoaded);
        }
    }

    async play(onFadeIn) {
        if (!this.backgroundMusic) return;

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
        } else if (onFadeIn) {
            onFadeIn();
        }
    }

    /** Next track in catalog order (shuffle uses `MusicShuffleService`). */
    getNextSong() {
        if (this.musicFiles.length === 0) return null;
        const cur = this.currentSong || '';
        let idx = this.musicFiles.findIndex((s) =>
            cur.endsWith('/' + s.filename) || decodeURIComponent(cur).endsWith('/' + s.filename)
        );
        if (idx < 0) idx = 0;
        else idx = (idx + 1) % this.musicFiles.length;
        return this.musicFiles[idx];
    }

    matchesSongPath(btnPath, songPath) {
        if (!btnPath || !songPath) return false;
        return btnPath === songPath
            || btnPath === songPath.replace(/ /g, '%20')
            || btnPath.replace(/ /g, '%20') === songPath
            || decodeURIComponent(btnPath) === decodeURIComponent(songPath);
    }
}
