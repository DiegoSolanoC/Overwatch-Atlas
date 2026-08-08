/**
 * Active character filters when opening a conversation from the list (pair search or hero chips).
 */

import { getHeroFiltersFromStandaloneActiveFilters } from './dialogueTheaterHeroFilter.js';
import {
    isDialogueTheaterPairSearchActive,
    resolveExactRosterHero,
} from './dialogueTheaterPairSearch.js';

/**
 * @returns {string[]}
 */
function manifestHeroesForFilters() {
    const fs = typeof window !== 'undefined' ? window.FilterService : null;
    return Array.isArray(fs?.heroes) ? fs.heroes : [];
}

/**
 * @param {{ getPairA?: () => string, getPairB?: () => string }|null|undefined} pairSearchControls
 * @param {Set<string>|undefined|null} [activeFilters]
 * @returns {string[]}
 */
export function getActiveDialogueTheaterCharacterFilters(
    pairSearchControls,
    activeFilters = typeof window !== 'undefined' ? window.standaloneActiveFilters : null,
) {
    const pairA = pairSearchControls?.getPairA?.() || '';
    const pairB = pairSearchControls?.getPairB?.() || '';
    const manifestHeroes = manifestHeroesForFilters();

    if (isDialogueTheaterPairSearchActive(pairA, pairB, manifestHeroes)) {
        return [pairA, pairB]
            .map((value) => resolveExactRosterHero(value, manifestHeroes))
            .filter(Boolean);
    }

    return getHeroFiltersFromStandaloneActiveFilters(activeFilters);
}
