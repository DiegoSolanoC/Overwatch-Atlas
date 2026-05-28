/**
 * Data Archive rows for Biography mode (heroes, factions, NPCs).
 * Uses the same sources as grouped filter layout: live EM, localStorage, bundled JSON.
 */

import { FILES } from '../../../data/registry.js';
import { matchHeroManifestToArchiveRowName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { ensureArchiveLayoutSnapshotsForFilter } from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';
import { ARCHIVE_LOCALSTORAGE_KEYS } from '../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';
import {
    getHeroBirthdayAgeDisplay,
    getHeroBirthdayRawFromEntry
} from '../../system-interface/interface-shared/bio-archive/HeroBirthdayAge.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';

/** @typedef {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} BioBiographyArchiveCategory */

/** @type {Map<string, object[]|null>} */
const archiveEventsCache = new Map();

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
 * @param {BioBiographyArchiveCategory} category
 * @returns {Promise<object[]>}
 */
export async function loadBioArchiveEvents(category) {
    const cat = normalizeBioBiographyCategory(category);
    if (cat === 'locations') return [];

    if (archiveEventsCache.has(cat)) {
        const hit = archiveEventsCache.get(cat);
        return hit || [];
    }

    if (cat === 'heroes' || cat === 'factions') {
        await ensureArchiveLayoutSnapshotsForFilter(cat);
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';

    if (arch === cat && Array.isArray(window.eventManager?.events)) {
        const live = window.eventManager.events.slice();
        archiveEventsCache.set(cat, live);
        return live;
    }

    const lsKey = ARCHIVE_LOCALSTORAGE_KEYS[cat];
    try {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                archiveEventsCache.set(cat, parsed);
                return parsed;
            }
        }
    } catch (_) {}

    const fileUrl = FILES.storyArchive[cat];
    try {
        const res = await fetch(`${fileUrl}?v=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const events = Array.isArray(data?.events) ? data.events : [];
            archiveEventsCache.set(cat, events);
            return events;
        }
    } catch (_) {}

    archiveEventsCache.set(cat, []);
    return [];
}

/** @returns {Promise<object[]>} */
export async function loadHeroesArchiveEvents() {
    return loadBioArchiveEvents('heroes');
}

export function clearBioArchiveEventsCache(category) {
    if (category) {
        archiveEventsCache.delete(normalizeBioBiographyCategory(category));
        return;
    }
    archiveEventsCache.clear();
}

export function clearHeroesArchiveEventsCache() {
    clearBioArchiveEventsCache('heroes');
}

/**
 * @param {object[] | null} events
 */
export function setHeroesArchiveEventsCache(events) {
    archiveEventsCache.set('heroes', Array.isArray(events) ? events : null);
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
 * @param {string} factionFilename — manifest faction filename token.
 * @param {object[]} events
 * @returns {object | null}
 */
export function findFactionArchiveEntryByFilterKey(factionFilename, events) {
    const filename = String(factionFilename || '').trim();
    if (!filename || !Array.isArray(events)) return null;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    const bare = filename.replace(/^\d+/, '').trim().toLowerCase();

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const rowName = archiveRowName(ev);
        if (!rowName) continue;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(filename, rowName)) return ev;
        }
        const rl = rowName.toLowerCase();
        if (bare && rl === bare) return ev;
    }
    return null;
}

/**
 * @param {string} npcFilterKey
 * @param {object[]} events
 * @returns {object | null}
 */
export function findNpcArchiveEntryByFilterKey(npcFilterKey, events) {
    const key = String(npcFilterKey || '').trim().toLowerCase();
    if (!key || !Array.isArray(events)) return null;

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const rowName = archiveRowName(ev);
        if (String(rowName || '').trim().toLowerCase() === key) return ev;
    }
    return null;
}

/**
 * @param {BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {object[]} events
 */
export function findBioArchiveEntryByFilterKey(category, filterKey, events) {
    const cat = normalizeBioBiographyCategory(category);
    if (cat === 'factions') return findFactionArchiveEntryByFilterKey(filterKey, events);
    if (cat === 'npcs') return findNpcArchiveEntryByFilterKey(filterKey, events);
    return findHeroArchiveEntryByFilterKey(filterKey, events);
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

/**
 * Birthday + age shown above biography text.
 * @param {object | null} entry
 * @returns {{ birthdayText: string, age: number } | null}
 */
export function getHeroArchiveBirthdayAgeDisplay(entry) {
    if (!entry) return null;
    const raw = getHeroBirthdayRawFromEntry(entry);
    if (!raw) return null;
    return getHeroBirthdayAgeDisplay(raw);
}
