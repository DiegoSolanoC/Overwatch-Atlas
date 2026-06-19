/**
 * Resolve faction biography logo paths for a story event or timeline index.
 */

import {
    DEFAULT_FACTION_LOOK,
    buildFactionDefaultImagePath,
    buildFactionImagePath,
} from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';
import { resolveLookForStoryEvent, resolveLookForTimelineIndex } from './heroBiographyLookRangesResolve.js';
import { getLooksForFaction, loadFactionBiosLooksMap } from './loadFactionBiosLooks.js';
import { resolveGalleryFactionFilename } from './galleryConnectionCanvasEntityResolve.js';

/** @type {Record<string, string[]> | null} */
let cachedFactionLooksMap = null;

/**
 * @returns {Promise<Record<string, string[]>>}
 */
export async function loadFactionBiographyLooksMap() {
    if (!cachedFactionLooksMap) {
        cachedFactionLooksMap = await loadFactionBiosLooksMap();
    }
    return cachedFactionLooksMap;
}

export function clearFactionBiographyLooksMapCache() {
    cachedFactionLooksMap = null;
    installFactionEventSlidePortraitLooksBridge();
}

/**
 * @param {string} factionFilename
 * @returns {string}
 */
export function normalizeFactionPortraitKey(factionFilename) {
    const token = String(factionFilename || '').trim();
    if (!token) return '';
    return resolveGalleryFactionFilename(token) || token;
}

/**
 * @param {string} factionFilename
 * @param {Record<string, string[]>} factionLooksMap
 * @param {object} event
 * @returns {string}
 */
export function resolveFactionLookNameForStoryEvent(
    factionFilename,
    factionLooksMap,
    event,
) {
    const key = normalizeFactionPortraitKey(factionFilename);
    if (!key || !event) return DEFAULT_FACTION_LOOK;

    const looks = getLooksForFaction(factionLooksMap, key);
    const resolved = resolveLookForStoryEvent('factions', key, event, looks);
    return resolved || DEFAULT_FACTION_LOOK;
}

/**
 * @param {string} factionFilename
 * @param {number} timelineIndex
 * @param {Record<string, string[]>} factionLooksMap
 * @returns {string}
 */
export function resolveFactionLookNameForTimelineIndex(
    factionFilename,
    timelineIndex,
    factionLooksMap,
) {
    const key = normalizeFactionPortraitKey(factionFilename);
    if (!key || timelineIndex < 0) return DEFAULT_FACTION_LOOK;

    const looks = getLooksForFaction(factionLooksMap, key);
    const resolved = resolveLookForTimelineIndex('factions', key, timelineIndex, looks);
    return resolved || DEFAULT_FACTION_LOOK;
}

/**
 * @param {string} factionFilename
 * @param {string} [lookName]
 * @returns {string}
 */
export function buildFactionBiographyPortraitSrc(factionFilename, lookName) {
    const key = normalizeFactionPortraitKey(factionFilename);
    if (!key) return '';
    if (lookName) return buildFactionImagePath(key, lookName);
    return buildFactionDefaultImagePath(key);
}

/**
 * @returns {Record<string, string[]>}
 */
export function getFactionBiographyLooksMapSync() {
    return cachedFactionLooksMap || {};
}

/**
 * @param {string} factionFilename
 * @param {object} event
 * @returns {string}
 */
export function buildFactionPortraitSrcForStoryEventSync(factionFilename, event) {
    const key = normalizeFactionPortraitKey(factionFilename);
    if (!key) return '';
    const lookName = resolveFactionLookNameForStoryEvent(
        key,
        getFactionBiographyLooksMapSync(),
        event,
    );
    return buildFactionBiographyPortraitSrc(key, lookName);
}

/**
 * Classic-script bridge for `slideStoryFilterPlaces.js`.
 */
export function installFactionEventSlidePortraitLooksBridge() {
    if (typeof window === 'undefined') return;
    window.__FactionEventSlidePortraitLooks = {
        buildPortraitSrcForStoryEvent: buildFactionPortraitSrcForStoryEventSync,
    };
}

installFactionEventSlidePortraitLooksBridge();

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
 * @param {object} event
 * @param {ParentNode | Document} [root]
 */
export async function refreshEventSlideFactionPortraitLooks(event, root = document) {
    if (!event || !root) return;

    const imgs = root.querySelectorAll('[data-bio-portrait-category="factions"]');
    if (!imgs.length) return;

    let factionLooksMap = {};
    try {
        factionLooksMap = await loadFactionBiographyLooksMap();
    } catch {
        factionLooksMap = {};
    }

    for (let i = 0; i < imgs.length; i += 1) {
        const img = imgs[i];
        if (!(img instanceof HTMLImageElement)) continue;

        const displayKey = img.dataset.bioPortraitKey || '';
        const entityKey = normalizeFactionPortraitKey(displayKey);
        if (!entityKey) continue;

        const lookName = resolveFactionLookNameForStoryEvent(
            entityKey,
            factionLooksMap,
            event,
        );
        applyPortraitSrc(img, buildFactionBiographyPortraitSrc(entityKey, lookName));
    }
}
