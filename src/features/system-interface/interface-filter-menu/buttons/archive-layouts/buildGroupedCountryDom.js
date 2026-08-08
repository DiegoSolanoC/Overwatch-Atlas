/**
 * Countries filter tab — three full-width bands by timeline usage:
 * Primary (≥5), Occasional (1–4), Unvisited (0, search-only).
 */

import { createFilterButton } from '../createFilterButton.js';
import {
    COUNTRY_FILTER_TIER_ORDER,
    groupCountriesByFilterTier,
} from './countryFilterCategories.js';
import { buildFiltersChipBoard } from './filtersChipBoardDom.js';

/**
 * @returns {Promise<HTMLElement[]>}
 */
export async function buildGroupedCountryFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts,
) {
    filtersGrid.innerHTML = '';
    const groups = groupCountriesByFilterTier(items);
    const { board, body } = buildFiltersChipBoard('flat', 'Countries');

    for (const { key, label } of COUNTRY_FILTER_TIER_ORDER) {
        const tierItems = groups[key] || [];
        if (!tierItems.length) continue;

        const band = document.createElement('section');
        band.className = `filters-chip-board__role-band filters-chip-board__country-band filters-chip-board__country-band--${key}`;
        band.classList.add('filters-chip-board__role-column');
        band.dataset.countryTier = key;
        band.setAttribute('aria-label', label);
        if (key === 'unvisited') {
            band.dataset.countryVisibility = 'search-only';
        }

        const heading = document.createElement('h3');
        heading.className = 'filters-chip-board__role-heading';
        heading.textContent = label;
        band.appendChild(heading);

        const row = document.createElement('div');
        row.className = 'filters-chip-board__chips-row filters-chip-board__chips-row--wrap';
        row.setAttribute('role', 'list');

        for (const item of tierItems) {
            row.appendChild(
                createFilterButton(
                    item,
                    'countries',
                    folder,
                    stateManager,
                    imageService,
                    soundManager,
                    updateFilterCounts,
                ),
            );
        }

        band.appendChild(row);
        body.appendChild(band);
    }

    filtersGrid.appendChild(board);
    return [board];
}
