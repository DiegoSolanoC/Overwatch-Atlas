/**
 * musicResumePlaybackPosition — seek to saved `currentTime` once `<audio>` is ready.
 */

function normalizeUrlFilename(urlOrPath) {
    try {
        let seg = (urlOrPath || '').split('/').pop() || '';
        seg = seg.split('?')[0];
        return decodeURIComponent(seg).toLowerCase();
    } catch (_) {
        try {
            return ((urlOrPath || '').split('/').pop() || '').split('?')[0].toLowerCase();
        } catch (_e2) {
            return '';
        }
    }
}

/** True if the audio element is already loading/loaded the same logical file (skip redundant load()). */
export function audioElementMatchesLogicalPath(audioEl, logicalPath, encodeMusicPathFn) {
    if (!audioEl || !logicalPath || typeof encodeMusicPathFn !== 'function') return false;
    if (!audioEl.src) return false;
    const enc = encodeMusicPathFn(logicalPath);
    try {
        if (audioEl.src === new URL(enc, window.location.href).href) return true;
    } catch (_) { /* ignore */ }
    const want = normalizeUrlFilename(enc);
    const have = normalizeUrlFilename(audioEl.src);
    return want.length > 0 && have === want;
}

/**
 * @param {import('../MusicService.js').MusicService} service
 */
export function applyResumeFromSavedState(service, musicStateRef) {
    const bg = service.backgroundMusic;
    if (!bg || !musicStateRef) return;

    let applied = false;
    const tRaw = musicStateRef.currentTime;
    let wantSeek = tRaw !== undefined && tRaw !== null && !isNaN(tRaw) && tRaw > 0.2;

    const cleanupListeners = () => {
        bg.removeEventListener('loadedmetadata', restorePosition);
        bg.removeEventListener('canplay', restorePosition);
        bg.removeEventListener('canplaythrough', restorePosition);
        bg.removeEventListener('durationchange', restorePosition);
    };

    const restorePosition = () => {
        if (applied) return;
        if (bg.readyState < 2) return;
        const dur = bg.duration;
        if (wantSeek && (!isFinite(dur) || dur <= 0)) return;

        applied = true;
        cleanupListeners();
        if (failSafeTimer) {
            clearTimeout(failSafeTimer);
            failSafeTimer = null;
        }

        if (wantSeek) {
            try {
                bg.currentTime = Math.min(Math.max(0, tRaw), Math.max(0, dur - 0.05));
            } catch (_) { /* ignore */ }
        }
        if (musicStateRef.paused) {
            bg.pause();
            service.iconService.updatePauseIcon(true);
            if (service.pauseBtn) service.pauseBtn.classList.add('active');
        } else {
            setTimeout(() => {
                const p2 = bg.play();
                if (p2 !== undefined) {
                    p2.then(() => {
                        service.iconService.updatePauseIcon(false);
                        if (service.pauseBtn) service.pauseBtn.classList.remove('active');
                    }).catch(() => {
                        bg.pause();
                        service.iconService.updatePauseIcon(true);
                        if (service.pauseBtn) service.pauseBtn.classList.add('active');
                    });
                }
            }, 50);
        }
        if (service.progressService && service.progressService.updateProgressBar) {
            service.progressService.updateProgressBar();
        }
    };

    let failSafeTimer = setTimeout(() => {
        if (!applied) {
            wantSeek = false;
            restorePosition();
        }
    }, 10000);

    bg.addEventListener('loadedmetadata', restorePosition);
    bg.addEventListener('canplay', restorePosition);
    bg.addEventListener('canplaythrough', restorePosition);
    bg.addEventListener('durationchange', restorePosition);
    restorePosition();
    setTimeout(restorePosition, 200);
    setTimeout(restorePosition, 600);
    setTimeout(restorePosition, 1600);
}
