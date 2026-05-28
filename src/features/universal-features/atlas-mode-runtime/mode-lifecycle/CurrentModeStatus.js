/**
 * Single source of truth for the persisted "current mode" of the app.
 * Stored in `localStorage` under one key so the loader, orchestrator, and
 * helpers all agree on what mode the app thinks it's in across reloads.
 *
 * Canonical ids: see `../atlasModes.js` (`world`, `codex`, `dataWorkshop`, …).
 */

import { ATLAS_MODE, normalizeAtlasMode } from '../atlasModes.js';

const CURRENT_MODE_STORAGE_KEY = 'currentMode';

/**
 * @returns {string | null} Raw stored value (may be a legacy id).
 */
export function getCurrentMode() {
    try {
        return localStorage.getItem(CURRENT_MODE_STORAGE_KEY);
    } catch (_) {
        return null;
    }
}

/**
 * @returns {import('../atlasModes.js').AtlasModeId | 'menu'}
 */
export function getCurrentModeOrMenu() {
    return normalizeAtlasMode(getCurrentMode() || ATLAS_MODE.MENU);
}

/**
 * @param {string} mode Canonical or legacy mode id (normalized before persist).
 */
export function setCurrentMode(mode) {
    try {
        localStorage.setItem(CURRENT_MODE_STORAGE_KEY, normalizeAtlasMode(mode));
    } catch (_) {
        /* storage unavailable — ignore */
    }
}

export function clearCurrentMode() {
    try {
        localStorage.removeItem(CURRENT_MODE_STORAGE_KEY);
    } catch (_) {
        /* storage unavailable — ignore */
    }
}
