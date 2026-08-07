/**
 * Faction Biography strip — same flat two-row board as NPCs:
 * labeled type segments (Major Player, Branches, Criminal, …) packed into top/bottom rows.
 */

import { matchFactionManifestToArchiveRowName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import {
    ensureArchiveLayoutSnapshotsForFilter,
    getFactionsArchiveRowsForFilterGrouping,
} from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';
import {
    displayLabelForFactionArchiveType,
    normalizeFactionArchiveType,
    sortFactionsArchiveEventsStable,
} from '../../data-workshop/archive-category-factions/ArchiveFactionOrdering.js';

/** @typedef {{ key: string, label: string, chips: Array<{ filename: string, displayName?: string }> }} FactionBiographyChipSegment */

/** Preferred top-row chip budget before whole type segments wrap to row 2. */
export const FACTION_BIOGRAPHY_TOP_ROW_CHIP_COUNT = 22;

/** Display order for labeled segments (left → right within each row). */
export const FACTION_BIOGRAPHY_SEGMENT_ORDER = Object.freeze([
    'Major Player',
    'Overwatch Branches',
    'Criminal Groups',
    'Military Initiatives',
    'Research Institutions',
    'Independent Coalitions',
    'Other',
]);

const OVERWATCH_BRANCHES_TYPE = 'Overwatch Branches';

/**
 * @param {string} factionType
 * @returns {string} segment key in {@link FACTION_BIOGRAPHY_SEGMENT_ORDER}
 */
export function resolveFactionBiographySegment(factionType) {
    const normalized = normalizeFactionArchiveType(factionType);
    if (normalized === OVERWATCH_BRANCHES_TYPE) return OVERWATCH_BRANCHES_TYPE;
    if (normalized === 'Major Player') return 'Major Player';
    if (normalized === 'Criminal Groups') return 'Criminal Groups';
    if (normalized === 'Military Initiatives') return 'Military Initiatives';
    if (normalized === 'Research Institutions') return 'Research Institutions';
    if (normalized === 'Independent Coalitions') return 'Independent Coalitions';
    if (!normalized) return 'Major Player';
    return 'Other';
}

/**
 * @param {string} segmentKey
 * @returns {string}
 */
export function labelForFactionBiographySegment(segmentKey) {
    if (segmentKey === OVERWATCH_BRANCHES_TYPE) return OVERWATCH_BRANCHES_TYPE;
    if (segmentKey === 'Other') return 'Other';
    return displayLabelForFactionArchiveType(segmentKey) || segmentKey;
}

/**
 * @param {Record<string, Array<{ filename: string, displayName?: string }>>} groups
 * @param {readonly string[]} segmentOrder
 * @returns {{ top: FactionBiographyChipSegment[], bottom: FactionBiographyChipSegment[] }}
 */
export function assignFactionBiographySegmentRows(groups, segmentOrder) {
    /** @type {FactionBiographyChipSegment[]} */
    const top = [];
    /** @type {FactionBiographyChipSegment[]} */
    const bottom = [];
    let topCount = 0;
    const topLimit = FACTION_BIOGRAPHY_TOP_ROW_CHIP_COUNT;

    for (const key of segmentOrder) {
        const chips = groups[key];
        if (!Array.isArray(chips) || chips.length === 0) continue;

        const segment = {
            key,
            label: labelForFactionBiographySegment(key),
            chips,
        };
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
 * @param {Array<{ filename: string, displayName?: string }>} manifestFactions
 * @returns {Promise<Record<string, Array<{ filename: string, displayName?: string }>>>}
 */
export async function buildFactionBiographySegmentGroups(manifestFactions) {
    await ensureArchiveLayoutSnapshotsForFilter('factions');

    /** @type {Record<string, Array<{ filename: string, displayName?: string }>>} */
    const groups = {};
    for (const key of FACTION_BIOGRAPHY_SEGMENT_ORDER) {
        groups[key] = [];
    }

    const events = getFactionsArchiveRowsForFilterGrouping().slice();
    sortFactionsArchiveEventsStable(events);

    const usedFilenames = new Set();

    for (const ev of events) {
        const entry = matchFactionManifestToArchiveRowName(ev?.name, manifestFactions);
        if (!entry?.filename || usedFilenames.has(entry.filename)) continue;

        const segment = resolveFactionBiographySegment(ev?.factionType);
        if (!groups[segment]) groups[segment] = [];

        usedFilenames.add(entry.filename);
        groups[segment].push(entry);
    }

    for (const f of manifestFactions) {
        if (f?.filename && !usedFilenames.has(f.filename)) {
            groups.Other.push(f);
        }
    }

    for (const key of FACTION_BIOGRAPHY_SEGMENT_ORDER) {
        groups[key].sort((a, b) =>
            String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        );
    }

    return groups;
}

/**
 * @param {Array<{ filename: string, displayName?: string }>} manifestFactions
 * @returns {Promise<{ top: FactionBiographyChipSegment[], bottom: FactionBiographyChipSegment[] }>}
 */
export async function buildFactionBiographyFlatChipRowSegments(manifestFactions) {
    const groups = await buildFactionBiographySegmentGroups(manifestFactions);
    return assignFactionBiographySegmentRows(groups, FACTION_BIOGRAPHY_SEGMENT_ORDER);
}
