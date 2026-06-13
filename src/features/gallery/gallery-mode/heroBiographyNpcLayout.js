/**
 * NPC Biography strip — flat chip grid: group order, two rows, whole categories only.
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
} from '../../data-workshop/archive-category-npcs/ArchiveNpcOrdering.js';

/** @typedef {{ category: string, chips: string[] }} NpcBiographyChipSegment */

/**
 * Preferred top-row chip budget before whole categories wrap to row 2.
 * Rows may end uneven — categories are never split across rows.
 */
export const NPC_BIOGRAPHY_TOP_ROW_CHIP_COUNT = 36;

/** @type {number} */
export const NPC_BIOGRAPHY_TOTAL_CHIP_SLOTS = 71;

/**
 * @param {Record<string, string[]>} groups
 * @param {readonly string[]} categoryOrder
 * @returns {{ top: NpcBiographyChipSegment[], bottom: NpcBiographyChipSegment[] }}
 */
export function assignNpcBiographyCategoryRows(groups, categoryOrder) {
    /** @type {NpcBiographyChipSegment[]} */
    const top = [];
    /** @type {NpcBiographyChipSegment[]} */
    const bottom = [];
    let topCount = 0;
    const topLimit = NPC_BIOGRAPHY_TOP_ROW_CHIP_COUNT;

    for (const category of categoryOrder) {
        const chips = groups[category];
        if (!Array.isArray(chips) || chips.length === 0) continue;

        const segment = { category, chips };
        if (topCount + chips.length <= topLimit) {
            top.push(segment);
            topCount += chips.length;
        } else {
            bottom.push(segment);
        }
    }

    return { top, bottom };
}

/**
 * Category order for the flat strip (chips within each category stay name-sorted).
 * @type {readonly string[]}
 */
export const NPC_BIOGRAPHY_CATEGORY_DISPLAY_ORDER = Object.freeze([
    'Overwatch',
    'Talon',
    'Null Sector',
    'Shimada',
    'Hashimoto',
    'Yokai',
    'MEKA',
    'Phreaks',
    'Deadlock',
    'Junkers',
    'Gladiators',
    'Lucheng',
    'Influential Figures',
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
 * Assign category chips into two rows without splitting any category group.
 * @param {string[]} manifestNpcs
 * @returns {Promise<{ top: NpcBiographyChipSegment[], bottom: NpcBiographyChipSegment[] }>}
 */
export async function buildNpcBiographyFlatChipRowSegments(manifestNpcs) {
    const { groups } = await buildNpcBiographyCategoryGroups(manifestNpcs);

    /** @type {string[]} */
    const categoryOrder = [];
    for (const category of NPC_BIOGRAPHY_CATEGORY_DISPLAY_ORDER) {
        categoryOrder.push(category);
    }
    for (const category of NPC_ARCHIVE_CATEGORY_ORDER) {
        if (!categoryOrder.includes(category)) categoryOrder.push(category);
    }

    return assignNpcBiographyCategoryRows(groups, categoryOrder);
}

/** @deprecated Use {@link buildNpcBiographyFlatChipRowSegments} */
export async function buildNpcBiographyFlatChipRows(manifestNpcs) {
    const { top, bottom } = await buildNpcBiographyFlatChipRowSegments(manifestNpcs);
    return {
        top: top.flatMap((s) => s.chips),
        bottom: bottom.flatMap((s) => s.chips),
    };
}
