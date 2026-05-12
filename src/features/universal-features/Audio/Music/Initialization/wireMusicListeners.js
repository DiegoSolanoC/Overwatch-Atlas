/**
 * wireMusicListeners — registers all init-time event listeners for MusicService:
 *   - audio element (play/pause/ended/timeupdate -> UI sync + autosave)
 *   - page lifecycle (beforeunload/pagehide/visibilitychange -> autosave)
 *   - music panel toggle (open/close -> badge visibility, idempotent)
 *
 * Each function fires once during `activateMusicService`.
 */

import { updatePlayingDiscSpinning } from '../now-playing-badge/musicPlayingDiscSpinSync.js';

const noop = () => {};

/** @param {import('../MusicService.js').MusicService} service */
export function wireBackgroundAudioListeners(service) {
    const bg = service.backgroundMusic;

    bg.addEventListener('play', () => {
        if (service.pauseBtn) {
            service.pauseBtn.classList.remove('active');
            service.iconService.updatePauseIcon(false);
        }
        updatePlayingDiscSpinning(bg, service.currentSong);
    });
    bg.addEventListener('pause', () => {
        if (service.pauseBtn) {
            service.pauseBtn.classList.add('active');
            service.iconService.updatePauseIcon(true);
        }
        updatePlayingDiscSpinning(bg, service.currentSong);
    });
    bg.addEventListener('ended', () => {
        updatePlayingDiscSpinning(bg, service.currentSong);
    });

    bg.addEventListener('timeupdate', () => {
        if (!service.progressService.isInteracting()) {
            service.updateProgressBar();
        }
        if (!service.musicStateSaveTimeout) {
            service.musicStateSaveTimeout = setTimeout(() => {
                service.saveMusicState();
                service.musicStateSaveTimeout = null;
            }, 1000);
        }
    });
}

/**
 * Save music state on tab close / hide. No `service` arg — the listeners
 * call the global `window.saveMusicState` published in `activateMusicService`.
 */
export function wirePersistenceListeners() {
    window.addEventListener('beforeunload', () => {
        if (window.saveMusicState) window.saveMusicState();
    });
    window.addEventListener('pagehide', () => {
        if (window.saveMusicState) window.saveMusicState();
    }, true);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && window.saveMusicState) {
            window.saveMusicState();
        }
    });
}

/** @param {import('../MusicService.js').MusicService} service */
export function wirePanelToggle(service) {
    service.panelService.setupToggleButton((isOpen) => {
        if (isOpen) {
            service.nowPlayingBadge.setVisible(false);
            return;
        }
        try { service.updateNowPlaying(); } catch (_) { /* ignore */ }
    });
    service.panelService.setupCloseButton();

    if (!service._headerHubListenerAttached) {
        service._headerHubListenerAttached = true;
        try {
            window.addEventListener('owtl-header-hub-mutated', noop);
        } catch (_) { /* ignore */ }
    }
}
