/**
 * Sync faction biography logos in gallery connections (list + canvas) with dock
 * timeline hover — same resolution rules as the main stage portrait.
 * Hero connection portraits always keep their default filter-chip thumbnails.
 */

import {
    DEFAULT_FACTION_LOOK,
    buildFactionDefaultImagePath,
} from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';
import {
    buildFactionBiographyPortraitSrc,
    loadFactionBiographyLooksMap,
    normalizeFactionPortraitKey,
    resolveFactionLookNameForTimelineIndex,
} from './factionBiographyPortraitLooks.js';
import { getActiveHeroBiographySelection } from './heroBiographySelection.js';

/** @type {number | null} */
let dockPreviewTimelineIndex = null;

/**
 * @param {number | null} index
 */
export function setDockPreviewTimelineIndex(index) {
    dockPreviewTimelineIndex = index != null && index >= 0 ? index : null;
}

export function clearDockPreviewTimelineIndex() {
    dockPreviewTimelineIndex = null;
}

/**
 * @returns {number | null}
 */
export function getDockPreviewTimelineIndex() {
    return dockPreviewTimelineIndex;
}

/**
 * @param {HTMLElement} img
 * @param {string} src
 */
function applyPortraitSrc(img, src) {
    if (!img || !src) return;
    const current = img.getAttribute('src') || '';
    if (current === src) return;
    img.src = src;
}

/**
 * @param {string} entityKey
 * @param {number | null} timelineIndex
 * @param {Record<string, string[]>} factionLooksMap
 * @param {{ category: string, filterKey: string, currentLook: string } | null} selection
 * @returns {string | null}
 */
function resolveFactionConnectionLook(
    entityKey,
    timelineIndex,
    factionLooksMap,
    selection,
) {
    const key = String(entityKey || '').trim();
    if (!key) return null;

    if (timelineIndex != null && timelineIndex >= 0) {
        return resolveFactionLookNameForTimelineIndex(key, timelineIndex, factionLooksMap);
    }

    if (
        selection
        && selection.category === 'factions'
        && selection.filterKey === key
    ) {
        return selection.currentLook || DEFAULT_FACTION_LOOK;
    }

    return null;
}

/**
 * Refresh faction logos in the gallery connections list and canvas.
 */
export async function refreshGalleryConnectionPortraitLooks() {
    const host = document.getElementById('atlasGalleryHost');
    if (!host) return;

    const timelineIndex = dockPreviewTimelineIndex;
    const selection = getActiveHeroBiographySelection();
    const dockPreviewActive = timelineIndex != null && timelineIndex >= 0;

    let factionLooksMap = {};
    if (dockPreviewActive) {
        try {
            factionLooksMap = await loadFactionBiographyLooksMap();
        } catch {
            factionLooksMap = {};
        }
    }

    const imgs = host.querySelectorAll('[data-bio-portrait-category="factions"]');

    for (let i = 0; i < imgs.length; i += 1) {
        const img = imgs[i];
        if (!(img instanceof HTMLImageElement)) continue;

        const displayKey = img.dataset.bioPortraitKey || '';
        const entityKey = normalizeFactionPortraitKey(displayKey);
        if (!entityKey) continue;

        const lookName = dockPreviewActive
            ? resolveFactionConnectionLook(
                entityKey,
                timelineIndex,
                factionLooksMap,
                selection,
            )
            : resolveFactionConnectionLook(
                entityKey,
                null,
                factionLooksMap,
                selection,
            );

        const src = lookName
            ? buildFactionBiographyPortraitSrc(entityKey, lookName)
            : buildFactionDefaultImagePath(entityKey);
        applyPortraitSrc(img, src);
    }
}
