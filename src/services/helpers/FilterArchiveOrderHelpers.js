/**
 * Align hero / faction / NPC filter lists with Codex story-archive category order
 * (`data/story-archive-*.json` → `events[].name`). Items only in manifest.json fall back
 * to locale-aware sort after the archive-ordered block.
 */

const ARCHIVE_URLS = {
    heroes: 'data/story-archive-heroes.json',
    factions: 'data/story-archive-factions.json',
    npcs: 'data/story-archive-npcs.json'
};

/** @param {unknown} json */
export function extractArchiveOrderFromJson(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.events)) return [];
    return json.events
        .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
        .filter(Boolean);
}

/**
 * @param {string[]} manifestItems hero or npc basenames from manifest
 * @param {string[]} archiveNames ordered names from story archive
 * @returns {string[]}
 */
export function orderHeroOrNpcIdsByArchive(manifestItems, archiveNames) {
    if (!Array.isArray(manifestItems) || manifestItems.length === 0) return manifestItems || [];
    const set = new Set(manifestItems.map((x) => String(x)));
    if (!Array.isArray(archiveNames) || archiveNames.length === 0) {
        return [...manifestItems].sort((a, b) =>
            String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
        );
    }
    const seen = new Set();
    const out = [];
    for (const n of archiveNames) {
        if (!set.has(n) || seen.has(n)) continue;
        out.push(n);
        seen.add(n);
    }
    const tail = manifestItems.filter((x) => !seen.has(x));
    tail.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
    return out.concat(tail);
}

/**
 * @param {{ filename?: string, displayName?: string }[]} manifestFactions
 * @param {string[]} archiveNames faction `name` from story-archive-factions.json
 * @returns {{ filename?: string, displayName?: string }[]}
 */
export function orderFactionsByArchive(manifestFactions, archiveNames) {
    if (!Array.isArray(manifestFactions) || manifestFactions.length === 0) return manifestFactions || [];
    if (!Array.isArray(archiveNames) || archiveNames.length === 0) {
        return [...manifestFactions].sort((a, b) =>
            String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                sensitivity: 'base',
                numeric: true
            })
        );
    }
    const resolveFaction = (archiveName) => {
        const key = String(archiveName).trim();
        if (!key) return null;
        let f = manifestFactions.find(
            (x) => String(x.displayName || '').trim() === key || String(x.filename || '').trim() === key
        );
        if (!f) {
            const kl = key.toLowerCase();
            f = manifestFactions.find(
                (x) =>
                    String(x.displayName || '')
                        .trim()
                        .toLowerCase() === kl ||
                    String(x.filename || '')
                        .trim()
                        .toLowerCase() === kl
            );
        }
        return f || null;
    };
    const seen = new Set();
    const out = [];
    for (const name of archiveNames) {
        const f = resolveFaction(name);
        const fn = f && f.filename != null ? String(f.filename) : '';
        if (f && fn && !seen.has(fn)) {
            out.push(f);
            seen.add(fn);
        }
    }
    const tail = manifestFactions.filter((f) => {
        const fn = f && f.filename != null ? String(f.filename) : '';
        return fn && !seen.has(fn);
    });
    tail.sort((a, b) =>
        String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
            sensitivity: 'base',
            numeric: true
        })
    );
    return out.concat(tail);
}

export async function fetchStoryArchiveCategoryOrders() {
    const result = { heroes: [], factions: [], npcs: [] };
    const buster = `v=${Date.now()}`;
    const keys = /** @type {(keyof typeof ARCHIVE_URLS)[]} */ (Object.keys(ARCHIVE_URLS));
    await Promise.all(
        keys.map(async (key) => {
            const url = `${ARCHIVE_URLS[key]}?${buster}`;
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) return;
                const json = await res.json();
                result[key] = extractArchiveOrderFromJson(json);
            } catch {
                /* missing archive or offline */
            }
        })
    );
    return result;
}

/**
 * @param {string[]} heroes
 * @param {{ filename?: string, displayName?: string }[]} factions
 * @param {string[]} npcs
 */
export async function applyStoryArchiveOrderFromNetwork(heroes, factions, npcs) {
    let orders = { heroes: [], factions: [], npcs: [] };
    try {
        orders = await fetchStoryArchiveCategoryOrders();
    } catch {
        /* keep empty orders → full fallback sort inside order* functions */
    }
    return {
        heroes: orderHeroOrNpcIdsByArchive(heroes, orders.heroes),
        factions: orderFactionsByArchive(factions, orders.factions),
        npcs: orderHeroOrNpcIdsByArchive(npcs, orders.npcs)
    };
}

if (typeof window !== 'undefined') {
    if (!window.FilterArchiveOrderHelpers) window.FilterArchiveOrderHelpers = {};
    window.FilterArchiveOrderHelpers.extractArchiveOrderFromJson = extractArchiveOrderFromJson;
    window.FilterArchiveOrderHelpers.orderHeroOrNpcIdsByArchive = orderHeroOrNpcIdsByArchive;
    window.FilterArchiveOrderHelpers.orderFactionsByArchive = orderFactionsByArchive;
    window.FilterArchiveOrderHelpers.fetchStoryArchiveCategoryOrders = fetchStoryArchiveCategoryOrders;
    window.FilterArchiveOrderHelpers.applyStoryArchiveOrderFromNetwork = applyStoryArchiveOrderFromNetwork;
}
