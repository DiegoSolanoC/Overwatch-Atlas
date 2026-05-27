/**
 * sfxAudioUnlock — gets browsers (esp. desktop Chrome after WebGL) to
 * accept programmatic SFX playback by triggering one silent play under a
 * user gesture.
 *
 * `unlockAudioElement(el)` does the silent play; the service holds a
 * one-shot guard so it only runs once. `installFirstGestureUnlock(unlock)`
 * wires `click` / `touchstart` / `keydown` listeners that call back into
 * the service the first time the user interacts with the page.
 */

/**
 * @param {HTMLAudioElement | null | undefined} audioEl
 */
export function unlockAudioElement(audioEl) {
    if (!audioEl) return;
    const prevVolume = audioEl.volume;
    audioEl.volume = 0;
    const p = audioEl.play();
    if (p && typeof p.then === 'function') {
        p.then(() => {
            audioEl.pause();
            audioEl.currentTime = 0;
            audioEl.volume = prevVolume;
        }).catch(() => {
            audioEl.volume = prevVolume;
        });
    } else {
        audioEl.volume = prevVolume;
    }
}

/**
 * Installs first-gesture listeners that call `runUnlock()` once and detach
 * themselves immediately after.
 *
 * @param {() => void} runUnlock
 */
export function installFirstGestureUnlock(runUnlock) {
    const onFirstGesture = () => {
        runUnlock();
        document.removeEventListener('click', onFirstGesture, true);
        document.removeEventListener('touchstart', onFirstGesture, true);
        document.removeEventListener('keydown', onFirstGesture, true);
    };
    document.addEventListener('click', onFirstGesture, true);
    document.addEventListener('touchstart', onFirstGesture, true);
    document.addEventListener('keydown', onFirstGesture, true);
}
