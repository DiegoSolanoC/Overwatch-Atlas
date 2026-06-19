/**
 * Faction biography looks per faction from platform manifest (`factionBios`).
 */

import {
    DEFAULT_FACTION_LOOK,
    sortFactionLookNames,
} from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';
import { fetchPlatformManifest } from './loadHeroBiosLooks.js';

/** @type {Record<string, string[]> | null} */
let cachedFactionBiosMap = null;

/**
 * @returns {Promise<Record<string, string[]>>}
 */
export async function loadFactionBiosLooksMap() {
    if (cachedFactionBiosMap) return cachedFactionBiosMap;
    const manifest = await fetchPlatformManifest();
    const raw = manifest?.factionBios;
    cachedFactionBiosMap = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return cachedFactionBiosMap;
}

export function clearFactionBiosLooksCache() {
    cachedFactionBiosMap = null;
}

/**
 * @param {Record<string, string[]>} map
 * @param {string} factionFilename
 * @returns {string[]}
 */
export function getLooksForFaction(map, factionFilename) {
    const key = String(factionFilename || '').trim();
    const fromManifest = key && map[key];
    if (Array.isArray(fromManifest) && fromManifest.length > 0) {
        return sortFactionLookNames(fromManifest);
    }
    return [DEFAULT_FACTION_LOOK];
}
