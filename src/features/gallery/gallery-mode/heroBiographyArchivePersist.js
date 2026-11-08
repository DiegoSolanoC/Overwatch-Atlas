/**
 * Persist bio-archive fields from Hero Biography (Gallery) stage.
 */

import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    clearBioArchiveEventsCache,
    clearHeroesArchiveEventsCache,
    findBioArchiveEntryByFilterKey,
    findHeroArchiveEntryByFilterKey,
    loadBioArchiveEvents,
    loadHeroesArchiveEvents,
    setBioArchiveEventsCache,
    setHeroesArchiveEventsCache,
} from './heroBiographyArchiveData.js';
import { ARCHIVE_LOCALSTORAGE_KEYS } from '../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';

const HEROES_STORAGE_KEY = ARCHIVE_LOCALSTORAGE_KEYS.heroes;

/**
 * @param {object[]} events
 */
function writeHeroesArchiveLocal(events) {
    try {
        localStorage.setItem(HEROES_STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
        console.warn('[gallery] Could not write heroes archive to localStorage:', err);
    }
    setHeroesArchiveEventsCache(events);
}

/**
 * @param {object[]} events
 */
function dispatchBioArchiveRefreshed(category, events) {
    const cat = normalizeBioBiographyCategory(category);
    const orderNames = (events || [])
        .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
        .filter(Boolean);
    window.dispatchEvent(
        new CustomEvent('atlas-bio-archives-refreshed', {
            detail: { archives: [cat], orderNames },
        }),
    );
}

/** @param {object[]} events */
function dispatchHeroesArchiveRefreshed(events) {
    dispatchBioArchiveRefreshed('heroes', events);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {object[]} events
 */
function writeBioArchiveLocal(category, events) {
    const cat = normalizeBioBiographyCategory(category);
    const lsKey = ARCHIVE_LOCALSTORAGE_KEYS[cat];
    if (!lsKey) return;
    try {
        localStorage.setItem(lsKey, JSON.stringify(events));
    } catch (err) {
        console.warn(`[gallery] Could not write ${cat} archive to localStorage:`, err);
    }
    setBioArchiveEventsCache(cat, events);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {object[]} events
 */
function postBioArchiveToDevApi(category, events) {
    const cat = normalizeBioBiographyCategory(category);
    const ds = window.eventManager?.dataService;
    if (ds && typeof ds._canPersistTimelineJsonToRepo === 'function' && !ds._canPersistTimelineJsonToRepo()) {
        return;
    }

    try {
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/story-archive')
                : '/api/story-archive';
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archive: cat, events }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then((data) => {
                window.updateAppStatus?.(
                    `Saved ${cat} archive (${data?.eventsCount ?? events.length} entries)`,
                    'success',
                );
            })
            .catch((err) => {
                console.warn(`[gallery] ${cat} archive API save failed:`, err);
                window.updateAppStatus?.(
                    `Saved locally; could not write ${cat}.json (${err?.message || 'API error'}).`,
                    'warning',
                );
            });
    } catch (err) {
        console.warn(`[gallery] ${cat} archive API save skipped:`, err);
    }
}

/**
 * @param {object[]} events
 */
function postHeroesArchiveToDevApi(events) {
    const ds = window.eventManager?.dataService;
    if (ds && typeof ds._canPersistTimelineJsonToRepo === 'function' && !ds._canPersistTimelineJsonToRepo()) {
        return;
    }

    try {
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/story-archive')
                : '/api/story-archive';
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archive: 'heroes', events }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then((data) => {
                window.updateAppStatus?.(
                    `Saved heroes archive (${data?.eventsCount ?? events.length} entries)`,
                    'success',
                );
            })
            .catch((err) => {
                console.warn('[gallery] heroes archive API save failed:', err);
                window.updateAppStatus?.(
                    `Saved locally; could not write heroes.json (${err?.message || 'API error'}).`,
                    'warning',
                );
            });
    } catch (err) {
        console.warn('[gallery] heroes archive API save skipped:', err);
    }
}

/**
 * @param {string} heroFilterKey
 * @param {object[]} events
 * @returns {number}
 */
function findHeroArchiveIndex(heroFilterKey, events) {
    const key = String(heroFilterKey || '').trim();
    if (!key || !Array.isArray(events)) return -1;
    for (let i = 0; i < events.length; i++) {
        if (findHeroArchiveEntryByFilterKey(key, [events[i]])) return i;
    }
    return -1;
}

/**
 * @param {object} next
 * @param {object} patch
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} cat
 */
function applyIntelPatchFields(next, patch, cat) {
    if (patch.description !== undefined) {
        next.description = String(patch.description ?? '').trim();
    }
    if (cat === 'heroes') {
        if (patch.birthday !== undefined) {
            next.birthday = String(patch.birthday ?? '').trim();
        }
        if (patch.heroRole !== undefined) {
            next.heroRole = String(patch.heroRole ?? '').trim();
        }
        if (patch.heroSubRole !== undefined) {
            next.heroSubRole = String(patch.heroSubRole ?? '').trim();
        }
    }
    if (cat === 'factions' && patch.factionType !== undefined) {
        next.factionType = String(patch.factionType ?? '').trim();
    }
    if (cat === 'npcs' && patch.npcCategory !== undefined) {
        next.npcCategory = String(patch.npcCategory ?? '').trim();
    }
    if ('connections' in next) {
        delete next.connections;
    }
    return next;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} displayName
 * @param {{
 *   description?: string,
 *   birthday?: string,
 *   heroRole?: string,
 *   heroSubRole?: string,
 *   factionType?: string,
 *   npcCategory?: string,
 * }} patch
 * @returns {Promise<{ ok: boolean, error?: string, entry?: object }>}
 */
export async function saveBioArchiveEntryPatchFromBiographyStage(
    category,
    filterKey,
    displayName,
    patch,
) {
    const cat = normalizeBioBiographyCategory(category);
    const key = String(filterKey || '').trim();
    if (!key) return { ok: false, error: 'No entry selected.' };
    if (cat === 'locations') return { ok: false, error: 'Locations do not support gallery intel edit.' };

    clearBioArchiveEventsCache(cat);
    const loaded = await loadBioArchiveEvents(cat);
    const events = loaded.map((row) => ({ ...row }));

    let idx = -1;
    for (let i = 0; i < events.length; i += 1) {
        if (findBioArchiveEntryByFilterKey(cat, key, [events[i]])) {
            idx = i;
            break;
        }
    }

    if (idx < 0) {
        const name = String(displayName || key).trim() || key;
        /** @type {object} */
        const stub = {
            name,
            description: '',
            connections: [],
        };
        if (cat === 'heroes') {
            stub.relevantLocations = [];
            stub.heroRole = 'Unassigned';
            stub.heroSubRole = '';
        } else if (cat === 'factions') {
            stub.factionType = 'Independent Coalitions';
        } else if (cat === 'npcs') {
            stub.npcCategory = 'Unassigned';
        }
        applyIntelPatchFields(stub, patch, cat);
        events.push(stub);
        idx = events.length - 1;
    } else {
        events[idx] = applyIntelPatchFields({ ...events[idx] }, patch, cat);
    }

    writeBioArchiveLocal(cat, events);

    const em = window.eventManager;
    const ds = em?.dataService;
    const onMatchingArchive =
        typeof ds?.getArchiveSource === 'function' && ds.getArchiveSource() === cat;

    if (onMatchingArchive && Array.isArray(em?.events)) {
        let emIdx = -1;
        for (let i = 0; i < em.events.length; i += 1) {
            if (findBioArchiveEntryByFilterKey(cat, key, [em.events[i]])) {
                emIdx = i;
                break;
            }
        }
        if (emIdx < 0 && events[idx]) {
            emIdx =
                window.BioArchiveConnectionsSync?.resolveBioArchiveEventIndex?.(
                    em.events,
                    events[idx],
                    cat,
                ) ?? -1;
        }
        if (emIdx >= 0) {
            em.events[emIdx] = { ...events[idx] };
            em.unsavedEventIndices?.add(emIdx);
        } else {
            em.events.push({ ...events[idx] });
            em.unsavedEventIndices?.add(em.events.length - 1);
        }
        /* saveEvents dispatches atlas-bio-archives-refreshed → Filters rebuild */
        ds?.saveEvents?.();
    } else {
        dispatchBioArchiveRefreshed(cat, events);
        postBioArchiveToDevApi(cat, events);
    }

    return { ok: true, entry: events[idx] };
}

/**
 * @param {string} heroFilterKey
 * @param {string} heroDisplayName
 * @param {{ description?: string, birthday?: string, heroRole?: string, heroSubRole?: string, connections?: object[] }} patch
 * @returns {Promise<{ ok: boolean, error?: string, entry?: object }>}
 */
export async function saveHeroArchiveEntryPatchFromBiographyStage(heroFilterKey, heroDisplayName, patch) {
    return saveBioArchiveEntryPatchFromBiographyStage('heroes', heroFilterKey, heroDisplayName, patch);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} displayName
 * @param {{ connectionCanvas?: object|null }} patch
 */
export async function saveBioArchiveConnectionCanvasFromGallery(category, filterKey, displayName, patch) {
    const cat = normalizeBioBiographyCategory(category);
    const key = String(filterKey || '').trim();
    if (!key) return { ok: false, error: 'No entry selected.' };
    if (cat === 'locations') return { ok: false, error: 'Locations do not support connection canvas.' };
    if (patch.connectionCanvas === undefined) return { ok: false, error: 'Nothing to save.' };

    clearBioArchiveEventsCache(cat);
    const loaded = await loadBioArchiveEvents(cat);
    const events = loaded.map((row) => ({ ...row }));

    let idx = -1;
    for (let i = 0; i < events.length; i += 1) {
        if (findBioArchiveEntryByFilterKey(cat, key, [events[i]])) {
            idx = i;
            break;
        }
    }

    if (idx < 0) {
        const name = String(displayName || key).trim() || key;
        events.push({
            name,
            relevantLocations: [],
            connectionCanvas: patch.connectionCanvas,
        });
        idx = events.length - 1;
    } else {
        events[idx] = {
            ...events[idx],
            connectionCanvas: patch.connectionCanvas,
        };
    }

    writeBioArchiveLocal(cat, events);

    const em = window.eventManager;
    const ds = em?.dataService;
    const onArchive = typeof ds?.getArchiveSource === 'function' && ds.getArchiveSource() === cat;

    if (onArchive && Array.isArray(em?.events)) {
        let emIdx = -1;
        for (let j = 0; j < em.events.length; j += 1) {
            if (findBioArchiveEntryByFilterKey(cat, key, [em.events[j]])) {
                emIdx = j;
                break;
            }
        }
        if (emIdx < 0 && events[idx]) {
            emIdx =
                window.BioArchiveConnectionsSync?.resolveBioArchiveEventIndex?.(
                    em.events,
                    events[idx],
                    cat,
                ) ?? -1;
        }
        if (emIdx >= 0) {
            em.events[emIdx] = { ...events[idx] };
            em.unsavedEventIndices?.add(emIdx);
        } else {
            em.events.push({ ...events[idx] });
            em.unsavedEventIndices?.add(em.events.length - 1);
        }
        ds?.saveEvents?.();
    } else {
        dispatchBioArchiveRefreshed(cat, events);
        postBioArchiveToDevApi(cat, events);
    }

    return { ok: true, entry: events[idx] };
}

/**
 * @param {string} heroFilterKey
 * @param {string} heroDisplayName
 * @param {{ description?: string, birthday?: string }} patch
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function saveHeroArchiveBioFromBiographyStage(heroFilterKey, heroDisplayName, patch) {
    const result = await saveHeroArchiveEntryPatchFromBiographyStage(heroFilterKey, heroDisplayName, patch);
    return { ok: result.ok, error: result.error };
}
