/**
 * Update the four `<span class="filter-count">` badges next to each tab. The
 * count display switches between `inline` (legacy spots) and `block` (when
 * the count badge lives inside `.filter-tab`) so the badge sits neatly under
 * the icon rather than after it.
 */

function updateCountBadge(element, count) {
    if (!element) return;
    if (count > 0) {
        element.textContent = count;
        const inFilterTab = element.closest && element.closest('.filter-tab');
        element.style.display = inFilterTab ? 'block' : 'inline';
    } else {
        element.style.display = 'none';
    }
}

export function updateFilterTabCounts(stateManager) {
    const { heroCount, factionCount, npcCount = 0, countryCount = 0 } = stateManager.getCounts();
    updateCountBadge(document.getElementById('heroesCount'), heroCount);
    updateCountBadge(document.getElementById('factionsCount'), factionCount);
    updateCountBadge(document.getElementById('npcsCount'), npcCount);
    updateCountBadge(document.getElementById('countriesCount'), countryCount);
}
