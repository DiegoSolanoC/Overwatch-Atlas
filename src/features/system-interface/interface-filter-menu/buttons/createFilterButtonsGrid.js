/**
 * Entry orchestrator for `filtersGrid` population.
 *
 *   1. Hit `tryReuseCachedFilterButtons` -> bail with re-appended DOM if hot.
 *   2. Pick the layout:
 *        - factions / heroes / npcs / countries -> Gallery-style chip boards
 *        - fallback                             -> wrapping chip row
 *   3. Cache the resulting top-level nodes so the next tab switch is cheap.
 *   4. Preload the OTHER tabs' images on a stagger so switching tabs feels
 *      instant later.
 */

import { tryReuseCachedFilterButtons } from './filterButtonCache.js';
import { createFilterButton } from './createFilterButton.js';
import { buildGroupedFactionArchiveFilterDom } from './archive-layouts/buildGroupedFactionDom.js';
import { buildGroupedHeroArchiveFilterDom } from './archive-layouts/buildGroupedHeroDom.js';
import { buildGroupedNpcArchiveFilterDom } from './archive-layouts/buildGroupedNpcDom.js';
import { buildGroupedCountryFilterDom } from './archive-layouts/buildGroupedCountryDom.js';

function scheduleOtherTabPreloads(type, { heroes, factions, npcs, countries }, preloadImages) {
    const npcList = Array.isArray(npcs) ? npcs : [];
    const countryList = Array.isArray(countries) ? countries : [];

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
 * @returns {Promise<void>}
 */
export async function createFilterButtonsGrid(
    items, type, folder,
    filtersGrid, buttonCache,
    stateManager, imageService, soundManager,
    heroes, factions, npcs, countries,
    preloadImages, updateFilterCounts,
    groupFactionsByArchiveType = false,
    groupHeroesByArchiveRole = false,
    groupNpcsByArchiveCategory = false
) {
    if (!filtersGrid) return;
    if (tryReuseCachedFilterButtons(type, buttonCache, filtersGrid, stateManager, updateFilterCounts)) {
        return;
    }

    filtersGrid.innerHTML = '';
    filtersGrid.classList.add('filters-grid--chip-board');
    filtersGrid.classList.remove('filters-grid--chip-board-columns');
    filtersGrid.classList.add('filters-grid--chip-board-flat');
    filtersGrid.classList.toggle('filters-grid--chip-board-flags', type === 'countries');

    /** @type {HTMLElement[]} */
    let cachedButtons = [];

    if (type === 'factions' && groupFactionsByArchiveType) {
        cachedButtons = await buildGroupedFactionArchiveFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else if (type === 'heroes' && groupHeroesByArchiveRole) {
        cachedButtons = await buildGroupedHeroArchiveFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else if (type === 'npcs' && groupNpcsByArchiveCategory) {
        cachedButtons = await buildGroupedNpcArchiveFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else if (type === 'countries') {
        cachedButtons = await buildGroupedCountryFilterDom(
            items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
        );
    } else {
        const row = document.createElement('div');
        row.className = 'filters-chip-board__chips-row filters-chip-board__chips-row--wrap';
        row.setAttribute('role', 'list');
        items.forEach((item) => {
            const wrap = createFilterButton(
                item, type, folder, stateManager, imageService, soundManager, updateFilterCounts,
            );
            row.appendChild(wrap);
        });
        filtersGrid.appendChild(row);
        cachedButtons = [row];
    }

    buttonCache[type] = cachedButtons;
    scheduleOtherTabPreloads(type, { heroes, factions, npcs, countries }, preloadImages);
    updateFilterCounts();
}
