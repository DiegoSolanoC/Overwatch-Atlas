/**
 * Keeps every `.music-playing-disc` (panel + header badge) in sync with play/pause.
 */

import { SPIN_CLASS } from './musicNowPlayingBadgeCssClasses.js';

/**
 * @param {HTMLMediaElement|null|undefined} audioEl
 * @param {string|null|undefined} currentSong
 */
export function updatePlayingDiscSpinning(audioEl, currentSong) {
    if (!audioEl) return;
    const playing = !!(currentSong && !audioEl.paused);
    try {
        document.querySelectorAll('.music-playing-disc').forEach((img) => {
            img.classList.toggle(SPIN_CLASS, playing);
        });
    } catch (_) { /* ignore */ }
}
