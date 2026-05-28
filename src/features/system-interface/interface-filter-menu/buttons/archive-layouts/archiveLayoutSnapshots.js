import { mapNpcArchiveRowsForGrouping } from '../../../../data-workshop/archive-category-npcs/ArchiveNpcOrdering.js';

/**
 * The grouped Heroes / Factions filter layouts need access to the archive
 * `events[]` even when the Event Manager isn't currently displaying that
 * archive (e.g. user is on the Story tab but switching the Heroes filter
 * tab still expects heroes-archive groupings).
 *
 * Resolution order for each archive type:
 *   1. If Event Manager is on the same archive, return its live events.
 *   2. Else read the satellite localStorage snapshot we save on every edit.
 *   3. Else fall back to the bundled repo JSON, fetched once and cached
 *      in-process (`__heroesArchiveFileCache` / `__factionsArchiveFileCache`).
 *
 * `invalidateArchiveLayoutFileCaches()` drops the in-process snapshots so a
 * mode switch in the Event Manager forces a fresh disk read next time.
 */

/** @type {unknown[]|null} */
let __heroesArchiveFileCache = null;
/** @type {unknown[]|null} */
let __factionsArchiveFileCache = null;
/** @type {unknown[]|null} */
let __npcsArchiveFileCache = null;

export function invalidateArchiveLayoutFileCaches() {
    __heroesArchiveFileCache = null;
    __factionsArchiveFileCache = null;
    __npcsArchiveFileCache = null;
}

async function fetchJsonEventsIntoCache(url, assign) {
    try {
        const res = await fetch(`${url}?v=${Date.now()}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        assign(Array.isArray(data?.events) ? data.events : []);
    } catch (_) {
        assign([]);
    }
}

/**
 * Ensure the in-process snapshot for `type` exists before a grouped layout
 * tries to consume it. No-op if the live Event Manager already has the data
 * or if a localStorage snapshot exists.
 *
 * @param {'heroes'|'factions'|'npcs'} type
 */
export async function ensureArchiveLayoutSnapshotsForFilter(type) {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';

    if (type === 'heroes' && arch !== 'heroes') {
        try {
            const raw = localStorage.getItem('timelineEventsArchiveHeroes');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return;
            }
        } catch (_) {}
        if (!__heroesArchiveFileCache || __heroesArchiveFileCache.length === 0) {
            await fetchJsonEventsIntoCache('src/data/story-archive/heroes.json', a => {
                __heroesArchiveFileCache = a;
            });
        }
    }

    if (type === 'factions' && arch !== 'factions') {
        try {
            const raw = localStorage.getItem('timelineEventsArchiveFactions');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return;
            }
        } catch (_) {}
        if (!__factionsArchiveFileCache || __factionsArchiveFileCache.length === 0) {
            await fetchJsonEventsIntoCache('src/data/story-archive/factions.json', a => {
                __factionsArchiveFileCache = a;
            });
        }
    }

    if (type === 'npcs' && arch !== 'npcs') {
        /* Always keep bundled npcs.json in cache — localStorage rows may lack `npcCategory`. */
        if (!__npcsArchiveFileCache || __npcsArchiveFileCache.length === 0) {
            await fetchJsonEventsIntoCache('src/data/story-archive/npcs.json', a => {
                __npcsArchiveFileCache = a;
            });
        }
    }
}

function snapshotFactionArchiveRowForGrouping(ev) {
    if (!ev || typeof ev !== 'object') return { name: '', factionType: '' };
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0] || {};
        return {
            name: String(v0.name != null ? v0.name : ev.name || '').trim(),
            factionType: String(v0.factionType != null ? v0.factionType : '').trim()
        };
    }
    return {
        name: String(ev.name != null ? ev.name : '').trim(),
        factionType: String(ev.factionType != null ? ev.factionType : '').trim()
    };
}

function snapshotHeroArchiveRowForGrouping(ev) {
    if (!ev || typeof ev !== 'object') return { name: '', heroRole: '', heroSubRole: '' };
    const vars = ev.variants;
    if (Array.isArray(vars) && vars.length > 0) {
        const v0 = vars[0] || {};
        return {
            name: String(v0.name != null ? v0.name : ev.name || '').trim(),
            heroRole: String(v0.heroRole != null ? v0.heroRole : '').trim(),
            heroSubRole: String(v0.heroSubRole != null ? v0.heroSubRole : '').trim()
        };
    }
    return {
        name: String(ev.name != null ? ev.name : '').trim(),
        heroRole: String(ev.heroRole != null ? ev.heroRole : '').trim(),
        heroSubRole: String(ev.heroSubRole != null ? ev.heroSubRole : '').trim()
    };
}

/** Resolve the grouped-faction layout's archive rows from the best source. */
export function getFactionsArchiveRowsForFilterGrouping() {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'factions' && Array.isArray(window.eventManager?.events)) {
        return window.eventManager.events.map(snapshotFactionArchiveRowForGrouping);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveFactions');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(snapshotFactionArchiveRowForGrouping);
            }
        }
    } catch (_) {}
    if (Array.isArray(__factionsArchiveFileCache) && __factionsArchiveFileCache.length > 0) {
        return __factionsArchiveFileCache.map(snapshotFactionArchiveRowForGrouping);
    }
    return [];
}

/** Resolve the grouped-hero layout's archive rows from the best source. */
export function getHeroesArchiveRowsForFilterGrouping() {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'heroes' && Array.isArray(window.eventManager?.events)) {
        return window.eventManager.events.map(snapshotHeroArchiveRowForGrouping);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveHeroes');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(snapshotHeroArchiveRowForGrouping);
            }
        }
    } catch (_) {}
    if (Array.isArray(__heroesArchiveFileCache) && __heroesArchiveFileCache.length > 0) {
        return __heroesArchiveFileCache.map(snapshotHeroArchiveRowForGrouping);
    }
    return [];
}

/**
 * Stale NPC localStorage may omit rows that exist in bundled `npcs.json` — merge so
 * grouped filter layout does not dump manifest chips into the overflow "Other" bucket.
 * @param {unknown[]} events
 * @param {unknown[]} fileFallback
 */
function mergeNpcArchiveRowsFromFileFallback(events, fileFallback) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileFallback) || fileFallback.length === 0) return events;

    const names = new Set();
    for (let i = 0; i < events.length; i++) {
        const n = String(events[i]?.name != null ? events[i].name : '').trim().toLowerCase();
        if (n) names.add(n);
    }

    const out = events.slice();
    for (let i = 0; i < fileFallback.length; i++) {
        const fe = fileFallback[i];
        if (!fe || typeof fe !== 'object') continue;
        const n = String(fe.name != null ? fe.name : '').trim().toLowerCase();
        if (!n || names.has(n)) continue;
        names.add(n);
        out.push(fe);
    }
    return out;
}

/** Resolve the grouped-npc layout's archive rows from the best source. */
export function getNpcsArchiveRowsForFilterGrouping() {
    const fileFallback = Array.isArray(__npcsArchiveFileCache) ? __npcsArchiveFileCache : [];

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'npcs' && Array.isArray(window.eventManager?.events)) {
        return mapNpcArchiveRowsForGrouping(
            mergeNpcArchiveRowsFromFileFallback(window.eventManager.events, fileFallback),
            fileFallback,
        );
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveNpcs');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return mapNpcArchiveRowsForGrouping(
                    mergeNpcArchiveRowsFromFileFallback(parsed, fileFallback),
                    fileFallback,
                );
            }
        }
    } catch (_) {}
    if (fileFallback.length > 0) {
        return mapNpcArchiveRowsForGrouping(fileFallback, fileFallback);
    }
    return [];
}
