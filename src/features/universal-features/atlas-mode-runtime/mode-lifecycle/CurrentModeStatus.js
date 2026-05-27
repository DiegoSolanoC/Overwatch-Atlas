/**
 * Single source of truth for the persisted "current mode" of the app
 * (`'menu' | 'globe' | 'glossary' | 'biography' | 'heroBiography' | 'storyTimeline' | 'dialogueTheater' | 'officialResources'`).
 * Stored in `localStorage`
 * under one key so the loader, orchestrator, and helpers all agree on what
 * mode the app thinks it's in across reloads. A missing value means `'menu'`.
 */

const CURRENT_MODE_STORAGE_KEY = 'currentMode';

/**
 * Reads the persisted mode. Returns the raw stored value, or `null` if unset
 * or `localStorage` is unavailable. For a defaulted, normalized value use
 * {@link getCurrentModeOrMenu}.
 *
 * @returns {string | null}
 */
export function getCurrentMode() {
    try {
        return localStorage.getItem(CURRENT_MODE_STORAGE_KEY);
    } catch (_) {
        return null;
    }
}

/**
 * Reads the persisted mode and normalizes it: missing → `'menu'`, lower-cased.
 *
 * @returns {string}
 */
export function getCurrentModeOrMenu() {
    return (getCurrentMode() || 'menu').toString().toLowerCase();
}

/**
 * Persists the active mode. Pass `'menu'` when returning to the hub.
 *
 * @param {string} mode
 */
export function setCurrentMode(mode) {
    try {
        localStorage.setItem(CURRENT_MODE_STORAGE_KEY, mode);
    } catch (_) {
        /* storage unavailable — ignore */
    }
}

/**
 * Removes the persisted mode (used on fresh page loads and after killing a mode).
 */
export function clearCurrentMode() {
    try {
        localStorage.removeItem(CURRENT_MODE_STORAGE_KEY);
    } catch (_) {
        /* storage unavailable — ignore */
    }
}
