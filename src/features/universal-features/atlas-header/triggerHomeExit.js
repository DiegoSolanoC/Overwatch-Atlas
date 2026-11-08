/**
 * Shared “return to main menu” via the header Home control (not in-mode Cancel).
 */

import { getCurrentMode } from '../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';
import { normalizeAtlasMode } from '../atlas-mode-runtime/atlasModes.js';

/** Canonical + legacy keys → window kill function name. */
const PLACEHOLDER_MODE_KILL_FN = {
    intel: 'killIntelComponents',
    mediagallery: 'killGalleryHubComponents',
    gallery: 'killIntelComponents',
    story: 'killStoryComponents',
    dialoguetheater: 'killDialogueTheaterComponents',
    officialarchive: 'killOfficialArchiveComponents',
    herobiography: 'killIntelComponents',
    conceptgallery: 'killIntelComponents',
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
    // Home / mode-switch callers restore the menu themselves — avoid a double
    // restore that fights EmptyModeShell chrome and flashes the globe.
    await window[fnName](false);
    return true;
}

/**
 * @returns {Promise<boolean>}
 */
export async function killPlaceholderModeFromDomIfPresent() {
    if (document.getElementById('atlasGalleryHost')) {
        const killIntel =
            typeof window.killIntelComponents === 'function'
                ? window.killIntelComponents
                : window.killGalleryComponents;
        if (typeof killIntel === 'function') {
            await killIntel(false);
            return true;
        }
    }
    const storyViewer = document.getElementById('storyViewerContainer');
    if (
        storyViewer?.classList.contains('story-viewer-container--timeline-mode') &&
        typeof window.killStoryComponents === 'function'
    ) {
        await window.killStoryComponents(false);
        return true;
    }
    if (document.getElementById('atlasEmptyModeHost')) {
        const stored = getCurrentMode();
        if (stored && (await killPlaceholderModeIfActive(stored))) {
            return true;
        }
        // Empty shell without a known mode key — prefer Gallery hub, then Archive.
        if (typeof window.killGalleryHubComponents === 'function') {
            await window.killGalleryHubComponents(false);
            return true;
        }
        if (typeof window.killOfficialArchiveComponents === 'function') {
            await window.killOfficialArchiveComponents(false);
            return true;
        }
    }
    if (document.getElementById('dialogueTheaterListHost')) {
        const stored = getCurrentMode();
        if (stored && (await killPlaceholderModeIfActive(stored))) {
            return true;
        }
        if (typeof window.killDialogueTheaterComponents === 'function') {
            await window.killDialogueTheaterComponents(false);
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

