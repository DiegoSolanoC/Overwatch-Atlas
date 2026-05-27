/**
 * Shared “return to main menu” via the header Home control (not in-mode Cancel).
 */

import { getCurrentMode } from '../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';

/** Keys must match `getCurrentModeOrMenu()` (always lower-case). */
const PLACEHOLDER_MODE_KILL_FN = {
    herobiography: 'killHeroBiographyComponents',
    storytimeline: 'killStoryTimelineComponents',
    dialoguetheater: 'killDialogueTheaterComponents',
    officialresources: 'killOfficialResourcesComponents',
};

/**
 * Runs the same teardown as clicking Home for WIP / placeholder linear modes.
 *
 * @param {string} currentMode - From `getCurrentModeOrMenu()` (lower-case).
 * @returns {Promise<boolean>} True when a placeholder kill ran.
 */
export async function killPlaceholderModeIfActive(currentMode) {
    const fnName = PLACEHOLDER_MODE_KILL_FN[(currentMode || '').toLowerCase()];
    if (!fnName || typeof window[fnName] !== 'function') {
        return false;
    }
    await window[fnName]();
    return true;
}

/**
 * DOM fallback when storage is out of sync but a placeholder host is still mounted.
 *
 * @returns {Promise<boolean>}
 */
export async function killPlaceholderModeFromDomIfPresent() {
    if (document.getElementById('atlasHeroBiographyHost')) {
        if (typeof window.killHeroBiographyComponents === 'function') {
            await window.killHeroBiographyComponents();
            return true;
        }
    }
    if (document.getElementById('atlasEmptyModeHost')) {
        const stored = getCurrentMode();
        if (stored && (await killPlaceholderModeIfActive(stored))) {
            return true;
        }
    }
    return false;
}

/**
 * Programmatically activates the header Home button (overlay, SFX, menu restore).
 *
 * @returns {boolean} False when `#homeBtn` is missing.
 */
export function triggerHomeExit() {
    const homeBtn = document.getElementById('homeBtn');
    if (!homeBtn) return false;
    homeBtn.click();
    return true;
}
