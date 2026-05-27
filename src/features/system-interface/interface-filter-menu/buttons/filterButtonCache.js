/**
 * Per-tab cache of already-built filter chip DOM nodes. Switching tabs is hot
 * (the user toggles between Heroes/Factions/NPCs frequently), and rebuilding
 * hundreds of chips every time pegs the layout thread — so we hold the
 * `<div.filter-btn>` references and re-append them on tab switch.
 *
 * The selection class is reconciled from `stateManager` on each restore: the
 * cached node remembers its `dataset.filterKey` but the "selected" state of
 * that key may have changed while it was offscreen.
 */

export function tryReuseCachedFilterButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts) {
    if (!buttonCache[type]) return false;

    filtersGrid.innerHTML = '';
    buttonCache[type].forEach(cachedBtn => {
        const filterKey = cachedBtn.dataset.filterKey;
        if (filterKey) {
            if (stateManager.has(filterKey)) {
                cachedBtn.classList.add('selected');
            } else {
                cachedBtn.classList.remove('selected');
            }
        }
        filtersGrid.appendChild(cachedBtn);
    });
    updateFilterCounts();
    return true;
}
