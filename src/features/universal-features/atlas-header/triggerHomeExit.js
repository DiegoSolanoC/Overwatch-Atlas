/**
 * Shared “return to main menu” via the header Home control (not in-mode Cancel).
 */

import { getCurrentMode } from '../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';
import { normalizeAtlasMode } from '../atlas-mode-runtime/atlasModes.js';

/** Canonical + legacy keys → window kill function name. */
const PLACEHOLDER_MODE_KILL_FN = {
    gallery: 'killGalleryComponents',
    story: 'killStoryComponents',
    dialoguetheater: 'killDialogueTheaterComponents',
    officialarchive: 'killOfficialArchiveComponents',
    herobiography: 'killGalleryComponents',
    storytimeline: 'killStoryComponents',
    officialresources: 'killOfficialArchiveComponents',
};

/**
 * @param {string} currentMode
 * @returns {Promise<boolean>}
 */
export async function killPlaceholderModeIfActive(currentMode) {
    const compact = normalizeAtlasMode(currentMode).replace(/[\s_-]/g, '');
    const fnName =
        PLACEHOLDER_MODE_KILL_FN[compact] ||
        PLACEHOLDER_MODE_KILL_FN[(currentMode || '').toLowerCase().replace(/[\s_-]/g, '')];
    if (!fnName || typeof window[fnName] !== 'function') {
        return false;
    }
    await window[fnName]();
    return true;
}

/**
 * @returns {Promise<boolean>}
 */
export async function killPlaceholderModeFromDomIfPresent() {
    if (document.getElementById('atlasGalleryHost')) {
        if (typeof window.killGalleryComponents === 'function') {
            await window.killGalleryComponents();
            return true;
        }
    }
    const storyViewer = document.getElementById('storyViewerContainer');
    if (
        storyViewer?.classList.contains('story-viewer-container--timeline-mode') &&
        typeof window.killStoryComponents === 'function'
    ) {
        await window.killStoryComponents();
        return true;
    }
    if (document.getElementById('atlasEmptyModeHost')) {
        const stored = getCurrentMode();
        if (stored && (await killPlaceholderModeIfActive(stored))) {
            return true;
        }
    }
    return false;
}

export function triggerHomeExit() {
    const homeBtn = document.getElementById('homeBtn');
    if (!homeBtn) return false;
    homeBtn.click();
    return true;
}
