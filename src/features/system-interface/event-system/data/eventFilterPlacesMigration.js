/**
 * Story-archive event migration: collapse legacy flat `filters` / `factions` / `npcs` arrays
 * and `*FilterPlaces` shapes into the canonical `{ heroFilterPlaces, factionFilterPlaces, npcFilterPlaces }`
 * grouped form (each entry: { locationName, country, reasoning }).
 *
 * Keep in sync with `StoryFilterPlacesSync.migrateStoryEventFilterFieldsToGroupedOnly`
 * (classic-script load order on `window.StoryFilterPlacesSync`).
 */

/** @param {unknown} rows */
function normalizeCollectedPlaces(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((r) => ({
            locationName: String(r?.locationName || '').trim(),
            country: String(r?.country || '').trim(),
            reasoning: String(r?.reasoning || '').trim()
        }))
        .filter((r) => r.locationName || r.country || r.reasoning);
}

function heroPlacesFromFlatFilters(filters) {
    if (!Array.isArray(filters) || filters.length === 0) return [];
    return [{ locationName: '', country: filters.join(', '), reasoning: '' }];
}

function npcPlacesFromFlatNpcs(npcs) {
    if (!Array.isArray(npcs) || npcs.length === 0) return [];
    return [{ locationName: '', country: npcs.join(', '), reasoning: '' }];
}

function factionFlatToCsv(factions) {
    if (!Array.isArray(factions) || factions.length === 0) return '';
    return factions
        .map((f) => String(f).replace(/^\d+/, '').trim())
        .filter(Boolean)
        .join(', ');
}

/** @param {{ filters?: any, factions?: any, npcs?: any, heroFilterPlaces?: any, factionFilterPlaces?: any, npcFilterPlaces?: any } | null | undefined} node */
export function migrateStoryEventFilterPlacesNode(node) {
    if (!node || typeof node !== 'object') return;

    const heroNorm = normalizeCollectedPlaces(node.heroFilterPlaces);
    if (heroNorm.length) {
        node.heroFilterPlaces = heroNorm;
    } else if (Array.isArray(node.filters) && node.filters.length > 0) {
        node.heroFilterPlaces = heroPlacesFromFlatFilters(node.filters);
    } else {
        delete node.heroFilterPlaces;
    }

    const facNorm = normalizeCollectedPlaces(node.factionFilterPlaces);
    if (facNorm.length) {
        node.factionFilterPlaces = facNorm;
    } else if (Array.isArray(node.factions) && node.factions.length > 0) {
        const formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
        const manifest =
            typeof window !== 'undefined' && window.eventManager?.factions?.length > 0
                ? window.eventManager.factions
                : typeof window !== 'undefined' && window.globeController?.dataModel?.factions?.length
                    ? window.globeController.dataModel.factions
                    : [];
        const display =
            formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                ? formSvc.factionsArrayToFormDisplayString(node.factions, manifest || [])
                : factionFlatToCsv(node.factions);
        node.factionFilterPlaces = [{ locationName: '', country: display, reasoning: '' }];
    } else {
        delete node.factionFilterPlaces;
    }

    const npcNorm = normalizeCollectedPlaces(node.npcFilterPlaces);
    if (npcNorm.length) {
        node.npcFilterPlaces = npcNorm;
    } else if (Array.isArray(node.npcs) && node.npcs.length > 0) {
        node.npcFilterPlaces = npcPlacesFromFlatNpcs(node.npcs);
    } else {
        delete node.npcFilterPlaces;
    }

    delete node.filters;
    delete node.factions;
    delete node.npcs;
}

/** @param {Array<{ variants?: Array<any> } & Record<string, any>>} events */
export function migrateAllStoryEventsFilterPlaces(events) {
    if (!Array.isArray(events)) return;
    for (let i = 0; i < events.length; i += 1) {
        const ev = events[i];
        migrateStoryEventFilterPlacesNode(ev);
        if (Array.isArray(ev?.variants)) {
            for (let j = 0; j < ev.variants.length; j += 1) {
                migrateStoryEventFilterPlacesNode(ev.variants[j]);
            }
        }
    }
}
