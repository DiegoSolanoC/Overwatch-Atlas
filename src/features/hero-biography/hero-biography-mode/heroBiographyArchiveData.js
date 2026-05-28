/**
 * Heroes Data Archive rows for Hero Biography (description, role, etc.).
 * Uses the same sources as grouped filter layout: live EM, localStorage, bundled JSON.
 */

import { matchHeroManifestToArchiveRowName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { ensureArchiveLayoutSnapshotsForFilter } from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';

/** @type {object[] | null} */
let cachedHeroArchiveEvents = null;

/**
 * @param {object} ev
 * @returns {string}
 */
function archiveRowName(ev) {
    if (!ev || typeof ev !== 'object') return '';
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0];
        return String(v0?.name != null ? v0.name : ev.name || '').trim();
    }
    return String(ev.name != null ? ev.name : '').trim();
}

/**
 * @param {object} ev
 * @returns {string}
 */
function archiveRowDescription(ev) {
    if (!ev || typeof ev !== 'object') return '';
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0];
        return String(v0?.description != null ? v0.description : ev.description || '').trim();
    }
    return String(ev.description != null ? ev.description : '').trim();
}

/**
 * @returns {Promise<object[]>}
 */
export async function loadHeroesArchiveEvents() {
    if (cachedHeroArchiveEvents) return cachedHeroArchiveEvents;

    await ensureArchiveLayoutSnapshotsForFilter('heroes');

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';

    if (arch === 'heroes' && Array.isArray(window.eventManager?.events)) {
        cachedHeroArchiveEvents = window.eventManager.events.slice();
        return cachedHeroArchiveEvents;
    }

    try {
        const raw = localStorage.getItem('timelineEventsArchiveHeroes');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedHeroArchiveEvents = parsed;
                return cachedHeroArchiveEvents;
            }
        }
    } catch (_) {}

    try {
        const res = await fetch(`src/data/story-archive/heroes.json?v=${Date.now()}`, {
            cache: 'no-store',
        });
        if (res.ok) {
            const data = await res.json();
            cachedHeroArchiveEvents = Array.isArray(data?.events) ? data.events : [];
            return cachedHeroArchiveEvents;
        }
    } catch (_) {}

    cachedHeroArchiveEvents = [];
    return cachedHeroArchiveEvents;
}

export function clearHeroesArchiveEventsCache() {
    cachedHeroArchiveEvents = null;
}

/**
 * @param {string} heroFilterKey — manifest hero id (e.g. "Ana").
 * @param {object[]} events
 * @returns {object | null}
 */
export function findHeroArchiveEntryByFilterKey(heroFilterKey, events) {
    const key = String(heroFilterKey || '').trim();
    if (!key || !Array.isArray(events)) return null;

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const rowName = archiveRowName(ev);
        const matched = matchHeroManifestToArchiveRowName(rowName, [key]);
        if (matched === key) return ev;
    }
    return null;
}

/**
 * Description text for the bio stage (excludes empty / placeholder copy).
 * @param {object | null} entry
 * @returns {string | null}
 */
export function getHeroArchiveBioDescription(entry) {
    if (!entry) return null;
    const raw = archiveRowDescription(entry);
    if (!raw) return null;
    if (/^no description available\.?$/i.test(raw)) return null;
    return raw;
}
