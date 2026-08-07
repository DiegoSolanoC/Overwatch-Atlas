import { mapNpcArchiveRowsForGrouping, mergeNpcCategoriesFromBundledArchiveRows } from '../../../../data-workshop/archive-category-npcs/ArchiveNpcOrdering.js';
import { mergeHeroRolesFromBundledArchiveRows } from '../../../interface-shared/bio-archive/heroArchiveBundledMerge.js';

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
        /* Refresh bundled heroes.json so filter/gallery chips pick up repo role changes. */
        await fetchJsonEventsIntoCache('src/data/story-archive/heroes.json', a => {
            __heroesArchiveFileCache = a;
        });
    }

    if (type === 'factions' && arch !== 'factions') {
        /* Refresh bundled factions.json so filter/gallery chips pick up repo type changes. */
        await fetchJsonEventsIntoCache('src/data/story-archive/factions.json', a => {
            __factionsArchiveFileCache = a;
        });
    }

    if (type === 'npcs' && arch !== 'npcs') {
        /* Refresh bundled npcs.json so filter/gallery chips pick up repo category changes. */
        await fetchJsonEventsIntoCache('src/data/story-archive/npcs.json', a => {
            __npcsArchiveFileCache = a;
        });
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
    const fileFallback = Array.isArray(__factionsArchiveFileCache) ? __factionsArchiveFileCache : [];

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';

    /** @param {unknown[]} rows */
    function withBundledFactionFixes(rows) {
        let out = Array.isArray(rows) ? rows.slice() : [];
        out = out.filter((row) => {
            const n = String(row?.name != null ? row.name : '').trim().toLowerCase();
            return n !== 'talon';
        });
        if (fileFallback.length > 0) {
            out = mergeSatelliteArchiveRowsFromFileFallback(out, fileFallback, 'factions');
        }
        return out.map(snapshotFactionArchiveRowForGrouping);
    }

    if (arch === 'factions' && Array.isArray(window.eventManager?.events)) {
        return withBundledFactionFixes(window.eventManager.events);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveFactions');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return withBundledFactionFixes(parsed);
            }
        }
    } catch (_) {}
    if (fileFallback.length > 0) {
        return fileFallback.map(snapshotFactionArchiveRowForGrouping);
    }
    return [];
}

/** Resolve the grouped-hero layout's archive rows from the best source. */
export function getHeroesArchiveRowsForFilterGrouping() {
    const fileFallback = Array.isArray(__heroesArchiveFileCache) ? __heroesArchiveFileCache : [];

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';
    if (arch === 'heroes' && Array.isArray(window.eventManager?.events)) {
        return mergeSatelliteArchiveRowsFromFileFallback(window.eventManager.events, fileFallback, 'heroes')
            .map(snapshotHeroArchiveRowForGrouping);
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveHeroes');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return mergeSatelliteArchiveRowsFromFileFallback(parsed, fileFallback, 'heroes')
                    .map(snapshotHeroArchiveRowForGrouping);
            }
        }
    } catch (_) {}
    if (fileFallback.length > 0) {
        return fileFallback.map(snapshotHeroArchiveRowForGrouping);
    }
    return [];
}

/**
 * Stale localStorage may omit rows that exist in bundled satellite JSON — merge so
 * grouped filter layouts do not dump manifest chips into the overflow "Other" bucket.
 * Also overlay taxonomy fields from the bundled file (hero roles / faction types).
 * @param {unknown[]} events
 * @param {unknown[]} fileFallback
 * @param {'heroes'|'factions'|'npcs'|''} [taxonomy]
 */
function mergeSatelliteArchiveRowsFromFileFallback(events, fileFallback, taxonomy = '') {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileFallback) || fileFallback.length === 0) return events;

    const names = new Set();
    for (let i = 0; i < events.length; i++) {
        const n = String(events[i]?.name != null ? events[i].name : '').trim().toLowerCase();
        if (n) names.add(n);
    }

    let out = events.slice();
    for (let i = 0; i < fileFallback.length; i++) {
        const fe = fileFallback[i];
        if (!fe || typeof fe !== 'object') continue;
        const n = String(fe.name != null ? fe.name : '').trim().toLowerCase();
        if (!n || names.has(n)) continue;
        names.add(n);
        out.push(fe);
    }

    if (taxonomy === 'heroes') {
        out = mergeHeroRolesFromBundledArchiveRows(out, fileFallback).events;
    } else if (taxonomy === 'factions') {
        /** @type {Map<string, string>} */
        const typeByName = new Map();
        for (let i = 0; i < fileFallback.length; i++) {
            const fe = fileFallback[i];
            const n = String(fe?.name != null ? fe.name : '').trim().toLowerCase();
            const ft = String(fe?.factionType != null ? fe.factionType : '').trim();
            if (n && ft) typeByName.set(n, ft);
        }
        out = out.map((row) => {
            if (!row || typeof row !== 'object') return row;
            const n = String(row.name != null ? row.name : '').trim().toLowerCase();
            const bundled = n ? typeByName.get(n) : '';
            if (!bundled) return row;
            const existing = String(row.factionType != null ? row.factionType : '').trim();
            if (existing === bundled) return row;
            return { ...row, factionType: bundled };
        });
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
            mergeSatelliteArchiveRowsFromFileFallback(window.eventManager.events, fileFallback),
            fileFallback,
        );
    }
    try {
        const raw = localStorage.getItem('timelineEventsArchiveNpcs');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const merged = mergeSatelliteArchiveRowsFromFileFallback(parsed, fileFallback);
                const { events: withCategories } = mergeNpcCategoriesFromBundledArchiveRows(
                    merged,
                    fileFallback,
                );
                return mapNpcArchiveRowsForGrouping(withCategories, fileFallback);
            }
        }
    } catch (_) {}
    if (fileFallback.length > 0) {
        return mapNpcArchiveRowsForGrouping(fileFallback, fileFallback);
    }
    return [];
}
