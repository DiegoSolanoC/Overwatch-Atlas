/**
 * Dock timeline era filter — subsets pagination to events matching a selected era.
 */

import { getEraHoverPreviewSlug } from '../interface-shared/hover-badge/eraHoverPreviewTheme.js';

/** @type {string | null} */
let activeEraId = null;

/** @type {readonly { id: string, label: string, iconPath: string }[]} */
export const DOCK_ERA_MENU_OPTIONS = Object.freeze([
    {
        id: 'complete',
        label: 'Complete Timeline',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Complete%20Timeline.png',
    },
    {
        id: 'age-progress',
        label: 'The Age of Progress',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Age%20of%20Progress.png',
    },
    {
        id: 'omnic-crisis',
        label: 'The Omnic Crisis',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Omnic%20Crisis.png',
    },
    {
        id: 'golden-age',
        label: 'The Golden Age',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Golden%20Age.png',
    },
    {
        id: 'fall-overwatch',
        label: 'The Fall of Overwatch',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Fall%20of%20Overwatch.png',
    },
    {
        id: 'age-conflict',
        label: 'The Age of Conflict',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20World%20of%20Conflict.png',
    },
    {
        id: 'null-sector',
        label: 'The Null Sector Invasion',
        iconPath: 'src/assets/images/Icons/Eras%20Icons/The%20Null%20Sector%20Invasion.png',
    },
]);

/**
 * @param {object | null | undefined} event
 * @returns {string}
 */
function getEventEraSlug(event) {
    if (!event) return '';
    const helpers = typeof window !== 'undefined' ? window.EventTimelineHelpers : null;
    const eraName =
        typeof helpers?.getEraNameTrimmed === 'function'
            ? helpers.getEraNameTrimmed(event)
            : String(event.eraName || '').trim();
    return getEraHoverPreviewSlug(eraName);
}

/**
 * @param {object | null | undefined} event
 * @param {string | null | undefined} eraId
 */
export function eventMatchesDockEraFilter(event, eraId) {
    const id = eraId != null ? String(eraId).trim() : '';
    if (!id || id === 'complete') return true;
    return getEventEraSlug(event) === id;
}

export function isDockEraFilterActive() {
    return !!activeEraId && activeEraId !== 'complete';
}

export function getActiveDockEraFilter() {
    return activeEraId;
}

/**
 * @param {object[]} baseEvents
 * @returns {object[]}
 */
export function applyDockEraTimelineFilter(baseEvents) {
    const list = Array.isArray(baseEvents) ? baseEvents : [];
    if (!isDockEraFilterActive()) return list;
    return list.filter((event) => eventMatchesDockEraFilter(event, activeEraId));
}

/**
 * @param {string | null} eraId — `complete` or null clears the filter.
 */
export function setDockEraFilter(eraId) {
    const next = eraId != null ? String(eraId).trim() : '';
    activeEraId = !next || next === 'complete' ? null : next;
}

export function clearDockEraFilter() {
    activeEraId = null;
}
