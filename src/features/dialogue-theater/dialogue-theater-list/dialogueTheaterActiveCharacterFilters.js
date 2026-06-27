/**
 * Active character filters when opening a conversation from the list (pair search or hero chips).
 */

import { getHeroFiltersFromStandaloneActiveFilters } from './dialogueTheaterHeroFilter.js';
import { isDialogueTheaterPairSearchActive } from './dialogueTheaterPairSearch.js';

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

    if (isDialogueTheaterPairSearchActive(pairA, pairB)) {
        return [pairA, pairB].map((value) => String(value || '').trim()).filter(Boolean);
    }

    return getHeroFiltersFromStandaloneActiveFilters(activeFilters);
}
