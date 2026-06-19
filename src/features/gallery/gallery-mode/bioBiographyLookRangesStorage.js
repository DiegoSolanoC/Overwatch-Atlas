/**
 * Category-aware look range accessors (heroes + factions).
 */

import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    getFactionBiographyLookRange,
    saveFactionBiographyLookRange,
} from './factionBiographyLookRangesStorage.js';
import {
    getHeroBiographyLookRange,
    saveHeroBiographyLookRange,
} from './heroBiographyLookRangesStorage.js';

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {string} lookName
 * @returns {{ startEvent: string, endEvent: string } | null}
 */
export function getBioBiographyLookRange(category, entityKey, lookName) {
    const cat = normalizeBioBiographyCategory(category);
    if (cat === 'factions') return getFactionBiographyLookRange(entityKey, lookName);
    if (cat === 'heroes') return getHeroBiographyLookRange(entityKey, lookName);
    return null;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {string} lookName
 * @param {{ startEvent?: string, endEvent?: string }} range
 */
export function saveBioBiographyLookRange(category, entityKey, lookName, range) {
    const cat = normalizeBioBiographyCategory(category);
    if (cat === 'factions') {
        saveFactionBiographyLookRange(entityKey, lookName, range);
        return;
    }
    if (cat === 'heroes') {
        saveHeroBiographyLookRange(entityKey, lookName, range);
    }
}
