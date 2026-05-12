/**
 * Entry orchestrator for `filtersGrid` population.
 *
 *   1. Hit `tryReuseCachedFilterButtons` -> bail with re-appended DOM if hot.
 *   2. Pick the layout:
 *        - factions tab + grouped requested -> faction-type buckets
 *        - heroes tab + grouped requested   -> role + subrole buckets
 *        - everything else                  -> flat chip list
 *   3. Cache the resulting buttons array so the next tab switch is cheap.
 *   4. Preload the OTHER tabs' images on a stagger so switching tabs feels
 *      instant later.
 */

import { tryReuseCachedFilterButtons } from './filterButtonCache.js';
import { createFilterButton } from './createFilterButton.js';
import { buildGroupedFactionArchiveFilterDom } from './archive-layouts/buildGroupedFactionDom.js';
import { buildGroupedHeroArchiveFilterDom } from './archive-layouts/buildGroupedHeroDom.js';

function scheduleOtherTabPreloads(type, { heroes, factions, npcs, countries }, preloadImages) {
    const npcList = Array.isArray(npcs) ? npcs : [];
    const countryList = Array.isArray(countries) ? countries : [];

    /* Per-tab preload schedule chosen so the most-likely "next tab" finishes
       first while the current tab is still rendering its chips. */
    if (type === 'heroes') {
        if (factions.length > 0) setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 100);
        if (npcList.length > 0) setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 150);
        if (countryList.length > 0) setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
    } else if (type === 'factions') {
        if (heroes.length > 0) setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        if (npcList.length > 0) setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 150);
        if (countryList.length > 0) setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
    } else if (type === 'npcs') {
        if (heroes.length > 0) setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        if (factions.length > 0) setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 150);
        if (countryList.length > 0) setTimeout(() => preloadImages(countryList, 'countries', 'src/assets/images/Filters/Flags'), 200);
    } else if (type === 'countries') {
        if (heroes.length > 0) setTimeout(() => preloadImages(heroes, 'heroes', 'src/assets/images/Filters/Heroes'), 100);
        if (factions.length > 0) setTimeout(() => preloadImages(factions, 'factions', 'src/assets/images/Filters/Factions'), 120);
        if (npcList.length > 0) setTimeout(() => preloadImages(npcList, 'npcs', 'src/assets/images/Filters/NPCs'), 140);
    }
}

/**
 * @param {boolean} [groupFactionsByArchiveType] When true and `type === 'factions'`,
 *   group chips by archive faction type (always set for the factions tab).
 * @param {boolean} [groupHeroesByArchiveRole] When true and `type === 'heroes'`,
 *   group chips by role + subrole (always set for the heroes tab).
 */
export function createFilterButtonsGrid(
    items, type, folder,
    filtersGrid, buttonCache,
    stateManager, imageService, soundManager,
    heroes, factions, npcs, countries,
    preloadImages, updateFilterCounts,
    groupFactionsByArchiveType = false,
    groupHeroesByArchiveRole = false
) {
    if (!filtersGrid) return;
    if (tryReuseCachedFilterButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts)) return;

    filtersGrid.innerHTML = '';
    let cachedButtons = [];

    if (type === 'factions' && groupFactionsByArchiveType) {
        cachedButtons = buildGroupedFactionArchiveFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else if (type === 'heroes' && groupHeroesByArchiveRole) {
        cachedButtons = buildGroupedHeroArchiveFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else {
        items.forEach(item => {
            const filterBtn = createFilterButton(item, type, folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(filterBtn);
            cachedButtons.push(filterBtn);
        });
    }

    buttonCache[type] = cachedButtons;
    scheduleOtherTabPreloads(type, { heroes, factions, npcs, countries }, preloadImages);
    updateFilterCounts();
}
