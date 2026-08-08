/**
 * NPCs filter tab — Gallery Select File style: flat two-row labeled category segments.
 */

import { createFilterButton } from '../createFilterButton.js';
import {
    buildNpcBiographyFlatChipRowSegments,
    labelForNpcBiographyCategory,
} from '../../../../gallery/gallery-mode/heroBiographyNpcLayout.js';
import {
    buildFiltersChipBoard,
    buildFiltersChipSubgroup,
    createFiltersChipSubrow,
} from './filtersChipBoardDom.js';

/**
 * @returns {Promise<HTMLElement[]>}
 */
export async function buildGroupedNpcArchiveFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts,
) {
    filtersGrid.innerHTML = '';
    const { top, bottom } = await buildNpcBiographyFlatChipRowSegments(items);
    const { board, body } = buildFiltersChipBoard('flat', 'NPCs');

    for (const rowKey of /** @type {const} */ (['top', 'bottom'])) {
        const segments = rowKey === 'top' ? top : bottom;
        const row = createFiltersChipSubrow(rowKey);
        for (const segment of segments) {
            if (!segment.chips?.length) continue;
            const wraps = segment.chips.map((npcId) =>
                createFilterButton(
                    npcId,
                    'npcs',
                    folder,
                    stateManager,
                    imageService,
                    soundManager,
                    updateFilterCounts,
                ),
            );
            row.appendChild(
                buildFiltersChipSubgroup(
                    segment.category,
                    labelForNpcBiographyCategory(segment.category),
                    wraps,
                ),
            );
        }
        if (row.childElementCount > 0) body.appendChild(row);
    }

    filtersGrid.appendChild(board);
    return [board];
}
