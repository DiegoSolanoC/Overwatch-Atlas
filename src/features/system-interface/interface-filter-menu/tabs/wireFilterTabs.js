/**
 * Wire the four tab buttons (Heroes / Factions / NPCs / Countries) at the top
 * of the filters panel. Clicking a tab swaps the grid contents, plays a
 * `switchMap` sound (only when changing tabs, not when re-clicking the active
 * one), and refreshes per-tab counts.
 *
 * Active-state visuals are mirrored to `aria-selected` so screen readers and
 * `:has([aria-selected=true])` CSS keep in sync without an extra observer.
 */

function deactivateAllTabs(tabs) {
    tabs.forEach(tab => {
        if (!tab) return;
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
}

function makeTabHandler(tab, otherTabs, items, type, folder, createFilterButtons, updateFilterCounts) {
    return () => {
        if (!tab.classList.contains('active') && window.SoundEffectsManager) {
            window.SoundEffectsManager.play('switchMap');
        }
        deactivateAllTabs([tab, ...otherTabs]);
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        createFilterButtons(items, type, folder);
        updateFilterCounts();
    };
}

export function wireFilterTabs(
    heroesTab, factionsTab, npcsTab, countriesTab,
    heroes, factions, npcs, countries,
    createFilterButtons, updateFilterCounts
) {
    const all = [heroesTab, factionsTab, npcsTab, countriesTab];
    if (heroesTab) {
        heroesTab.addEventListener('click', makeTabHandler(
            heroesTab, [factionsTab, npcsTab, countriesTab],
            heroes, 'heroes', 'src/assets/images/Filters/Heroes',
            createFilterButtons, updateFilterCounts
        ));
    }
    if (factionsTab) {
        factionsTab.addEventListener('click', makeTabHandler(
            factionsTab, [heroesTab, npcsTab, countriesTab],
            factions, 'factions', 'src/assets/images/Filters/Factions',
            createFilterButtons, updateFilterCounts
        ));
    }
    if (npcsTab) {
        npcsTab.addEventListener('click', makeTabHandler(
            npcsTab, [heroesTab, factionsTab, countriesTab],
            npcs, 'npcs', 'src/assets/images/Filters/NPCs',
            createFilterButtons, updateFilterCounts
        ));
    }
    if (countriesTab) {
        countriesTab.addEventListener('click', makeTabHandler(
            countriesTab, [heroesTab, factionsTab, npcsTab],
            countries || [], 'countries', 'src/assets/images/Filters/Flags',
            createFilterButtons, updateFilterCounts
        ));
    }
    void all;
}
