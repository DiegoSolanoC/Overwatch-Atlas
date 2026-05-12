/**
 * wireMusicProgressBar — seek / drag listeners for the music progress
 * `<input type="range">` inside `#musicPanel`. Mirrors the `wire*` verb
 * convention used elsewhere in the music feature.
 */

/** @param {import('../services/MusicProgressService.js').MusicProgressService} progress */
export function wireMusicProgressBar(progress, onSeek) {
    if (!progress.progressBar) return;

    progress.progressBar.addEventListener('mousedown', () => {
        progress.isSeeking = true;
        progress.isDragging = true;
    });

    progress.progressBar.addEventListener('click', (e) => {
        if (progress.backgroundMusic) {
            const duration = progress.backgroundMusic.duration;
            if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                progress.seekToPosition(e.clientX);
                if (onSeek) onSeek();
            }
        }
    });

    progress.progressBar.addEventListener('mouseup', () => {
        progress.isSeeking = false;
        progress.isDragging = false;
    });

    progress.progressBar.addEventListener('mouseleave', () => {
        if (progress.isDragging) {
            progress.isSeeking = false;
            progress.isDragging = false;
        }
    });

    progress.progressBar.addEventListener('input', () => {
        if (progress.backgroundMusic && (progress.isSeeking || progress.isDragging)) {
            const duration = progress.backgroundMusic.duration;
            if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                const percent = progress.progressBar.value;
                const newTime = (percent / 100) * duration;
                progress.backgroundMusic.currentTime = newTime;
                progress.updateProgressBar();
                if (onSeek) onSeek();
            }
        }
    });

    progress.progressBar.addEventListener('change', () => {
        if (progress.backgroundMusic) {
            const duration = progress.backgroundMusic.duration;
            if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                const percent = progress.progressBar.value;
                const newTime = (percent / 100) * duration;
                progress.backgroundMusic.currentTime = newTime;
                progress.updateProgressBar();
                if (onSeek) onSeek();
            }
        }
        progress.isSeeking = false;
        progress.isDragging = false;
    });

    progress.progressBar.addEventListener('touchstart', () => {
        progress.isSeeking = true;
        progress.isDragging = true;
    });

    progress.progressBar.addEventListener('touchend', () => {
        progress.isSeeking = false;
        progress.isDragging = false;
    });
}
