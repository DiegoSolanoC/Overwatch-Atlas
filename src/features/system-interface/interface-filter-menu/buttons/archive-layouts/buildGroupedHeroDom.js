/**
 * Heroes filter tab — full-width flat bands per role (Tank / Damage / Support),
 * each with labeled subrole chip groups. Same chip look as factions / NPCs,
 * without the 3-column compression that mixed classifications across rows.
 */

import { createFilterButton } from '../createFilterButton.js';
import {
    HERO_BIOGRAPHY_ROLE_ORDER,
    HERO_BIOGRAPHY_SUBROLE_ROWS,
    buildHeroBiographyRoleGroups,
    labelForHeroBiographySubrole,
} from '../../../../gallery/gallery-mode/heroBiographyRoleLayout.js';
import {
    buildFiltersChipBoard,
    buildFiltersChipSubgroup,
    createFiltersChipSubrow,
} from './filtersChipBoardDom.js';

/**
 * @returns {Promise<HTMLElement[]>} top-level nodes to cache (the board)
 */
export async function buildGroupedHeroArchiveFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts,
) {
    filtersGrid.innerHTML = '';
    const roleGroups = await buildHeroBiographyRoleGroups(items);
    const { board, body } = buildFiltersChipBoard('flat', 'Heroes');

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        const roleGroup = roleGroups[role] || {};
        const band = document.createElement('section');
        band.className = `filters-chip-board__role-band filters-chip-board__role-band--${role.toLowerCase()}`;
        // Reuse role-column search hide logic
        band.classList.add('filters-chip-board__role-column');
        band.setAttribute('aria-label', role);

        const heading = document.createElement('h3');
        heading.className = 'filters-chip-board__role-heading';
        heading.textContent = role;
        band.appendChild(heading);

        for (const rowKey of /** @type {const} */ (['top', 'bottom'])) {
            const row = createFiltersChipSubrow(rowKey);
            const subroles = HERO_BIOGRAPHY_SUBROLE_ROWS[role][rowKey];
            for (const subrole of subroles) {
                const ids = roleGroup[subrole] || [];
                if (!ids.length) continue;
                const wraps = ids.map((heroId) =>
                    createFilterButton(
                        heroId,
                        'heroes',
                        folder,
                        stateManager,
                        imageService,
                        soundManager,
                        updateFilterCounts,
                    ),
                );
                row.appendChild(
                    buildFiltersChipSubgroup(
                        subrole,
                        labelForHeroBiographySubrole(subrole),
                        wraps,
                    ),
                );
            }
            if (row.childElementCount > 0) band.appendChild(row);
        }

        if (band.querySelector('.filters-chip-board__subrow')) {
            body.appendChild(band);
        }
    }

    filtersGrid.appendChild(board);
    return [board];
}
