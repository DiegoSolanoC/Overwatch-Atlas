/**
 * MusicControlService — control button event handlers (volume, mute, pause, skip, shuffle, loop).
 */

import { wireVolumeSlider, wireMuteButton } from '../panel/musicControlVolumeMute.js';
import {
    wirePauseButton,
    wireSkipButton,
    wireLoopButton,
    wireShuffleButton
} from '../panel/musicTransportButtons.js';

export class MusicControlService {
    constructor(backgroundMusic, volumeService, shuffleService, iconService, onStateChange, musicService) {
        this.backgroundMusic = backgroundMusic;
        this.volumeService = volumeService;
        this.shuffleService = shuffleService;
        this.iconService = iconService;
        this.onStateChange = onStateChange;
        this.musicService = musicService || null;
        this.onShuffleEnabled = null;

        this.volumeSlider = null;
        this.volumeValue = null;
        this.muteBtn = null;
        this.pauseBtn = null;
        this.skipBtn = null;
        this.loopBtn = null;
        this.shuffleBtn = null;
    }

    syncCatalogLoopFlag() {
        if (!this.backgroundMusic || !this.musicService) return;
        if (this.musicService._musicMode !== 'catalog') return;
        this.backgroundMusic.loop = !!(this.musicService.isLooping && !this.shuffleService.isShuffling);
    }

    init() {
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.muteBtn = document.getElementById('muteBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.skipBtn = document.getElementById('skipBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
    }

    setupAllControls(musicFiles, currentSong, onSkip) {
        wireVolumeSlider(this);
        wireMuteButton(this);
        wirePauseButton(this);
        wireSkipButton(this, onSkip);
        wireLoopButton(this);
        wireShuffleButton(this, musicFiles, currentSong);
    }

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

        if (this.musicService && this.loopBtn) {
            const looping = !!this.musicService.isLooping;
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
