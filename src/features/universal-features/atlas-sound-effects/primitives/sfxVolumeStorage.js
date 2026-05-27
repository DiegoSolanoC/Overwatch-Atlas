/**
 * sfxVolumeStorage — `localStorage` persistence for the SFX master volume
 * (a single 0..1 number). Keyed `soundEffectsVolume` for back-compat with
 * pre-existing user data.
 */

const STORAGE_KEY = 'soundEffectsVolume';

/**
 * @param {number} fallback - Returned if no saved value or value out of range.
 * @returns {number}
 */
export function loadSavedSfxVolume(fallback) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return fallback;
    const v = parseFloat(saved);
    if (isNaN(v) || v < 0 || v > 1) return fallback;
    return v;
}

/** @param {number} volume */
export function saveSfxVolume(volume) {
    localStorage.setItem(STORAGE_KEY, volume.toString());
}
