/**
 * localStorage persistence for character voiceline master volume
 * (theater dialogue + gallery catchphrases).
 */

const STORAGE_KEY = 'characterVolume';

/**
 * @param {number} fallback
 * @returns {number}
 */
export function loadSavedCharacterVolume(fallback) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return fallback;
    const v = parseFloat(saved);
    if (isNaN(v) || v < 0 || v > 1) return fallback;
    return v;
}

/** @param {number} volume */
export function saveCharacterVolume(volume) {
    localStorage.setItem(STORAGE_KEY, volume.toString());
}
