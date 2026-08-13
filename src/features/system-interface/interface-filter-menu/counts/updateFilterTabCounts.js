/**
 * Update the four `<span class="filter-count">` badges next to each tab. The
 * count display switches between `inline` (legacy spots) and `block` (when
 * the count badge lives inside `.filter-tab`) so the badge sits neatly under
 * the icon rather than after it.
 *
 * Also updates `#confirmFiltersMatchCount` under Confirm with how many
 * timeline events match the pending selection (hidden when nothing is selected).
 */

import {
    countEventsMatchingFilters,
    getTimelineEventsForFilterMatchCount,
} from './countEventsMatchingFilters.js';

function updateCountBadge(element, count) {
    if (!element) return;
    if (count > 0) {
        element.textContent = String(count);
        const inFilterTab = element.closest && element.closest('.filter-tab');
        const inConfirmBtn = element.closest && element.closest('.filters-confirm-btn');
        element.style.display = inFilterTab || inConfirmBtn ? 'block' : 'inline';
    } else {
        element.style.display = 'none';
    }
}

/**
 * @param {{ selectedFilters?: Set<string>, getCounts?: () => {
 *   heroCount: number, factionCount: number, npcCount?: number, countryCount?: number
 * } }|null|undefined} stateManager
 */
export function updateFilterTabCounts(stateManager) {
    if (!stateManager || typeof stateManager.getCounts !== 'function') return;
    const { heroCount, factionCount, npcCount = 0, countryCount = 0 } = stateManager.getCounts();
    updateCountBadge(document.getElementById('heroesCount'), heroCount);
    updateCountBadge(document.getElementById('factionsCount'), factionCount);
    updateCountBadge(document.getElementById('npcsCount'), npcCount);
    updateCountBadge(document.getElementById('countriesCount'), countryCount);

    const selected = stateManager.selectedFilters;
    const matchCount =
        selected instanceof Set && selected.size > 0
            ? countEventsMatchingFilters(getTimelineEventsForFilterMatchCount(), selected)
            : 0;
    updateCountBadge(document.getElementById('confirmFiltersMatchCount'), matchCount);
}
