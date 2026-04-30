/**
 * Story events: grouped rows (same shape as secondaryCountryPlaces / hero relevant locations)
 * for heroes, factions, and NPCs — synced to flat filters / factions / npcs for chips and search.
 */

export const STORY_SECONDARY_PLACES_EDITOR_OPTS = {
    placeholders: {
        locationName: 'Group label',
        country: 'Countries (comma-separated for multiple flags)',
        reasoning: 'Why they matter'
    },
    autocompleteType: 'countries'
};

export const STORY_HERO_FILTER_PLACES_OPTS = {
    placeholders: {
        locationName: 'Group label',
        country: 'Heroes (comma-separated)',
        reasoning: 'Why they matter'
    },
    autocompleteType: 'heroes'
};

export const STORY_FACTION_FILTER_PLACES_OPTS = {
    placeholders: {
        locationName: 'Group label',
        country: 'Factions (comma-separated)',
        reasoning: 'Why they matter'
    },
    autocompleteType: 'factions'
};

export const STORY_NPC_FILTER_PLACES_OPTS = {
    placeholders: {
        locationName: 'Group label',
        country: 'NPCs (comma-separated)',
        reasoning: 'Why they matter'
    },
    autocompleteType: 'npcs'
};

export function clonePlaceRows(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => ({
        locationName: p?.locationName != null ? String(p.locationName) : '',
        country: p?.country != null ? String(p.country) : '',
        reasoning: p?.reasoning != null ? String(p.reasoning) : ''
    }));
}

export function tokensFromPlacesCountryFields(places) {
    const out = [];
    if (!Array.isArray(places)) return out;
    places.forEach((row) => {
        const c = row && row.country != null ? String(row.country) : '';
        c.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((t) => out.push(t));
    });
    return out;
}

export function canonicalizeHeroTokens(tokens) {
    const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
    const lower = new Map(heroes.map((h) => [String(h).toLowerCase(), h]));
    return tokens
        .map((t) => lower.get(String(t).toLowerCase()) || String(t).trim())
        .filter(Boolean);
}

export function canonicalizeFactionTokens(tokens) {
    const availableFactions =
        window.eventManager?.factions?.length > 0
            ? window.eventManager.factions
            : window.globeController?.dataModel?.factions || [];
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    return tokens
        .map((token) => {
            const found = availableFactions.find(
                (f) =>
                    (f?.displayName || '').toLowerCase() === token.toLowerCase() ||
                    (f?.filename || '').toLowerCase() === token.toLowerCase() ||
                    (fh &&
                        typeof fh.factionIdsMatch === 'function' &&
                        (fh.factionIdsMatch(f.filename, token) || fh.factionIdsMatch(f.displayName, token)))
            );
            return found ? found.displayName : token;
        })
        .filter(Boolean);
}

export function canonicalizeNpcTokens(tokens) {
    const manifestNpcs = window.eventManager?.npcs || [];
    const npcCanon = new Map(manifestNpcs.map((n) => [String(n).toLowerCase(), n]));
    return tokens.map((t) => npcCanon.get(String(t).toLowerCase()) || String(t).trim()).filter(Boolean);
}

export function normalizeCollectedPlaces(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((r) => ({
            locationName: String(r?.locationName || '').trim(),
            country: String(r?.country || '').trim(),
            reasoning: String(r?.reasoning || '').trim()
        }))
        .filter((r) => r.locationName || r.country || r.reasoning);
}

export function migrateHeroPlacesFromFilters(filters) {
    if (!Array.isArray(filters) || filters.length === 0) return [];
    return [{ locationName: '', country: filters.join(', '), reasoning: '' }];
}

export function migrateFactionPlacesFromFactions(factions, formSvc, manifest) {
    if (!Array.isArray(factions) || factions.length === 0) return [];
    const display =
        formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
            ? formSvc.factionsArrayToFormDisplayString(factions, manifest || [])
            : factions.map((f) => String(f).replace(/^\d+/, '').trim()).join(', ');
    return [{ locationName: '', country: display, reasoning: '' }];
}

export function migrateNpcPlacesFromNpcs(npcs) {
    if (!Array.isArray(npcs) || npcs.length === 0) return [];
    return [{ locationName: '', country: npcs.join(', '), reasoning: '' }];
}

export function heroPlacesForEditor(target) {
    if (Array.isArray(target?.heroFilterPlaces) && target.heroFilterPlaces.length > 0) {
        return clonePlaceRows(target.heroFilterPlaces);
    }
    return migrateHeroPlacesFromFilters(target?.filters || []);
}

export function factionPlacesForEditor(target) {
    if (Array.isArray(target?.factionFilterPlaces) && target.factionFilterPlaces.length > 0) {
        return clonePlaceRows(target.factionFilterPlaces);
    }
    const formSvc = window.eventManager?.formService;
    const manifest =
        window.eventManager?.factions?.length > 0
            ? window.eventManager.factions
            : window.globeController?.dataModel?.factions || [];
    return migrateFactionPlacesFromFactions(target?.factions || [], formSvc, manifest);
}

export function npcPlacesForEditor(target) {
    if (Array.isArray(target?.npcFilterPlaces) && target.npcFilterPlaces.length > 0) {
        return clonePlaceRows(target.npcFilterPlaces);
    }
    return migrateNpcPlacesFromNpcs(target?.npcs || []);
}

/**
 * Persist grouped rows and derived flat arrays on a story variant or root event.
 * @param {object} target
 * @param {object[]} heroRows
 * @param {object[]} factionRows
 * @param {object[]} npcRows
 */
export function applyStoryFilterPlacesToTarget(target, heroRows, factionRows, npcRows) {
    const h = normalizeCollectedPlaces(heroRows);
    const f = normalizeCollectedPlaces(factionRows);
    const n = normalizeCollectedPlaces(npcRows);

    if (h.length) target.heroFilterPlaces = h;
    else delete target.heroFilterPlaces;

    if (f.length) target.factionFilterPlaces = f;
    else delete target.factionFilterPlaces;

    if (n.length) target.npcFilterPlaces = n;
    else delete target.npcFilterPlaces;

    target.filters = canonicalizeHeroTokens(tokensFromPlacesCountryFields(h));
    target.factions = canonicalizeFactionTokens(tokensFromPlacesCountryFields(f));
    target.npcs = canonicalizeNpcTokens(tokensFromPlacesCountryFields(n));
}

export function copyFilterPlaceArraysFromSource(from) {
    if (!from || typeof from !== 'object') {
        return {
            heroFilterPlaces: [],
            factionFilterPlaces: [],
            npcFilterPlaces: []
        };
    }
    return {
        heroFilterPlaces: Array.isArray(from.heroFilterPlaces)
            ? from.heroFilterPlaces.map((p) => ({
                  locationName: p.locationName,
                  country: p.country,
                  reasoning: p.reasoning
              }))
            : [],
        factionFilterPlaces: Array.isArray(from.factionFilterPlaces)
            ? from.factionFilterPlaces.map((p) => ({
                  locationName: p.locationName,
                  country: p.country,
                  reasoning: p.reasoning
              }))
            : [],
        npcFilterPlaces: Array.isArray(from.npcFilterPlaces)
            ? from.npcFilterPlaces.map((p) => ({
                  locationName: p.locationName,
                  country: p.country,
                  reasoning: p.reasoning
              }))
            : []
    };
}
