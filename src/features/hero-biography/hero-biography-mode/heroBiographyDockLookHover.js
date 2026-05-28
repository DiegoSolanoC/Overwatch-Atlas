/**
 * Dock thumbnail hover → preview hero biography look from configured event ranges.
 */

import { isHeroBiographyDockFilterActive } from './heroBiographyDockTimeline.js';
import { resolveLookForStoryEvent } from './heroBiographyLookRangesResolve.js';
import { getLooksForHero, loadHeroBiosLooksMap } from './loadHeroBiosLooks.js';
import {
    commitHeroBiographyLook,
    getActiveHeroBiographySelection,
    previewHeroBiographyLook,
} from './heroBiographySelection.js';

/** @type {boolean} */
let hoverPreviewActive = false;

/** @type {string | null} */
let lastHoverResolvedLook = null;

/**
 * @param {object} event
 */
export async function onHeroBiographyDockEventHover(event) {
    if (!isHeroBiographyDockFilterActive() || !event) return;

    const selection = getActiveHeroBiographySelection();
    if (!selection?.heroFilterKey) return;

    try {
        const map = await loadHeroBiosLooksMap();
        const looks = getLooksForHero(map, selection.heroFilterKey);
        const look = resolveLookForStoryEvent(selection.heroFilterKey, event, looks);

        if (look === lastHoverResolvedLook) return;

        lastHoverResolvedLook = look;

        if (!look) return;

        hoverPreviewActive = true;
        previewHeroBiographyLook(look);
    } catch {
        /* ignore */
    }
}

export function onHeroBiographyDockEventHoverEnd() {
    const lookToKeep = lastHoverResolvedLook;
    resetHeroBiographyDockLookHoverState();
    hoverPreviewActive = false;

    if (lookToKeep) {
        commitHeroBiographyLook(lookToKeep);
    }
}

export function resetHeroBiographyDockLookHoverState() {
    lastHoverResolvedLook = null;
}
