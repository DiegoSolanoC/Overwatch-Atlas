/**
 * Update the selection-count strip beside the Filters search box
 * (`#heroesCount` / `#factionsCount` / `#npcsCount` / `#countriesCount`).
 * Each green number is how many chips of that category are currently selected.
 */

/**
 * @param {HTMLElement | null} element
 * @param {number} count
 */
function updateSelectionCount(element, count) {
    if (!element) return;
    const n = Number.isFinite(count) && count > 0 ? count : 0;
    element.textContent = String(n);
    element.style.display = '';
    const item = element.closest?.('.filters-selection-count');
    if (item) {
        item.classList.toggle('is-active', n > 0);
        item.setAttribute('aria-label', `${n} selected`);
    }
}

/**
 * @param {{ getCounts?: () => {
 *   heroCount: number, factionCount: number, npcCount?: number, countryCount?: number
 * } }|null|undefined} stateManager
 */
export function updateFilterTabCounts(stateManager) {
    if (!stateManager || typeof stateManager.getCounts !== 'function') return;
    const { heroCount, factionCount, npcCount = 0, countryCount = 0 } = stateManager.getCounts();
    updateSelectionCount(document.getElementById('heroesCount'), heroCount);
    updateSelectionCount(document.getElementById('factionsCount'), factionCount);
    updateSelectionCount(document.getElementById('npcsCount'), npcCount);
    updateSelectionCount(document.getElementById('countriesCount'), countryCount);
}
