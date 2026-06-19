/**
 * Faction biography logo variants on Codex nodes vs dock timeline page.
 * Uses the same look-range storage as the gallery; timeline index is the last
 * event on the current dock page (matches how users read forward on a page).
 */

import { s } from '../../codex-canvas/core/canvasSession.js';
import { getCodexDockPageIndexSpan } from './codexBioConnectionDockTimeline.js';
import {
    buildFactionBiographyPortraitSrc,
    clearFactionBiographyLooksMapCache,
    loadFactionBiographyLooksMap,
    normalizeFactionPortraitKey,
    resolveFactionLookNameForTimelineIndex,
} from '../../../gallery/gallery-mode/factionBiographyPortraitLooks.js';
import { buildFactionDefaultImagePath } from '../../../system-interface/interface-filter-menu/images/factionImagePaths.js';

/** @type {Map<string, string>} */
let lastFactionPortraitSrcByNodeId = new Map();

/** @type {(() => void) | null} */
let onLookRangesUpdated = null;

/**
 * @param {HTMLImageElement} img
 * @param {string} src
 */
function applyCodexFactionPortraitSrc(img, src) {
    if (!img || !src) return;

    const hasLoadedSrc = !!(img.getAttribute('src') || img.src);
    const pending = img.dataset.src || '';
    const current = hasLoadedSrc ? (img.getAttribute('src') || '') : pending;
    if (current === src) return;

    if (hasLoadedSrc) {
        img.src = src;
        return;
    }
    img.dataset.src = src;
}

/**
 * @param {number} timelineIndex
 * @param {Record<string, string[]>} factionLooksMap
 */
function applyCodexFactionPortraitLooksForTimelineIndex(timelineIndex, factionLooksMap) {
    if (!s.root || timelineIndex < 0) return;

    /** @type {Map<string, string>} */
    const nextSrcByNodeId = new Map();

    for (const [nodeId, nodeEl] of s.codexNodeElements) {
        if (!nodeEl || nodeEl.dataset.codexKind !== 'faction') continue;

        const factionFile = nodeEl.dataset.codexFactionFile || '';
        const entityKey = normalizeFactionPortraitKey(factionFile);
        if (!entityKey) continue;

        const lookName = resolveFactionLookNameForTimelineIndex(
            entityKey,
            timelineIndex,
            factionLooksMap,
        );
        const src = buildFactionBiographyPortraitSrc(entityKey, lookName);
        nextSrcByNodeId.set(nodeId, src);

        const prevSrc = lastFactionPortraitSrcByNodeId.get(nodeId);
        if (prevSrc === src) continue;

        const img = nodeEl.querySelector('.codex-node__img');
        if (!(img instanceof HTMLImageElement)) continue;
        applyCodexFactionPortraitSrc(img, src);
    }

    lastFactionPortraitSrcByNodeId = nextSrcByNodeId;
}

export function applyCodexFactionPortraitLooksNow() {
    if (!s.root) return;

    const span = getCodexDockPageIndexSpan();
    if (!span) return;

    void loadFactionBiographyLooksMap()
        .then((factionLooksMap) => {
            applyCodexFactionPortraitLooksForTimelineIndex(span.end, factionLooksMap);
        })
        .catch(() => {
            applyCodexFactionPortraitLooksForTimelineIndex(span.end, {});
        });
}

export function resetCodexFactionPortraitLookState() {
    lastFactionPortraitSrcByNodeId = new Map();
    if (!s.root) return;

    for (const nodeEl of s.codexNodeElements.values()) {
        if (!nodeEl || nodeEl.dataset.codexKind !== 'faction') continue;
        const factionFile = nodeEl.dataset.codexFactionFile || '';
        const entityKey = normalizeFactionPortraitKey(factionFile);
        if (!entityKey) continue;

        const img = nodeEl.querySelector('.codex-node__img');
        if (!(img instanceof HTMLImageElement)) continue;
        applyCodexFactionPortraitSrc(img, buildFactionDefaultImagePath(entityKey));
    }
}

/**
 * Re-apply logos when faction look ranges are edited in gallery dev tools.
 */
export function initCodexFactionPortraitLookListener() {
    if (onLookRangesUpdated || typeof window === 'undefined') return;

    onLookRangesUpdated = (ev) => {
        const category = ev?.detail?.category;
        if (category && category !== 'factions') return;
        clearFactionBiographyLooksMapCache();
        applyCodexFactionPortraitLooksNow();
    };
    window.addEventListener('bioBiographyLookRangesUpdated', onLookRangesUpdated);
}

export function teardownCodexFactionPortraitLookListener() {
    if (!onLookRangesUpdated || typeof window === 'undefined') return;
    window.removeEventListener('bioBiographyLookRangesUpdated', onLookRangesUpdated);
    onLookRangesUpdated = null;
}
