import {
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens
} from '../../interface-shared/storyEventFilterPlaces.js';
import { activeFilterSetMatchesNpcId } from '../../interface-shared/npcNameAliases.js';

/**
 * Legacy faction strings in events.json that don't match manifest `filename` (filter chip keys).
 * Values must match manifest `factions[].filename` exactly.
 */
const LEGACY_FACTION_ID_TO_CANONICAL = {
    Talon: 'Talon Empire',
    '03Talon': 'Talon Empire',
    Shambali: 'Shambali Order',
    '13Shambali': 'Shambali Order',
    '25Shambali': 'Shambali Order',
    '26Shambali': 'Shambali Order',
    '09Lucheng': 'Lucheng Interstellar',
    '27Null Sector': 'Null Sector',
    '04Omnica': 'Omnica Corporation',
    '05Omnica': 'Omnica Corporation',
    '05Vishkar': 'Vishkar Corporation',
    '08Ironclad': 'Ironclad Guild',
    '10Ironclad': 'Ironclad Guild',
    '09Crusaders': 'Crusader Initiative',
    '11Volskaya': 'Volskaya Industries',
    '06Crisis': 'Anubis Directives',
    '12Crisis': 'Anubis Directives',
    '12The Anubis Omnic Crisis': 'Anubis Directives',
    '28Deep Sea Raiders': 'Deepsea Raiders',
    '17Colloseo Gladiatori': 'Colosseo Gladiatori',
    '13Lumerico': 'Lumérico Incorporated',
    '14Deadlock': 'Deadlock Rebels',
    '08Junkers': 'Junker Monarchy',
    '16Junkers': 'Junker Monarchy',
    '19Wayfinders': 'Wayfinder Society',
    '20Wayfinders': 'Wayfinder Society',
    '21Shimada': 'Shimada Clan',
    '22Shimada': 'Shimada Clan',
    '22Hashimoto': 'Hashimoto Clan',
    '23Hashimoto': 'Hashimoto Clan',
    '23Conspiracy': 'The Chernobog Conspiracy',
    '24Conspiracy': 'The Chernobog Conspiracy',
    '24Oasis': 'Oasis Ministries',
    '25Oasis': 'Oasis Ministries',
    '27Collective': 'The Martins Collective',
    '28Collective': 'The Martins Collective',
    '29Phreaks': 'The Phreaks',
    '30Phreaks': 'The Phreaks',
    '30MEKA': 'M.E.K.A Squad',
    '31MEKA': 'M.E.K.A Squad',
    '32Yokai': 'Yokai Gang',
    '33Yokai': 'Yokai Gang'
};

function normalizeCountryFlagKey(value) {
    const s = String(value ?? '').trim();
    if (!s) return '';
    if (s.toLowerCase().startsWith('country:')) {
        return s.slice('country:'.length).trim().toLowerCase();
    }
    return s.toLowerCase();
}

function countryFlagFileMatches(wantRaw, haveRaw) {
    const want = normalizeCountryFlagKey(wantRaw);
    const have = normalizeCountryFlagKey(haveRaw);
    if (!want || !have) return false;
    if (want === have) return true;
    const strip = (v) => v.replace(/\.png$/i, '');
    return strip(want) === strip(have);
}

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
    const sec = typeof window !== 'undefined' ? window.__SecondaryCountryFlags : null;
    const collect = lh?.collectCountryFlagFilesForEntity ?? sec?.collectCountryFlagFilesForEntity;
    /** @type {string[]} */
    let files = collect ? collect(entity) : [];

    const getSecondary = lh?.getSecondaryCountryFlagFilenamesForEntity
        ?? sec?.getSecondaryCountryFlagFilenamesForEntity;
    if (getSecondary) {
        const secondary = getSecondary(entity) || [];
        const seen = new Set(files);
        secondary.forEach((flagFile) => {
            const fn = flagFile != null ? String(flagFile).trim() : '';
            if (fn && !seen.has(fn)) {
                seen.add(fn);
                files.push(fn);
            }
        });
    }

    if (!files.length) return false;

    for (const f of activeFilters) {
        const s = String(f ?? '');
        if (!s.startsWith('country:')) continue;
        const want = s.slice('country:'.length).trim();
        if (want && files.some((file) => countryFlagFileMatches(want, file))) {
            return true;
        }
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
        || npcFilters.some((id) => activeFilterSetMatchesNpcId(activeFilters, id))
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
