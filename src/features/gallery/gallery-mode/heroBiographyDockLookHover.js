/**
 * Dock thumbnail hover → preview biography look from configured event ranges (heroes + factions).
 */

import { isHeroBiographyDockFilterActive } from './heroBiographyDockTimeline.js';
import {
    getStoryTimelineIndexForEvent,
    resolveLookForStoryEvent,
} from './heroBiographyLookRangesResolve.js';
import { getLooksForFaction, loadFactionBiosLooksMap } from './loadFactionBiosLooks.js';
import { getLooksForHero, loadHeroBiosLooksMap } from './loadHeroBiosLooks.js';
import {
    clearDockPreviewTimelineIndex,
    refreshGalleryConnectionPortraitLooks,
    setDockPreviewTimelineIndex,
} from './heroBiographyConnectionPortraitLooks.js';
import {
    commitHeroBiographyLook,
    getActiveHeroBiographySelection,
    previewHeroBiographyLook,
} from './heroBiographySelection.js';

/** @type {string | null} */
let lastHoverResolvedLook = null;

/** @type {number | null} */
let lastHoverTimelineIndex = null;

/**
 * @param {object} event
 */
export async function onHeroBiographyDockEventHover(event) {
    if (!isHeroBiographyDockFilterActive() || !event) return;

    const selection = getActiveHeroBiographySelection();
    if (!selection?.filterKey) return;
    if (selection.category !== 'heroes' && selection.category !== 'factions') return;

    const timelineIndex = getStoryTimelineIndexForEvent(event);
    if (timelineIndex >= 0) {
        const timelineChanged = timelineIndex !== lastHoverTimelineIndex;
        setDockPreviewTimelineIndex(timelineIndex);
        lastHoverTimelineIndex = timelineIndex;
        if (timelineChanged) {
            await refreshGalleryConnectionPortraitLooks();
        }
    }

    try {
        const looks =
            selection.category === 'factions'
                ? getLooksForFaction(
                    await loadFactionBiosLooksMap(),
                    selection.filterKey,
                )
                : getLooksForHero(
                    await loadHeroBiosLooksMap(),
                    selection.filterKey,
                );
        const look = resolveLookForStoryEvent(
            selection.category,
            selection.filterKey,
            event,
            looks,
        );

        if (look === lastHoverResolvedLook) return;

        lastHoverResolvedLook = look;

        if (!look) return;

        previewHeroBiographyLook(look);
    } catch {
        /* ignore */
    }
}

export async function onHeroBiographyDockEventHoverEnd() {
    const lookToKeep = lastHoverResolvedLook;
    resetHeroBiographyDockLookHoverState();

    if (lookToKeep) {
        commitHeroBiographyLook(lookToKeep);
    }

    await refreshGalleryConnectionPortraitLooks();
}

export function resetHeroBiographyDockLookHoverState() {
    lastHoverResolvedLook = null;
    lastHoverTimelineIndex = null;
    clearDockPreviewTimelineIndex();
}
