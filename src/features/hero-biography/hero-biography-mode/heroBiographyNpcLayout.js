/**
 * NPC Biography strip — flat chip grid: group order, single continuous flow, 31 + 32 rows.
 */

import { matchNpcManifestToArchiveRowName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import {
    ensureArchiveLayoutSnapshotsForFilter,
    getNpcsArchiveRowsForFilterGrouping,
} from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';
import {
    displayLabelForNpcArchiveCategory,
    NPC_ARCHIVE_CATEGORY_ORDER,
    normalizeNpcArchiveCategory,
    resolveNpcCategoryFromArchiveRow,
    sortNpcsArchiveEventsStable,
} from '../../Data-Archive/archive-category-npcs/ArchiveNpcOrdering.js';

/** @typedef {{ category: string, chips: string[] }} NpcBiographyChipSegment */

/** Top biography row chip count (63 NPCs total → 31 + 32). */
export const NPC_BIOGRAPHY_TOP_ROW_CHIP_COUNT = 31;

/**
 * Category order for the flat strip (chips within each category stay name-sorted).
 * @type {readonly string[]}
 */
export const NPC_BIOGRAPHY_CATEGORY_DISPLAY_ORDER = Object.freeze([
    'Overwatch',
    'Talon',
    'Shimada',
    'Yokai',
    'MEKA',
    'Phreaks',
    'Deadlock',
    'Junkers',
    'Lucheng',
    'Historical Figures',
    'Civilians',
    'Other',
]);

/**
 * @param {string[]} manifestNpcs
 * @returns {Promise<{
 *   groups: Record<string, string[]>,
 *   other: string[],
 * }>}
 */
export async function buildNpcBiographyCategoryGroups(manifestNpcs) {
    await ensureArchiveLayoutSnapshotsForFilter('npcs');

    /** @type {Record<string, string[]>} */
    const groups = {};
    for (const category of NPC_ARCHIVE_CATEGORY_ORDER) {
        groups[category] = [];
    }

    const events = getNpcsArchiveRowsForFilterGrouping().slice();
    sortNpcsArchiveEventsStable(events);

    const usedNpcIds = new Set();

    for (const ev of events) {
        const npcId = matchNpcManifestToArchiveRowName(ev?.name, manifestNpcs);
        if (!npcId || usedNpcIds.has(npcId)) continue;

        const column = normalizeNpcArchiveCategory(resolveNpcCategoryFromArchiveRow(ev)) || 'Other';
        if (!groups[column]) {
            groups[column] = [];
        }

        usedNpcIds.add(npcId);
        groups[column].push(npcId);
    }

    /** @type {string[]} */
    const other = [];
    for (const npcId of manifestNpcs) {
        if (npcId && !usedNpcIds.has(npcId)) {
            other.push(npcId);
        }
    }

    other.sort((a, b) =>
        String(a || '').localeCompare(String(b || ''), undefined, {
            numeric: true,
            sensitivity: 'base',
        }),
    );

    for (const category of NPC_ARCHIVE_CATEGORY_ORDER) {
        const chips = groups[category] || [];
        chips.sort((a, b) =>
            String(a || '').localeCompare(String(b || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        );
    }

    if (other.length > 0) {
        groups.Other = [...(groups.Other || []), ...other];
        groups.Other.sort((a, b) =>
            String(a || '').localeCompare(String(b || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        );
    }

    return { groups, other: [] };
}

/**
 * @param {string} category
 * @returns {string}
 */
export function labelForNpcBiographyCategory(category) {
    return displayLabelForNpcArchiveCategory(category) || category;
}

/**
 * Assign category chips into two rows (31 + 32), splitting a category at the row boundary if needed.
 * @param {string[]} manifestNpcs
 * @returns {Promise<{ top: NpcBiographyChipSegment[], bottom: NpcBiographyChipSegment[] }>}
 */
export async function buildNpcBiographyFlatChipRowSegments(manifestNpcs) {
    const { groups } = await buildNpcBiographyCategoryGroups(manifestNpcs);

    /** @type {NpcBiographyChipSegment[]} */
    const top = [];
    /** @type {NpcBiographyChipSegment[]} */
    const bottom = [];
    let topCount = 0;
    let bottomCount = 0;
    const topLimit = NPC_BIOGRAPHY_TOP_ROW_CHIP_COUNT;
    const bottomLimit = 63 - topLimit;

    /** @type {string[]} */
    const categoryOrder = [];
    for (const category of NPC_BIOGRAPHY_CATEGORY_DISPLAY_ORDER) {
        categoryOrder.push(category);
    }
    for (const category of NPC_ARCHIVE_CATEGORY_ORDER) {
        if (!categoryOrder.includes(category)) categoryOrder.push(category);
    }

    for (const category of categoryOrder) {
        const chips = groups[category];
        if (!Array.isArray(chips) || chips.length === 0) continue;

        let offset = 0;
        while (offset < chips.length) {
            if (topCount < topLimit) {
                const take = Math.min(chips.length - offset, topLimit - topCount);
                top.push({ category, chips: chips.slice(offset, offset + take) });
                topCount += take;
                offset += take;
                continue;
            }
            if (bottomCount < bottomLimit) {
                const take = Math.min(chips.length - offset, bottomLimit - bottomCount);
                bottom.push({ category, chips: chips.slice(offset, offset + take) });
                bottomCount += take;
                offset += take;
                continue;
            }
            break;
        }
    }

    return { top, bottom };
}

/** @deprecated Use {@link buildNpcBiographyFlatChipRowSegments} */
export async function buildNpcBiographyFlatChipRows(manifestNpcs) {
    const { top, bottom } = await buildNpcBiographyFlatChipRowSegments(manifestNpcs);
    return {
        top: top.flatMap((s) => s.chips),
        bottom: bottom.flatMap((s) => s.chips),
    };
}
