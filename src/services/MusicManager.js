/**
 * MusicManager - Manages music panel functionality
 * Coordinates music playback, shuffle, volume, progress bar, and state persistence
 * Init logic extracted to MusicManagerInitHelpers (deslop: Small Functions, SRP)
 */

if (typeof getLogAssetLoad === 'undefined') {
    var getLogAssetLoad = function () {
        return (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function') 
            ? window.logAssetLoad 
            : function () {};
    };
}

class MusicManager {
    constructor() {
        this.initialized = false;
        this.currentSong = null;
        this.musicFiles = [];
        this.hasStartedPlaying = false;
        this.nowPlayingBadge = null;
        this.nowPlayingBadgeText = null;
        this._nowPlayingLastText = null;
        this._nowPlayingSwapTimeout = null;
        this._nowPlayingSwapTimeout2 = null;
        this._nowPlayingFollowRafId = null;
        this._nowPlayingFollowCleanup = null;
        this.musicStateSaveTimeout = null;
        this.stateService = null;
        this.shuffleService = null;
        this.volumeService = null;
        this.progressService = null;
        this.playbackService = null;
        this.fileService = null;
        this.panelService = null;
        this.iconService = null;
        this.controlService = null;
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
        this.pauseBtnIcon = null;
        this.muteBtnIcon = null;
        this.skipBtnIcon = null;
        this.shuffleBtnIcon = null;
        /** @type {'startup'|'ambient'|'catalog'} */
        this._musicMode = 'catalog';
        /** Catalog-only: repeat current track (mutually exclusive with shuffle in UI). */
        this.isLooping = false;
        /** Reposition passive now-playing label after header hub resort (e.g. palette loads after music). */
        this._owtlHeaderHubListenerAttached = false;
        /** When event image overlay closes, refresh passive badge visibility (was suppressed while open). */
        this._eventImageOverlayMo = null;
        this._eventImageOverlaySyncTimer = null;
    }

    /** Same coordinate space as `SummaryInfoBadge` (under-button passive label). */
    _getBodyScale() {
        try {
            const t = window.getComputedStyle(document.body).transform;
            if (!t || t === 'none') return 1;
            const m = t.match(/^matrix\(([^)]+)\)$/);
            if (!m) return 1;
            const parts = m[1].split(',').map(s => parseFloat(s.trim()));
            const a = parts[0];
            return (Number.isFinite(a) && a > 0) ? a : 1;
        } catch (_) {
            return 1;
        }
    }

    _ensureNowPlayingBadge() {
        if (this.nowPlayingBadge && this.nowPlayingBadgeText) return;
        let badge = document.getElementById('musicNowPlayingBadge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'musicNowPlayingBadge';
            badge.className = 'music-now-playing-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = `
                <div class="music-now-playing-label">Now playing:</div>
                <div class="music-now-playing-spacer-top" aria-hidden="true"></div>
                <div class="music-now-playing-badge-title-row">
                    <img class="music-playing-disc music-playing-disc--badge" src="assets/images/icons/Playing Icon.png" alt="" width="36" height="36" decoding="async" />
                    <div class="music-now-playing-song"></div>
                </div>
                <div class="music-now-playing-spacer-bottom" aria-hidden="true"></div>
                <img class="music-now-playing-underline" src="assets/images/misc/Badge Underline.png" alt="" aria-hidden="true" />
            `;
            document.body.appendChild(badge);
        }
        this.nowPlayingBadge = badge;
        this.nowPlayingBadgeText = badge.querySelector('.music-now-playing-song');
    }

    /** Spin disc icons only while audio is actively playing (not paused / no track). */
    _updatePlayingDiscSpinning() {
        if (!this.backgroundMusic) return;
        const playing = !!(this.currentSong && !this.backgroundMusic.paused);
        try {
            document.querySelectorAll('.music-playing-disc').forEach((img) => {
                img.classList.toggle('music-playing-disc--spinning', playing);
            });
        } catch (_) {}
    }

    /** Header hub resort (e.g. palette loads after music) moves #musicToggle — always resolve fresh. */
    _syncMusicToggleButton() {
        const el = typeof document !== 'undefined' ? document.getElementById('musicToggle') : null;
        if (el) this.musicButton = el;
        return this.musicButton;
    }

    _positionNowPlayingBadge() {
        const btn = this._syncMusicToggleButton();
        if (!btn) return;
        this._ensureNowPlayingBadge();
        const badge = this.nowPlayingBadge;
        if (!badge) return;

        const scale = this._getBodyScale();
        const musicRect = btn.getBoundingClientRect();
        const gap = 2;

        // Anchor against the current center stage width (main#content), not viewport.
        // This makes badge position slide with panel open/close layout changes.
        const contentRect = document.getElementById('content')?.getBoundingClientRect() || null;
        const leftPos = contentRect
            ? ((contentRect.left + (contentRect.width * 0.75)) / scale)
            : (Math.max(1, (window.innerWidth || 1) / scale) * 0.75);

        const top = (musicRect.bottom + gap) / scale;

        badge.style.left = `${leftPos}px`;
        badge.style.right = '';
        badge.style.top = `${top}px`;
    }

    _isEventImageOverlayOpen() {
        const overlay = document.getElementById('eventImageOverlay');
        return !!(overlay && overlay.classList.contains('open'));
    }

    /**
     * Re-run badge visibility after #eventImageOverlay stops blocking it (any code path).
     */
    _installEventImageOverlayNowPlayingSync() {
        if (this._eventImageOverlayMo) return;
        const overlay = document.getElementById('eventImageOverlay');
        if (!overlay || typeof MutationObserver === 'undefined') return;
        const self = this;
        const scheduleRefresh = () => {
            if (self._eventImageOverlaySyncTimer) clearTimeout(self._eventImageOverlaySyncTimer);
            self._eventImageOverlaySyncTimer = setTimeout(() => {
                self._eventImageOverlaySyncTimer = null;
                if (typeof self.updateNowPlaying !== 'function') return;
                if (self._isEventImageOverlayOpen()) return;
                try {
                    self.updateNowPlaying();
                } catch (_) {}
            }, 0);
        };
        this._eventImageOverlayMo = new MutationObserver(() => scheduleRefresh());
        this._eventImageOverlayMo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    _onHeaderHubMutated() {
        // Don't reposition badge - it's anchored from left edge and should grow rightward
    }

    _startNowPlayingBadgeFollow() {
        this._stopNowPlayingBadgeFollow();
        this._syncMusicToggleButton();
        this._positionNowPlayingBadge();
        // Reposition on layout changes (panel open/close shifts dock/header geometry).
        let pending = null;
        const schedule = () => {
            if (pending != null) return;
            pending = requestAnimationFrame(() => {
                pending = null;
                if (!this.nowPlayingBadge || !this.nowPlayingBadge.classList.contains('music-now-playing-badge--visible')) return;
                if (this._isEventImageOverlayOpen()) {
                    this.nowPlayingBadge.classList.remove('music-now-playing-badge--visible');
                    this._stopNowPlayingBadgeFollow();
                    return;
                }
                this._positionNowPlayingBadge();
            });
        };
        const onViewport = () => schedule();
        window.addEventListener('resize', onViewport);
        window.addEventListener('scroll', onViewport, true);
        const observerTargets = [
            document.getElementById('filtersPanel'),
            document.getElementById('eventSlide'),
            document.getElementById('eventsManagePanel'),
            document.querySelector('.layout-container'),
        ].filter(Boolean);
        let mo = null;
        if (typeof MutationObserver !== 'undefined' && observerTargets.length > 0) {
            mo = new MutationObserver(() => schedule());
            observerTargets.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }));
        }
        this._nowPlayingFollowCleanup = () => {
            window.removeEventListener('resize', onViewport);
            window.removeEventListener('scroll', onViewport, true);
            if (mo) mo.disconnect();
            if (pending != null) {
                cancelAnimationFrame(pending);
                pending = null;
            }
        };
    }

    _stopNowPlayingBadgeFollow() {
        try {
            if (this._nowPlayingFollowCleanup) {
                this._nowPlayingFollowCleanup();
                this._nowPlayingFollowCleanup = null;
            }
            if (this._nowPlayingFollowRafId) cancelAnimationFrame(this._nowPlayingFollowRafId);
        } catch (_) {}
        this._nowPlayingFollowRafId = null;
    }

    _setNowPlayingBadgeVisible(visible) {
        this._ensureNowPlayingBadge();
        if (!this.nowPlayingBadge) return;
        if (this._isEventImageOverlayOpen()) {
            this.nowPlayingBadge.classList.remove('music-now-playing-badge--visible');
            this._stopNowPlayingBadgeFollow();
            return;
        }
        // Never show on mobile (too cramped; user requested hidden).
        try {
            if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
                this.nowPlayingBadge.classList.remove('music-now-playing-badge--visible');
                this._stopNowPlayingBadgeFollow();
                return;
            }
        } catch (_) {}
        this.nowPlayingBadge.classList.toggle('music-now-playing-badge--visible', !!visible);
        if (visible) this._startNowPlayingBadgeFollow();
        else this._stopNowPlayingBadgeFollow();
    }

    _transitionNowPlayingBadgeText(nextText) {
        this._ensureNowPlayingBadge();
        if (!this.nowPlayingBadge || !this.nowPlayingBadgeText) return;
        const textEl = this.nowPlayingBadgeText;

        // Clear pending swaps.
        try {
            if (this._nowPlayingSwapTimeout) clearTimeout(this._nowPlayingSwapTimeout);
            if (this._nowPlayingSwapTimeout2) clearTimeout(this._nowPlayingSwapTimeout2);
        } catch (_) {}
        this._nowPlayingSwapTimeout = null;
        this._nowPlayingSwapTimeout2 = null;

        // If first paint, set immediately.
        if (!this._nowPlayingLastText) {
            textEl.textContent = nextText;
            textEl.classList.remove('music-now-playing-song--swap-out', 'music-now-playing-song--swap-in');
            this._nowPlayingLastText = nextText;
            // Don't reposition badge - it's anchored from left edge and should grow rightward
            return;
        }

        if (nextText === this._nowPlayingLastText) return;

        // Fade out quickly, swap, fade in.
        textEl.classList.remove('music-now-playing-song--swap-in');
        textEl.classList.add('music-now-playing-song--swap-out');

        this._nowPlayingSwapTimeout = setTimeout(() => {
            textEl.textContent = nextText;
            this._nowPlayingLastText = nextText;
            // Don't reposition badge - it's anchored from left edge and should grow rightward
            textEl.classList.remove('music-now-playing-song--swap-out');
            textEl.classList.add('music-now-playing-song--swap-in');

            this._nowPlayingSwapTimeout2 = setTimeout(() => {
                textEl.classList.remove('music-now-playing-song--swap-in');
            }, 220);
        }, 140);
    }
    
    init() {
        if (this.initialized && this.musicButton && this.musicPanel) {
            console.log('Music panel already initialized, skipping...');
            return;
        }
        
        var logAssetLoad = getLogAssetLoad();
        
        this.musicButton = document.getElementById('musicToggle');
        this.musicPanel = document.getElementById('filtersPanel') || document.getElementById('musicPanel');
        this.musicPanelClose = document.getElementById('filtersPanelClose') || document.getElementById('musicPanelClose');
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.muteBtn = document.getElementById('muteBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.skipBtn = document.getElementById('skipBtn');
        this.musicGrid = document.getElementById('musicGrid');
        
        if (!this.musicButton || !this.musicPanel || !this.backgroundMusic || !this.musicGrid) {
            console.warn('MusicManager: Required DOM elements not found yet.');
            return;
        }

        // Create the passive "Now Playing" badge under the Music button.
        this._ensureNowPlayingBadge();
        
        this.initialized = true;
        console.log('MusicManager: Initializing with all elements present');
        
        // Sync sound effects slider with actual volume (slider is created with music panel, after SoundEffectsManager.init())
        if (window.SoundEffectsManager && typeof window.SoundEffectsManager.setupSoundEffectsSlider === 'function') {
            window.SoundEffectsManager.setupSoundEffectsSlider();
        }
        
        var missing = [];
        if (!window.MusicStateService) missing.push('MusicStateService');
        if (!window.MusicShuffleService) missing.push('MusicShuffleService');
        if (!window.MusicVolumeService) missing.push('MusicVolumeService');
        if (!window.MusicProgressService) missing.push('MusicProgressService');
        if (!window.MusicPlaybackService) missing.push('MusicPlaybackService');
        if (!window.MusicFileService) missing.push('MusicFileService');
        if (!window.MusicPanelService) missing.push('MusicPanelService');
        if (!window.MusicIconService) missing.push('MusicIconService');
        if (!window.MusicControlService) missing.push('MusicControlService');
        if (missing.length > 0) {
            console.error('MusicManager: Missing services:', missing);
            return;
        }
        
        var self = this;
        this.stateService = new window.MusicStateService();
        if (window.MusicStateService.isLocalDevHost()) {
            try {
                localStorage.removeItem(this.stateService.storageKey);
            } catch (e) { /* ignore */ }
        }
        this.shuffleService = new window.MusicShuffleService();
        this.volumeService = new window.MusicVolumeService(this.backgroundMusic);
        this.progressService = new window.MusicProgressService(this.backgroundMusic);
        this.playbackService = new window.MusicPlaybackService(this.backgroundMusic);
        this.fileService = new window.MusicFileService();
        this.panelService = new window.MusicPanelService(this.musicButton, this.musicPanel, this.musicPanelClose);
        this.iconService = new window.MusicIconService();
        this.controlService = new window.MusicControlService(
            this.backgroundMusic,
            this.volumeService,
            this.shuffleService,
            this.iconService,
            function () { return self.saveMusicState(); },
            this
        );
        
        this.progressService.init();
        this.iconService.init();
        this.controlService.init();
        
        var savedState = this.stateService.loadState();
        var prioritySong = null;
        var initialVolume = 0.1;
        if (savedState) {
            if (savedState.currentSong) {
                var PHP = window.MusicPaletteDefaultHelpers;
                var ambientOnlySaved = PHP && typeof PHP.isAmbientPath === 'function'
                    && PHP.isAmbientPath(savedState.currentSong)
                    && !(PHP.isStartupThemePath && PHP.isStartupThemePath(savedState.currentSong));
                if (!ambientOnlySaved) {
                    prioritySong = savedState.currentSong;
                    logAssetLoad('MUSIC_PRIORITY', 'Priority loading: ' + prioritySong);
                }
            }
            if (savedState.volume !== undefined && savedState.volume > 0) {
                initialVolume = savedState.volume;
            }
        }
        window.prioritySong = prioritySong;
        
        this.volumeService.setTargetVolume(initialVolume);
        this.backgroundMusic.volume = initialVolume;
        if (this.volumeSlider) this.volumeSlider.value = Math.round(initialVolume * 100);
        if (this.volumeValue) this.volumeValue.textContent = Math.round(initialVolume * 100) + '%';

        // Start fetching the resumed track on the main audio element as early as possible
        if (prioritySong && this.backgroundMusic && this.playbackService) {
            try {
                this.backgroundMusic.preload = 'auto';
                var earlyEnc = this.playbackService.encodeMusicPath(prioritySong);
                this.backgroundMusic.src = earlyEnc;
                this.playbackService.setCurrentSong(prioritySong);
                this.currentSong = prioritySong;
                this.backgroundMusic.load();
            } catch (earlyErr) {
                console.warn('MusicManager: early track preload failed', earlyErr);
            }
        }

        var fadeIn = function () {
            self.volumeService.fadeIn(self.progressService.isSeeking, self.progressService.isDragging);
        };
        var fadeOut = function () {
            self.volumeService.fadeOut(
                self.progressService.isSeeking,
                self.progressService.isDragging,
                function () {
                    if (self._musicMode === 'catalog' && !self.shuffleService.isShuffling && self.isLooping && !self.progressService.isInteracting()) {
                        self.backgroundMusic.currentTime = 0;
                        setTimeout(function () {
                            if (!self.backgroundMusic.paused && !self.progressService.isInteracting()) {
                                fadeIn();
                            }
                        }, 50);
                    }
                }
            );
        };
        
        var H = window.MusicManagerInitHelpers || {};
        var playMusic = H.createPlayMusic ? H.createPlayMusic(this) : (function () {
            console.warn('MusicManagerInitHelpers not loaded');
            return function () {};
        })();
        this._playMusic = playMusic;
        var playNextSong = H.createPlayNextSong ? H.createPlayNextSong(this, playMusic) : function () {};

        this._transitionToAmbientLoop = function () {
            var PH = window.MusicPaletteDefaultHelpers;
            var path = PH && PH.getAmbientLoopPath ? PH.getAmbientLoopPath() : 'assets/audio/Default.ogg';
            playMusic(path);
            self.updateNowPlaying();
            self.saveMusicState();
        };

        if (H.setupFadeAndEndBehavior) {
            H.setupFadeAndEndBehavior(this, {
                fadeIn: fadeIn,
                fadeOut: fadeOut,
                playNextSong: playNextSong,
                transitionToAmbient: function () {
                    self._transitionToAmbientLoop();
                }
            });
        }

        this.controlService.onShuffleEnabled = function () {
            if (self._musicMode === 'ambient' || self._musicMode === 'startup') {
                playNextSong();
            }
        };

        window.encodeMusicPath = function (path) { return self.playbackService.encodeMusicPath(path); };

        // Pass providers so shuffle uses latest async-loaded file list + current song.
        this.controlService.setupAllControls(
            () => this.musicFiles,
            () => this.currentSong,
            playNextSong
        );

        this.backgroundMusic.addEventListener('play', function () {
            if (self.pauseBtn) {
                self.pauseBtn.classList.remove('active');
                self.iconService.updatePauseIcon(false);
            }
            self._updatePlayingDiscSpinning();
        });
        this.backgroundMusic.addEventListener('pause', function () {
            if (self.pauseBtn) {
                self.pauseBtn.classList.add('active');
                self.iconService.updatePauseIcon(true);
            }
            self._updatePlayingDiscSpinning();
        });
        this.backgroundMusic.addEventListener('ended', function () {
            self._updatePlayingDiscSpinning();
        });

        var getCurrentSongName = function () {
            if (!self.currentSong) return 'No song playing';
            var s = self.musicFiles.find(function (e) {
                return self.currentSong && self.currentSong.endsWith('/' + e.filename);
            });
            return s ? s.name : 'Unknown';
        };

        this.updateNowPlaying = function () {
            var PH0 = window.MusicPaletteDefaultHelpers;
            var path = self.currentSong;
            var hideTrackTitle = !!(path && PH0 && (
                (typeof PH0.isStartupThemePath === 'function' && PH0.isStartupThemePath(path)) ||
                (typeof PH0.isAmbientPath === 'function' && PH0.isAmbientPath(path))
            ));

            var el = document.getElementById('musicCurrentSong');
            var npRow = document.getElementById('musicNowPlaying');
            if (npRow) {
                npRow.classList.toggle('music-now-playing--hide-track-title', hideTrackTitle);
            }

            var name = hideTrackTitle ? '' : getCurrentSongName();
            if (el) el.textContent = name;

            // Passive badge: catalog only (no title for startup / site ambience).
            var panelOpen = !!(self.musicPanel &&
                self.musicPanel.classList.contains('open') &&
                (self.musicPanel.dataset.panelMode === 'music' || self.musicPanel.id === 'musicPanel'));
            var shouldShow = !!(path && !panelOpen && !hideTrackTitle);
            self._setNowPlayingBadgeVisible(shouldShow);
            if (shouldShow) {
                self._transitionNowPlayingBadgeText(name);
            }
            self._updatePlayingDiscSpinning();
        };
        self._installEventImageOverlayNowPlayingSync();
        this.updateProgressBar = function () { self.progressService.updateProgressBar(); };
        this.formatTime = function (sec) { return self.progressService.formatTime(sec); };

        this.progressService.setupEventListeners(function () { self.saveMusicState(); });

        this.backgroundMusic.addEventListener('timeupdate', function () {
            if (!self.progressService.isInteracting()) {
                self.updateProgressBar();
            }
            if (!self.musicStateSaveTimeout) {
                self.musicStateSaveTimeout = setTimeout(function () {
                    self.saveMusicState();
                    self.musicStateSaveTimeout = null;
                }, 1000);
            }
        });

        window.addEventListener('beforeunload', function () {
            if (window.saveMusicState) window.saveMusicState();
        });
        window.addEventListener('pagehide', function () {
            if (window.saveMusicState) window.saveMusicState();
        }, true);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden' && window.saveMusicState) {
                window.saveMusicState();
            }
        });

        this.saveMusicState = function () {
            if (!self.backgroundMusic) return;
            var st = self.stateService.buildState(
                self.backgroundMusic,
                self.currentSong,
                self.shuffleService.isShuffling,
                self.shuffleService.currentSongIndex,
                self.shuffleService.shuffleQueue,
                self.isLooping
            );
            if (st) self.stateService.saveState(st);
        };
        window.saveMusicState = this.saveMusicState;
        
        this.restoreMusicState = function () {
            return (H.restoreMusicState && H.restoreMusicState(this)) || false;
        };

        this.createMusicButtons = function () {
            self.fileService.createMusicButtons(
                self.musicGrid,
                self.currentSong,
                function (songPath) {
                    playMusic(songPath);
                    self.updateNowPlaying();
                    self.saveMusicState();
                },
                function (path) { return self.playbackService.encodeMusicPath(path); },
                function (btnPath, songPath) { return self.playbackService.matchesSongPath(btnPath, songPath); }
            );
        };
        
        if (H.setupPlayOnInteraction) {
            H.setupPlayOnInteraction(this, playMusic);
        }

        if (!this.panelService || !this.musicButton) {
            console.error('MusicManager: panelService or musicButton is null');
            return;
        }
        this.panelService.setupToggleButton(function (isOpen) {
            // Keep passive badge hidden while panel is open (manual switching).
            if (isOpen) {
                self._setNowPlayingBadgeVisible(false);
                return;
            }

            // Panel closed: refresh + show current song (song may have changed while panel was open).
            try {
                self.updateNowPlaying();
                // Don't reposition badge - it's anchored from left edge and should grow rightward
            } catch (_) {}
        });
        this.panelService.setupCloseButton();

        if (!this._owtlHeaderHubListenerAttached) {
            this._owtlHeaderHubListenerAttached = true;
            try {
                window.addEventListener('owtl-header-hub-mutated', () => this._onHeaderHubMutated());
            } catch (_) { /* ignore */ }
        }
        
        this.controlService.initializeButtonStates();
        this._updatePlayingDiscSpinning();

        if (H.loadMusicFiles) {
            H.loadMusicFiles(this, playMusic);
        }
    }

    /**
     * If shuffle is off and the current track is the previous palette's default, switch to this palette's default.
     * Includes fade out/in transition for smooth palette switching.
     */
    onPaletteChanged(previousPalette, newPalette) {
        const H = typeof window !== 'undefined' ? window.MusicPaletteDefaultHelpers : null;
        if (!H || !this.initialized) return;
        if (!this.musicFiles || this.musicFiles.length === 0) return;
        const prev = H.normalizePaletteKey(previousPalette);
        const next = H.normalizePaletteKey(newPalette);
        if (prev === next) return;

        if (!this.shuffleService.isShuffling && this._musicMode === 'startup' && typeof this._playMusic === 'function') {
            const themePath = H.getStartupThemePath(next);
            if (themePath) {
                const self = this;
                // Fade out, swap track, wait briefly, then fade in for dramatic effect
                this.volumeService.fadeOut(false, false, function () {
                    self._playMusic(themePath);
                    // Brief pause before fade in (300ms silence for dramatic effect)
                    setTimeout(function () {
                        self.volumeService.fadeIn(false, false);
                    }, 300);
                    self.updateNowPlaying();
                    self.saveMusicState();
                });
            }
        }

        if (typeof this.createMusicButtons === 'function') {
            this.createMusicButtons();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicManager;
}
if (typeof window !== 'undefined') {
    window.MusicManager = new MusicManager();
}
