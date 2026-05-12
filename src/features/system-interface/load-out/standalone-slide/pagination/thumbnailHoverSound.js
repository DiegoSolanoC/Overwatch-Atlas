/**
 * Shared module-level state for the continuous "radiate" sound that loops
 * while the user hovers a thumbnail / number button.
 *
 * The interval id needs to outlive any single render pass: hovering a button,
 * leaving it, and re-entering must reuse the same singleton so we never
 * stack multiple intervals. Two callers (wireNumberButtons and
 * updateSingleButtonContent) coordinate through these helpers.
 */

let _thumbnailHoverSoundInterval = null;

/**
 * Start (or restart) the loop. If a previous loop is active, it is cleared
 * first so callers never stack intervals. The play function is invoked once
 * synchronously and then every `intervalMs`.
 */
export function startThumbnailHoverSoundLoop(play, intervalMs = 1200) {
    stopThumbnailHoverSoundLoop();
    if (typeof play === 'function') {
        play();
        _thumbnailHoverSoundInterval = setInterval(play, intervalMs);
    }
}

/** Stop the loop if one is active. Safe to call when no loop is running. */
export function stopThumbnailHoverSoundLoop() {
    if (_thumbnailHoverSoundInterval) {
        clearInterval(_thumbnailHoverSoundInterval);
        _thumbnailHoverSoundInterval = null;
    }
}
