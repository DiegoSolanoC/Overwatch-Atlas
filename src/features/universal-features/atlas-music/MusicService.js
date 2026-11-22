/**
 * MusicService — root coordinator for the music panel.
 *
 * `init()` walks through Initialization/ in order:
 *   assemble -> prepare startup state -> activate (which kicks off the boot sequence).
 */

import { MusicNowPlayingBadge } from './now-playing-badge/MusicNowPlayingBadge.js';
import { syncNowPlayingUi } from './now-playing-badge/syncNowPlayingUi.js';
import { getAmbientLoopPath } from './musicPaletteThemes.js';
import { applyMusicPaletteChange } from './applyMusicPaletteChange.js';
import { createPlayMusic, createPlayNextSong } from './playback/musicPlayAndAdvance.js';
import { restoreMusicState } from './Initialization/musicRestoreFromStorage.js';
import { resolveMusicDomElements, constructMusicChildServices } from './Initialization/assembleMusicService.js';
import { applyInitialVolumeAndPriorityPreload } from './Initialization/prepareMusicStartupState.js';
import { activateMusicService } from './Initialization/activateMusicService.js';
import {
    buildMusicGridCategoryHooks,
    getActiveCategorySongs,
} from './panel/musicCategoryChrome.js';
import { renderMusicTileBoard } from './panel/musicGridButtons.js';

const noop = () => {};

export class MusicService {
    constructor() {
        this.initialized = false;
        this.currentSong = null;
        this.musicFiles = [];
        this.hasStartedPlaying = false;
        this.musicStateSaveTimeout = null;

        this.stateService = null;
        this.shuffleService = null;
        this.volumeService = null;
        this.progressService = null;
        this.playbackService = null;
        this.fileService = null;
        this.categoryService = null;
        this.panelService = null;
        this.iconService = null;
        this.controlService = null;
        this._musicCategoryChromeMounted = false;
        this.refreshMusicCategoryPicker = null;
        /** When true, active category shows add/remove boards instead of play-only. */
        this.categoryEditMode = false;

        this.musicButton = null;
        this.musicPanel = null;
        this.musicPanelClose = null;
        this.backgroundMusic = null;
        this.volumeSlider = null;
        this.volumeValue = null;
        this.muteBtn = null;
        this.pauseBtn = null;
        this.skipBtn = null;
        this.musicGrid = null;

        /** @type {'startup'|'ambient'|'catalog'} */
        this._musicMode = 'catalog';
        this.isLooping = false;

        this._headerHubListenerAttached = false;

        this.nowPlayingBadge = new MusicNowPlayingBadge();

        this._playMusic = noop;
    }

    updateNowPlaying() {
        syncNowPlayingUi(this);
    }

    updateProgressBar() {
        this.progressService.updateProgressBar();
    }

    formatTime(sec) {
        return this.progressService.formatTime(sec);
    }

    saveMusicState() {
        if (!this.backgroundMusic) return;
        const st = this.stateService.buildState(
            this.backgroundMusic,
            this.currentSong,
            this.shuffleService.isShuffling,
            this.shuffleService.currentSongIndex,
            this.shuffleService.shuffleQueue,
            this.isLooping,
            this.volumeService?.getTargetVolume?.(),
            this.volumeService?.lastAudibleVolume,
        );
        if (st) this.stateService.saveState(st);
    }

    restoreMusicState() {
        return restoreMusicState(this);
    }

    createMusicButtons() {
        const activeId = this.categoryService?.getActiveCategoryId?.() ?? null;
        const editing = !!(activeId && this.categoryEditMode);
        const playSong = (songPath) => {
            this._playMusic(songPath);
            this.updateNowPlaying();
            this.saveMusicState();
        };

        if (editing) {
            // Edit mode: green tiles = in group (click removes). Out-grid adds.
            renderMusicTileBoard(getActiveCategorySongs(this), this.musicGrid, {
                emptyMessage: 'No songs in this category yet. Click tiles below to add them.',
                markAllSelected: true,
                onSongActivate: (song) => {
                    this.categoryService.removeSongFromCategory(song.filename, activeId);
                    this.createMusicButtons();
                },
            });
        } else {
            const files = activeId
                ? getActiveCategorySongs(this)
                : (this.musicFiles || []);
            this.fileService.createMusicButtons(
                this.musicGrid,
                this.currentSong,
                playSong,
                (btnPath, songPath) => this.playbackService.matchesSongPath(btnPath, songPath),
                {
                    files,
                    categoryHooks: buildMusicGridCategoryHooks(this),
                    emptyMessage: activeId
                        ? 'No songs in this category yet. Turn on the gear to add some.'
                        : 'No music files found.',
                },
            );
        }

        if (typeof this.refreshMusicCategoryPicker === 'function') {
            this.refreshMusicCategoryPicker();
        }
    }

    _transitionToAmbientLoop() {
        this._playMusic(getAmbientLoopPath());
        this.updateNowPlaying();
        this.saveMusicState();
    }

    init() {
        if (this.initialized && this.musicButton && this.musicPanel) return;

        resolveMusicDomElements(this);

        if (!this.musicButton || !this.musicPanel || !this.backgroundMusic || !this.musicGrid) {
            console.warn('MusicService: required DOM elements not found yet.');
            return;
        }

        this.nowPlayingBadge.ensureMounted();
        this.initialized = true;

        if (window.SoundEffectsManager && typeof window.SoundEffectsManager.setupSoundEffectsSlider === 'function') {
            window.SoundEffectsManager.setupSoundEffectsSlider();
        }
        if (window.CharacterVolumeManager && typeof window.CharacterVolumeManager.setupCharacterVolumeSlider === 'function') {
            window.CharacterVolumeManager.setupCharacterVolumeSlider();
        }

        constructMusicChildServices(this);

        this.progressService.init();
        this.iconService.init();
        this.controlService.init();

        applyInitialVolumeAndPriorityPreload(this);

        const playMusic = createPlayMusic(this);
        this._playMusic = playMusic;
        const playNextSong = createPlayNextSong(this, playMusic);

        activateMusicService(this, playMusic, playNextSong);
    }

    onPaletteChanged(previousPalette, newPalette) {
        applyMusicPaletteChange(this, previousPalette, newPalette);
    }
}

if (typeof window !== 'undefined') {
    window.MusicManager = new MusicService();
}
