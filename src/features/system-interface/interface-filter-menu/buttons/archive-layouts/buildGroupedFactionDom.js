/**
 * Factions filter tab — Gallery Select File style: flat two-row labeled type segments.
 */

import { createFilterButton } from '../createFilterButton.js';
import {
    buildFactionBiographyFlatChipRowSegments,
} from '../../../../gallery/gallery-mode/heroBiographyFactionLayout.js';
import {
    buildFiltersChipBoard,
    buildFiltersChipSubgroup,
    createFiltersChipSubrow,
} from './filtersChipBoardDom.js';

/**
 * @returns {Promise<HTMLElement[]>}
 */
export async function buildGroupedFactionArchiveFilterDom(
    items,
    folder,
    filtersGrid,
    stateManager,
    imageService,
    soundManager,
    updateFilterCounts,
) {
    filtersGrid.innerHTML = '';
    const { top, bottom } = await buildFactionBiographyFlatChipRowSegments(items);
    const { board, body } = buildFiltersChipBoard('flat', 'Factions');

    for (const rowKey of /** @type {const} */ (['top', 'bottom'])) {
        const segments = rowKey === 'top' ? top : bottom;
        const row = createFiltersChipSubrow(rowKey);
        for (const segment of segments) {
            if (!segment.chips?.length) continue;
            const wraps = segment.chips.map((entry) =>
                createFilterButton(
                    entry,
                    'factions',
                    folder,
                    stateManager,
                    imageService,
                    soundManager,
                    updateFilterCounts,
                ),
            );
            row.appendChild(buildFiltersChipSubgroup(segment.key, segment.label, wraps));
        }
        if (row.childElementCount > 0) body.appendChild(row);
    }

    filtersGrid.appendChild(board);
    return [board];
}
