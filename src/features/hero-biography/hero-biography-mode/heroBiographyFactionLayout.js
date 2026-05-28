/**
 * Faction Biography strip layout — 4 columns by archive `factionType`, with
 * Overwatch Branches as a labeled subgroup under Major Player (not its own column).
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
} from '../../Data-Archive/archive-category-factions/ArchiveFactionOrdering.js';

/** Left → right: four primary archive types (Overwatch Branches nest under Major Player). */
export const FACTION_BIOGRAPHY_TYPE_ORDER = Object.freeze([
    'Major Player',
    'Criminal Groups',
    'Military Initiatives',
    'Research Institutions',
]);

/** @type {Readonly<Record<string, { top: readonly string[], bottom: readonly string[] }>>} */
export const FACTION_BIOGRAPHY_SUBROW_LAYOUT = Object.freeze({
    'Major Player': {
        top: Object.freeze(['__major__']),
        bottom: Object.freeze(['Overwatch Branches']),
    },
    'Criminal Groups': {
        top: Object.freeze(['__rowTop__']),
        bottom: Object.freeze(['__rowBottom__']),
    },
    'Military Initiatives': {
        top: Object.freeze(['__rowTop__']),
        bottom: Object.freeze(['__rowBottom__']),
    },
    'Research Institutions': {
        top: Object.freeze(['__rowTop__']),
        bottom: Object.freeze(['__rowBottom__']),
    },
});

/** @param {string} typeLabel */
function factionTypeUsesSplitChipRows(typeLabel) {
    return typeLabel !== 'Major Player';
}

const OVERWATCH_BRANCHES_TYPE = 'Overwatch Branches';

/**
 * @param {string} subgroupKey
 * @returns {string}
 */
export function labelForFactionBiographySubgroup(subgroupKey) {
    if (
        subgroupKey === '__major__'
        || subgroupKey === '__rowTop__'
        || subgroupKey === '__rowBottom__'
    ) {
        return '';
    }
    return subgroupKey;
}

/**
 * @param {string} factionType
 * @returns {{ column: string, subgroup: string }}
 */
export function resolveFactionBiographyColumnAndSubgroup(factionType) {
    const normalized = normalizeFactionArchiveType(factionType);
    if (normalized === OVERWATCH_BRANCHES_TYPE) {
        return { column: 'Major Player', subgroup: OVERWATCH_BRANCHES_TYPE };
    }
    if (normalized === 'Major Player') {
        return { column: 'Major Player', subgroup: '__major__' };
    }
    if (FACTION_BIOGRAPHY_TYPE_ORDER.includes(normalized)) {
        return {
            column: normalized,
            subgroup: factionTypeUsesSplitChipRows(normalized) ? '__pending__' : '__rowTop__',
        };
    }
    if (!normalized) {
        return { column: 'Major Player', subgroup: '__major__' };
    }
    return { column: 'Major Player', subgroup: '__major__' };
}

/**
 * @param {string} typeLabel
 * @returns {string}
 */
export function factionBiographyColumnClassSlug(typeLabel) {
    return String(typeLabel || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * @param {Array<{ filename: string, displayName?: string }>} manifestFactions
 * @returns {Promise<{
 *   groups: Record<string, Record<string, Array<{ filename: string, displayName?: string }>>>,
 *   other: Array<{ filename: string, displayName?: string }>,
 * }>}
 */
export async function buildFactionBiographyTypeGroups(manifestFactions) {
    await ensureArchiveLayoutSnapshotsForFilter('factions');

    /** @type {Record<string, Record<string, Array<{ filename: string, displayName?: string }>>>} */
    const groups = {};
    for (const typeLabel of FACTION_BIOGRAPHY_TYPE_ORDER) {
        groups[typeLabel] = {};
        const layout = FACTION_BIOGRAPHY_SUBROW_LAYOUT[typeLabel];
        const keys = [...(layout?.top || []), ...(layout?.bottom || [])];
        for (const key of keys) {
            groups[typeLabel][key] = [];
        }
        if (factionTypeUsesSplitChipRows(typeLabel)) {
            groups[typeLabel].__pending__ = [];
        }
    }

    const events = getFactionsArchiveRowsForFilterGrouping().slice();
    sortFactionsArchiveEventsStable(events);

    const usedFilenames = new Set();

    for (const ev of events) {
        const entry = matchFactionManifestToArchiveRowName(ev?.name, manifestFactions);
        if (!entry?.filename || usedFilenames.has(entry.filename)) continue;

        const { column, subgroup } = resolveFactionBiographyColumnAndSubgroup(ev?.factionType);
        if (!groups[column]) continue;

        let bucket = subgroup;
        if (factionTypeUsesSplitChipRows(column)) {
            bucket = '__pending__';
        } else if (!groups[column][bucket]) {
            bucket = '__major__';
        }

        if (!groups[column][bucket]) {
            groups[column][bucket] = [];
        }

        usedFilenames.add(entry.filename);
        groups[column][bucket].push(entry);
    }

    /** @type {Array<{ filename: string, displayName?: string }>} */
    const other = [];
    for (const f of manifestFactions) {
        if (f?.filename && !usedFilenames.has(f.filename)) {
            other.push(f);
        }
    }

    other.sort((a, b) =>
        String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
            numeric: true,
            sensitivity: 'base',
        }),
    );

    for (const typeLabel of FACTION_BIOGRAPHY_TYPE_ORDER) {
        if (factionTypeUsesSplitChipRows(typeLabel)) {
            const pending = groups[typeLabel].__pending__ || [];
            delete groups[typeLabel].__pending__;
            pending.sort((a, b) =>
                String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
            const splitAt = Math.ceil(pending.length / 2);
            groups[typeLabel].__rowTop__ = pending.slice(0, splitAt);
            groups[typeLabel].__rowBottom__ = pending.slice(splitAt);
        }

        for (const key of Object.keys(groups[typeLabel])) {
            if (key === '__pending__') continue;
            groups[typeLabel][key].sort((a, b) =>
                String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
        }
    }

    return { groups, other };
}

/**
 * @param {string} factionType
 * @returns {string}
 */
export function headingLabelForFactionBiographyColumn(factionType) {
    return displayLabelForFactionArchiveType(factionType) || factionType;
}
