/**
 * Per-tab cache of already-built filter chip board DOM nodes.
 */

export function tryReuseCachedFilterButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts) {
    if (!buttonCache[type]) return false;

    filtersGrid.innerHTML = '';
    filtersGrid.classList.add('filters-grid--chip-board');
    filtersGrid.classList.remove('filters-grid--chip-board-columns');
    filtersGrid.classList.add('filters-grid--chip-board-flat');
    filtersGrid.classList.toggle('filters-grid--chip-board-flags', type === 'countries');

    buttonCache[type].forEach((cachedNode) => {
        if (!(cachedNode instanceof HTMLElement)) return;
        cachedNode.querySelectorAll('.filter-btn').forEach((btn) => {
            const filterKey = btn.dataset.filterKey;
            if (!filterKey) return;
            const selected = stateManager.has(filterKey);
            btn.classList.toggle('selected', selected);
            btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        /* Migrate older country chips to wide flag proportion if cache predates the class. */
        if (type === 'countries') {
            cachedNode.querySelectorAll('.filters-chip-wrap').forEach((wrap) => {
                wrap.classList.add('filters-chip-wrap--flag');
                wrap.querySelector('.filter-btn')?.classList.add('filters-chip--flag');
            });
        }
        filtersGrid.appendChild(cachedNode);
    });
    updateFilterCounts();
    return true;
}
