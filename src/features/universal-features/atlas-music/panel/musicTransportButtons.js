/**
 * musicTransportButtons — pause / skip / loop / shuffle wiring for `MusicControlService`.
 *
 * Each `wire*` is idempotent: previously attached handlers (stored on the
 * button under `_loopHandler` / `_shuffleHandler`) are detached first so the
 * service can re-init without leaks.
 */

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wirePauseButton(ctrl) {
    if (!ctrl.pauseBtn) return;

    ctrl.pauseBtn.addEventListener('click', () => {
        if (ctrl.backgroundMusic.paused) {
            ctrl.backgroundMusic.play();
            ctrl.pauseBtn.classList.remove('active');
            ctrl.iconService.updatePauseIcon(false);
        } else {
            ctrl.backgroundMusic.pause();
            ctrl.pauseBtn.classList.add('active');
            ctrl.iconService.updatePauseIcon(true);
        }

        if (ctrl.onStateChange) ctrl.onStateChange();
    });
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireSkipButton(ctrl, onSkip) {
    if (!ctrl.skipBtn) return;

    ctrl.skipBtn.addEventListener('click', () => {
        if (onSkip) onSkip();
    });
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireLoopButton(ctrl) {
    if (!ctrl.loopBtn || !ctrl.musicService) return;

    const old = ctrl.loopBtn._loopHandler;
    if (old) {
        try { ctrl.loopBtn.removeEventListener('click', old); } catch (_) { /* ignore */ }
    }

    const handler = () => {
        const next = !ctrl.musicService.isLooping;
        ctrl.musicService.isLooping = next;

        if (next && ctrl.shuffleService.isShuffling) {
            ctrl.shuffleService.disableShuffle();
            if (ctrl.shuffleBtn) ctrl.shuffleBtn.classList.remove('active');
            ctrl.iconService.updateShuffleIcon(false);
        }

        ctrl.loopBtn.classList.toggle('active', next);
        ctrl.iconService.updateLoopIcon(next);
        ctrl.syncCatalogLoopFlag();

        if (ctrl.onStateChange) ctrl.onStateChange();
    };

    ctrl.loopBtn._loopHandler = handler;
    ctrl.loopBtn.addEventListener('click', handler);
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireShuffleButton(ctrl, musicFiles, currentSong) {
    if (!ctrl.shuffleBtn) return;

    const resolve = (v) => (typeof v === 'function') ? v() : v;

    const old = ctrl.shuffleBtn._shuffleHandler;
    if (old) {
        try { ctrl.shuffleBtn.removeEventListener('click', old); } catch (_) { /* ignore */ }
    }

    const handler = () => {
        const files = resolve(musicFiles) || [];
        const song = resolve(currentSong) || null;

        if (ctrl.shuffleService.isShuffling) {
            ctrl.shuffleService.disableShuffle();
            ctrl.shuffleBtn.classList.remove('active');
            ctrl.iconService.updateShuffleIcon(false);
        } else {
            if (!files || files.length === 0) return;
            if (ctrl.musicService) {
                ctrl.musicService.isLooping = false;
                if (ctrl.loopBtn) ctrl.loopBtn.classList.remove('active');
                ctrl.iconService.updateLoopIcon(false);
            }
            ctrl.shuffleService.enableShuffle(files, song);
            ctrl.shuffleBtn.classList.add('active');
            ctrl.iconService.updateShuffleIcon(true);
            if (ctrl.onShuffleEnabled && typeof ctrl.onShuffleEnabled === 'function') {
                ctrl.onShuffleEnabled();
            }
        }

        ctrl.syncCatalogLoopFlag();

        if (ctrl.onStateChange) ctrl.onStateChange();
    };

    ctrl.shuffleBtn._shuffleHandler = handler;
    ctrl.shuffleBtn.addEventListener('click', handler);
}
