/**
 * Wire the four tab buttons (Heroes / Factions / NPCs / Countries) at the top
 * of the filters panel. Clicking a tab swaps the grid contents, plays a
 * `switchMap` sound (only when changing tabs, not when re-clicking the active
 * one), and refreshes per-tab counts.
 *
 * Active-state visuals are mirrored to `aria-selected` so screen readers and
 * `:has([aria-selected=true])` CSS keep in sync without an extra observer.
 *
 * Item lists are read via getters so promote/demote / manifest reloads that
 * replace `FilterService.heroes` / `.npcs` stay visible on the next tab click.
 */

function deactivateAllTabs(tabs) {
    tabs.forEach((tab) => {
        if (!tab) return;
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
}

/**
 * @param {HTMLElement|null} tab
 * @param {HTMLElement[]} otherTabs
 * @param {() => unknown[]} getItems
 * @param {string} type
 * @param {string} folder
 * @param {(items: unknown[], type: string, folder: string) => void} createFilterButtons
 * @param {() => void} updateFilterCounts
 */
function makeTabHandler(tab, otherTabs, getItems, type, folder, createFilterButtons, updateFilterCounts) {
    return () => {
        if (!tab.classList.contains('active') && window.SoundEffectsManager) {
            window.SoundEffectsManager.play('switchMap');
        }
        deactivateAllTabs([tab, ...otherTabs]);
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const items = typeof getItems === 'function' ? getItems() : [];
        createFilterButtons(Array.isArray(items) ? items : [], type, folder);
        updateFilterCounts();
    };
}

/**
 * @param {HTMLElement|null} heroesTab
 * @param {HTMLElement|null} factionsTab
 * @param {HTMLElement|null} npcsTab
 * @param {HTMLElement|null} countriesTab
 * @param {() => unknown[]} getHeroes
 * @param {() => unknown[]} getFactions
 * @param {() => unknown[]} getNpcs
 * @param {() => unknown[]} getCountries
 * @param {(items: unknown[], type: string, folder: string) => void} createFilterButtons
 * @param {() => void} updateFilterCounts
 */
export function wireFilterTabs(
    heroesTab,
    factionsTab,
    npcsTab,
    countriesTab,
    getHeroes,
    getFactions,
    getNpcs,
    getCountries,
    createFilterButtons,
    updateFilterCounts,
) {
    const all = [heroesTab, factionsTab, npcsTab, countriesTab];
    if (heroesTab) {
        heroesTab.addEventListener(
            'click',
            makeTabHandler(
                heroesTab,
                [factionsTab, npcsTab, countriesTab],
                getHeroes,
                'heroes',
                'src/assets/images/Filters/Heroes',
                createFilterButtons,
                updateFilterCounts,
            ),
        );
    }
    if (factionsTab) {
        factionsTab.addEventListener(
            'click',
            makeTabHandler(
                factionsTab,
                [heroesTab, npcsTab, countriesTab],
                getFactions,
                'factions',
                'src/assets/images/Filters/Factions',
                createFilterButtons,
                updateFilterCounts,
            ),
        );
    }
    if (npcsTab) {
        npcsTab.addEventListener(
            'click',
            makeTabHandler(
                npcsTab,
                [heroesTab, factionsTab, countriesTab],
                getNpcs,
                'npcs',
                'src/assets/images/Filters/NPCs',
                createFilterButtons,
                updateFilterCounts,
            ),
        );
    }
    if (countriesTab) {
        countriesTab.addEventListener(
            'click',
            makeTabHandler(
                countriesTab,
                [heroesTab, factionsTab, npcsTab],
                getCountries,
                'countries',
                'src/assets/images/Filters/Flags',
                createFilterButtons,
                updateFilterCounts,
            ),
        );
    }
    void all;
}
