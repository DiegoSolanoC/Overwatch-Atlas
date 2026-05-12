/**
 * sfxFadeOut — schedules a delayed volume ramp on an `HTMLAudioElement`.
 *
 * Used by `SoundEffectsService.play()` to support the
 * `{ fadeOutAfterMs, fadeOutDurationMs }` option; the timers are stored on
 * the element itself so that re-playing the same clip can clear them.
 */

const FADE_STEPS = 30;

/** @param {HTMLAudioElement | null | undefined} audioEl */
export function clearFadeTimers(audioEl) {
    if (!audioEl) return;
    if (audioEl._fadeInterval) {
        clearInterval(audioEl._fadeInterval);
        audioEl._fadeInterval = null;
    }
    if (audioEl._fadeTimeout) {
        clearTimeout(audioEl._fadeTimeout);
        audioEl._fadeTimeout = null;
    }
}

/**
 * @param {HTMLAudioElement | null | undefined} audioEl
 * @param {{ fadeOutAfterMs?: number, fadeOutDurationMs?: number }} [opts]
 */
export function scheduleFadeOut(audioEl, { fadeOutAfterMs = 0, fadeOutDurationMs = 0 } = {}) {
    if (!audioEl) return;
    const after = Math.max(0, fadeOutAfterMs || 0);
    const dur = Math.max(0, fadeOutDurationMs || 0);
    if (!after || !dur) return;

    clearFadeTimers(audioEl);

    audioEl._fadeTimeout = setTimeout(() => {
        const stepMs = Math.max(10, Math.floor(dur / FADE_STEPS));
        const startVol = audioEl.volume;
        let i = 0;
        audioEl._fadeInterval = setInterval(() => {
            i++;
            const t = Math.min(1, i / FADE_STEPS);
            audioEl.volume = startVol * (1 - t);
            if (t >= 1) {
                clearInterval(audioEl._fadeInterval);
                audioEl._fadeInterval = null;
                audioEl.volume = 0;
            }
        }, stepMs);
    }, after);
}
