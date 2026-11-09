/**
 * MusicPanelService — open/close wiring for the music UI inside `#filtersPanel`
 * (toggle button, close button, moving `.music-panel-content` into the panel).
 */

import {
    restoreEventImageOverlayAfterSidePanel,
} from '../../../system-interface/interface-filter-menu/panel/panelSideImageOverlaySync.js';
import { closeEventInfoPanelIfOpen } from '../../../system-interface/interface-shared/closeEventInfoPanelIfOpen.js';

const MUSIC_GESTURE_MS = 900;

function markMusicGesture() {
    const until = Date.now() + MUSIC_GESTURE_MS;
    try {
        window.__atlasMusicGestureUntil = until;
    } catch (_) { /* ignore */ }

    /* Swallow ghost clicks/taps that land on Filters after a Music touch. */
    const sink = (event) => {
        if (Date.now() >= until) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest('#filtersToggle')) return;
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
    };
    const cleanup = () => {
        document.removeEventListener('click', sink, true);
        document.removeEventListener('touchend', sink, true);
    };
    document.addEventListener('click', sink, true);
    document.addEventListener('touchend', sink, true);
    setTimeout(cleanup, MUSIC_GESTURE_MS + 50);
    return until;
}

export class MusicPanelService {
    constructor(musicButton, musicPanel, musicPanelClose) {
        this.musicButton = musicButton;
        this.musicPanel = musicPanel;
        this.musicPanelClose = musicPanelClose;
        this._onToggle = null;
        this._toggleTeardown = null;
        this._closeTeardown = null;
    }

    /**
     * Setup panel toggle button handlers
     */
    setupToggleButton(onToggle) {
        if (!this.musicButton) {
            console.error('MusicPanelService: musicButton is null in setupToggleButton!');
            return;
        }
        if (typeof this._toggleTeardown === 'function') {
            try { this._toggleTeardown(); } catch (_) { /* ignore */ }
            this._toggleTeardown = null;
        }

        this._onToggle = (typeof onToggle === 'function') ? onToggle : null;
        const ac = new AbortController();
        const { signal } = ac;

        const ensureMusicContentMounted = () => {
            const filtersPanel = document.getElementById('filtersPanel');
            const musicPanel = document.getElementById('musicPanel');
            if (!filtersPanel || !musicPanel) return;
            const existing = filtersPanel.querySelector('.music-panel-content');
            if (existing) return;
            const musicContent = musicPanel.querySelector('.music-panel-content');
            if (!musicContent) return;
            filtersPanel.appendChild(musicContent);
            musicPanel.style.display = 'none';
        };

        const handleMusicToggle = (event) => {
            if (event) {
                event.stopPropagation();
                if (event.cancelable) event.preventDefault();
            }

            // Play music button sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('music');
            }

            ensureMusicContentMounted();

            // Close event management panel if open
            const eventsManagePanel = document.getElementById('eventsManagePanel');
            const eventsManageToggle = document.getElementById('eventsManageToggle');
            if (eventsManagePanel && eventsManagePanel.classList.contains('open')) {
                eventsManagePanel.classList.remove('open');
                try {
                    window.SummaryInfoBadge?.hide();
                } catch (_) {}
                if (eventsManageToggle) {
                    eventsManageToggle.classList.remove('active');
                }
            }

            const filtersPanel = document.getElementById('filtersPanel');
            const filterService = window.FilterService;
            const isMusicOpen = !!(filtersPanel &&
                filtersPanel.classList.contains('open') &&
                filtersPanel.dataset.panelMode === 'music');
            if (isMusicOpen) {
                if (filterService && typeof filterService.closePanel === 'function') {
                    filterService.closePanel();
                } else if (filtersPanel) {
                    filtersPanel.classList.add('panel--closing');
                    filtersPanel.classList.remove('open');
                    window.globeController?.requestStageLayoutSync?.();
                    const finish = () => {
                        filtersPanel.classList.remove('panel--closing');
                        restoreEventImageOverlayAfterSidePanel();
                        window.globeController?.requestStageLayoutSync?.();
                    };
                    const onEnd = (e) => {
                        if (e.target !== filtersPanel) return;
                        if (e.propertyName !== 'width' && e.propertyName !== 'flex-basis') return;
                        filtersPanel.removeEventListener('transitionend', onEnd);
                        clearTimeout(t);
                        finish();
                    };
                    filtersPanel.addEventListener('transitionend', onEnd);
                    const t = setTimeout(finish, 400);
                }
                this.musicButton.classList.remove('active');
            } else if (filterService && typeof filterService.openPanelWithMode === 'function') {
                filterService.openPanelWithMode('music');
            } else if (filtersPanel) {
                closeEventInfoPanelIfOpen();
                filtersPanel.classList.add('open');
                filtersPanel.dataset.panelMode = 'music';
                filtersPanel.classList.add('filters-panel--music-mode');
                filtersPanel.classList.remove('filters-panel--filters-mode');
                this.musicButton.classList.add('active');
            }

            const nowOpen = !!(filtersPanel &&
                filtersPanel.classList.contains('open') &&
                filtersPanel.dataset.panelMode === 'music');
            if (onToggle) onToggle(nowOpen);
        };

        // Prevent button from interfering with globe controls (mouse)
        this.musicButton.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        }, { signal });

        this.musicButton.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        }, { signal });

        /*
         * Portrait: touchend often cannot preventDefault (cancelable=false), so a
         * synthetic click still fires — sometimes on Filters, which then steals
         * music mode via “open+music → switch to filters”. Suppress that ghost click.
         */
        let touchStartTime = 0;
        let ignoreClickUntil = 0;
        this.musicButton.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        }, { passive: true, signal });

        this.musicButton.addEventListener('touchend', (event) => {
            event.stopPropagation();
            if (event.cancelable) event.preventDefault();
            if (Date.now() - touchStartTime < 300) {
                ignoreClickUntil = markMusicGesture();
                handleMusicToggle(event);
            }
        }, { signal });

        this.musicButton.addEventListener('click', (event) => {
            if (Date.now() < ignoreClickUntil || Date.now() < (window.__atlasMusicGestureUntil || 0)) {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
                return;
            }
            markMusicGesture();
            handleMusicToggle(event);
        }, { signal });

        this._toggleTeardown = () => {
            ac.abort();
            this._toggleTeardown = null;
        };
    }

    /**
     * Setup close button handler
     */
    setupCloseButton() {
        const closeButton = this.musicPanelClose || document.getElementById('filtersPanelClose');
        if (!closeButton) return;

        if (typeof this._closeTeardown === 'function') {
            try { this._closeTeardown(); } catch (_) { /* ignore */ }
            this._closeTeardown = null;
        }

        const ac = new AbortController();
        closeButton.addEventListener('click', () => {
            const filterService = window.FilterService;
            if (filterService && typeof filterService.getPanelMode === 'function' && filterService.getPanelMode() !== 'music') {
                return;
            }
            // Play music button sound when closing panel
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('music');
            }
            if (filterService && typeof filterService.getPanelMode === 'function' && filterService.getPanelMode() === 'music') {
                if (typeof filterService.closePanel === 'function') {
                    filterService.closePanel();
                }
            } else if (this.musicPanel) {
                this.musicPanel.classList.remove('open');
            }
            if (this.musicButton) {
                this.musicButton.classList.remove('active');
            }
            if (this._onToggle) {
                this._onToggle(false);
            }
        }, { signal: ac.signal });

        this._closeTeardown = () => {
            ac.abort();
            this._closeTeardown = null;
        };
    }
}
