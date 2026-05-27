import {
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens
} from '../../interface-shared/storyEventFilterPlaces.js';

/**
 * Legacy faction strings in events.json that don't match manifest `filename` (filter chip keys).
 * Values must match manifest `factions[].filename` exactly.
 */
const LEGACY_FACTION_ID_TO_CANONICAL = {
    Shambali: '25Shambali Order',
    '13Shambali': '25Shambali Order',
    '25Shambali': '25Shambali Order',
    '26Shambali': '25Shambali Order',
    '09Lucheng': '07Lucheng Interstellar',
    '27Null Sector': '26Null Sector',
    '04Omnica': '04Omnica Corporation',
    '05Omnica': '04Omnica Corporation',
    '05Vishkar': '05Vishkar Corporation',
    '08Ironclad': '08Ironclad Guild',
    '10Ironclad': '08Ironclad Guild',
    '09Crusaders': '09Crusader Initiative',
    '11Volskaya': '11Volskaya Industries',
    '06Crisis': '12The Anubis Omnic Crisis',
    '12Crisis': '12The Anubis Omnic Crisis',
    '13Lumerico': '13Lumérico Incorporated',
    '14Deadlock': '14Deadlock Rebels',
    '08Junkers': '16Junker Monarchy',
    '16Junkers': '16Junker Monarchy',
    '19Wayfinders': '19Wayfinder Society',
    '20Wayfinders': '19Wayfinder Society',
    '21Shimada': '21Shimada Clan',
    '22Shimada': '21Shimada Clan',
    '22Hashimoto': '22Hashimoto Clan',
    '23Hashimoto': '22Hashimoto Clan',
    '23Conspiracy': '23The Chernobog Conspiracy',
    '24Conspiracy': '23The Chernobog Conspiracy',
    '24Oasis': '24Oasis Ministries',
    '25Oasis': '24Oasis Ministries',
    '27Collective': '27The Martins Collective',
    '28Collective': '27The Martins Collective',
    '29Phreaks': '29The Phreaks',
    '30Phreaks': '29The Phreaks',
    '30MEKA': '30M.E.K.A Squad',
    '31MEKA': '30M.E.K.A Squad',
    '32Yokai': '32Yokai Gang',
    '33Yokai': '32Yokai Gang'
};

function countryFiltersMatchEntity(entity, activeFilters) {
    if (!entity || !activeFilters || activeFilters.size === 0) return false;
    let anyCountryChip = false;
    for (const f of activeFilters) {
        if (String(f).startsWith('country:')) {
            anyCountryChip = true;
            break;
        }
    }
    if (!anyCountryChip) return false;
    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
    const files = lh && typeof lh.collectCountryFlagFilesForEntity === 'function'
        ? lh.collectCountryFlagFilesForEntity(entity)
        : [];
    if (!files.length) return false;
    const flagSet = new Set(files);
    for (const f of activeFilters) {
        const s = String(f ?? '');
        if (!s.startsWith('country:')) continue;
        const want = s.slice('country:'.length).trim();
        if (want && flagSet.has(want)) return true;
    }
    return false;
}

function factionIdMatchesActiveFilters(factionId, activeFilters) {
    if (factionId == null || !activeFilters) return false;
    const id = String(factionId).trim();
    if (!id) return false;
    if (activeFilters.has(id)) return true;
    const canonical = LEGACY_FACTION_ID_TO_CANONICAL[id];
    if (canonical && activeFilters.has(canonical)) return true;
    const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
    if (fh && typeof fh.activeFilterSetMatchesFactionId === 'function') {
        return fh.activeFilterSetMatchesFactionId(activeFilters, factionId);
    }
    return false;
}

/**
 * True if this entity's hero/faction ids intersect active globe filters.
 * @param {Object|null|undefined} entity - Event root or variant object
 * @param {Set} activeFilters - Set of active filter IDs
 */
export function entityMatchesActiveFilters(entity, activeFilters) {
    if (!entity || !activeFilters || activeFilters.size === 0) {
        return false;
    }
    const heroFilters = getStoryEventHeroTokens(entity);
    const npcFilters = getStoryEventNpcTokens(entity);
    const factionFilters = getStoryEventFactionTokens(entity);
    return heroFilters.some((id) => id != null && activeFilters.has(String(id).trim()))
        || npcFilters.some((id) => id != null && activeFilters.has(String(id).trim()))
        || factionFilters.some((id) => factionIdMatchesActiveFilters(id, activeFilters))
        || countryFiltersMatchEntity(entity, activeFilters);
}

/**
 * First variant index that matches filters, or 0 if only the root matches, or 0 when no filters.
 * @param {Object|null|undefined} event - Root timeline event (may include `variants[]`)
 * @param {Set} activeFilters
 * @returns {number}
 */
export function getPreferredVariantIndexForActiveFilters(event, activeFilters) {
    if (!event || !activeFilters || activeFilters.size === 0) {
        return 0;
    }
    const variants = event.variants;
    if (!variants || variants.length === 0) {
        return 0;
    }
    for (let i = 0; i < variants.length; i++) {
        if (entityMatchesActiveFilters(variants[i], activeFilters)) {
            return i;
        }
    }
    if (entityMatchesActiveFilters(event, activeFilters)) {
        return 0;
    }
    return 0;
}

/**
 * How many of an event's root + variants individually match active filters.
 * @param {Object|null|undefined} event
 * @param {Set} activeFilters
 * @returns {number}
 */
export function countFilterMatchingEntitiesInEvent(event, activeFilters) {
    if (!event || !activeFilters || activeFilters.size === 0) {
        return 0;
    }
    const variants = event.variants;
    if (!variants || variants.length === 0) {
        return entityMatchesActiveFilters(event, activeFilters) ? 1 : 0;
    }
    let n = 0;
    if (entityMatchesActiveFilters(event, activeFilters)) n++;
    for (let i = 0; i < variants.length; i++) {
        if (entityMatchesActiveFilters(variants[i], activeFilters)) n++;
    }
    return n;
}
