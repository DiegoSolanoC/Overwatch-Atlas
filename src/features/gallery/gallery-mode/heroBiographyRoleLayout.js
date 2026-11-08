/**
 * Hero Biography strip layout — role / subrole grouping from heroes-archive.
 * Gallery Select File: Tank | Damage | Support | Unassigned columns; the filters
 * panel uses role bands (same packing as factions / NPCs).
 */

import {
    getHeroDisplayName,
    matchHeroManifestToArchiveRowName,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import {
    ensureArchiveLayoutSnapshotsForFilter,
    getHeroesArchiveRowsForFilterGrouping,
} from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';
import { normalizeHeroArchiveSubrole } from '../../data-workshop/archive-category-heroes/ArchiveHeroSubroles.js';
import { normalizeHeroArchiveRole } from '../../data-workshop/archive-category-heroes/ArchiveHeroRoles.js';

/** Left → right columns (Gallery Select File) */
export const HERO_BIOGRAPHY_ROLE_ORDER = Object.freeze([
    'Tank',
    'Damage',
    'Support',
    'Unassigned',
]);

/**
 * Subrole rows per role (matches filter-panel archive order; Support uses
 * "Strategist" label for archive `Tactician`). Unassigned is a fourth band
 * for promoted / uncategorized heroes (no Tank/Damage/Support role yet).
 */
export const HERO_BIOGRAPHY_SUBROLE_ROWS = Object.freeze({
    Tank: {
        top: Object.freeze(['Initiator', 'Bruiser']),
        bottom: Object.freeze(['Stalwart']),
    },
    Damage: {
        top: Object.freeze(['Flanker', 'Recon']),
        bottom: Object.freeze(['Specialist', 'Sharpshooter']),
    },
    Support: {
        top: Object.freeze(['Tactician', 'Medic']),
        bottom: Object.freeze(['Survivor', 'Unassigned']),
    },
    Unassigned: {
        top: Object.freeze(['Unassigned']),
        bottom: Object.freeze([]),
    },
});

/**
 * Flat-board segment order (Tank → Damage → Support, top then bottom subroles).
 * Whole subrole groups only — never split across rows.
 * Note: Support's Unassigned subrole and the Unassigned role both use key
 * `Unassigned`; flatten prefers role-band layout over this flat map.
 */
export const HERO_BIOGRAPHY_SUBROLE_SEGMENT_ORDER = Object.freeze([
    'Initiator',
    'Bruiser',
    'Stalwart',
    'Flanker',
    'Recon',
    'Specialist',
    'Sharpshooter',
    'Tactician',
    'Medic',
    'Survivor',
    'Unassigned',
]);

/** Preferred top-row chip budget before whole subrole segments wrap to row 2. */
export const HERO_BIOGRAPHY_TOP_ROW_CHIP_COUNT = 22;

/** @typedef {{ key: string, label: string, chips: string[] }} HeroBiographyChipSegment */

/** @type {Record<string, string>} */
export const HERO_BIOGRAPHY_SUBROLE_LABELS = Object.freeze({
    Tactician: 'Strategist',
    Unassigned: 'Unassigned',
});

/**
 * @param {string} subrole
 * @returns {string}
 */
export function labelForHeroBiographySubrole(subrole) {
    return HERO_BIOGRAPHY_SUBROLE_LABELS[subrole] || subrole;
}

/**
 * @param {Record<string, string[]>} flatGroups subrole → hero ids
 * @param {readonly string[]} segmentOrder
 * @returns {{ top: HeroBiographyChipSegment[], bottom: HeroBiographyChipSegment[] }}
 */
export function assignHeroBiographySubroleRows(flatGroups, segmentOrder) {
    /** @type {HeroBiographyChipSegment[]} */
    const top = [];
    /** @type {HeroBiographyChipSegment[]} */
    const bottom = [];
    let topCount = 0;
    const topLimit = HERO_BIOGRAPHY_TOP_ROW_CHIP_COUNT;

    for (const key of segmentOrder) {
        const chips = flatGroups[key];
        if (!Array.isArray(chips) || chips.length === 0) continue;

        const segment = {
            key,
            label: labelForHeroBiographySubrole(key),
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
 * Resolve archive row → filter board role/subrole bucket.
 * Empty / unknown roles land in the fourth Unassigned band.
 * @param {object|null|undefined} ev
 * @returns {{ role: string, sub: string }}
 */
export function resolveHeroBiographyRoleBucket(ev) {
    let role = normalizeHeroArchiveRole(ev?.heroRole);
    let sub = normalizeHeroArchiveSubrole(ev?.heroSubRole);

    /* Fourth band only when there is no Tank/Damage/Support role yet. */
    if (!role || role === 'Unassigned') {
        return { role: 'Unassigned', sub: 'Unassigned' };
    }
    if (!HERO_BIOGRAPHY_ROLE_ORDER.includes(role) || role === 'Unassigned') {
        return { role: 'Unassigned', sub: 'Unassigned' };
    }
    if (!sub && role === 'Support') sub = 'Unassigned';
    const layout = HERO_BIOGRAPHY_SUBROLE_ROWS[role];
    const known = layout ? [...layout.top, ...layout.bottom] : [];
    if (sub && known.includes(sub)) {
        return { role, sub };
    }
    /* Keep real roles in-band: Support overflow → Unassigned; others keep first known sub. */
    if (role === 'Support') return { role: 'Support', sub: 'Unassigned' };
    return { role, sub: known[0] || 'Unassigned' };
}

/**
 * @param {string[]} manifestHeroes
 * @returns {Promise<Record<string, Record<string, string[]>>>}
 */
export async function buildHeroBiographyRoleGroups(manifestHeroes) {
    await ensureArchiveLayoutSnapshotsForFilter('heroes');

    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const events = getHeroesArchiveRowsForFilterGrouping();

    /** @type {Record<string, Record<string, string[]>>} */
    const groups = {};

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        groups[role] = {};
        const layout = HERO_BIOGRAPHY_SUBROLE_ROWS[role];
        const allSubs = [...layout.top, ...layout.bottom];
        for (const sub of allSubs) {
            groups[role][sub] = [];
        }
    }

    const used = new Set();

    if (hro && Array.isArray(events)) {
        if (typeof hro.sortHeroesArchiveEventsStable === 'function') {
            hro.sortHeroesArchiveEventsStable(events);
        }

        for (const ev of events) {
            const heroId = matchHeroManifestToArchiveRowName(ev?.name, manifestHeroes);
            if (!heroId || used.has(heroId)) continue;

            const { role, sub } = resolveHeroBiographyRoleBucket(ev);
            used.add(heroId);
            groups[role][sub].push(heroId);
        }
    }

    for (const heroId of manifestHeroes) {
        if (!heroId || used.has(heroId)) continue;
        used.add(heroId);
        groups.Unassigned.Unassigned.push(heroId);
    }

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        for (const key of Object.keys(groups[role])) {
            groups[role][key].sort((a, b) =>
                getHeroDisplayName(a).localeCompare(getHeroDisplayName(b), undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
        }
    }

    return groups;
}

/**
 * Flatten role → subrole groups into a single subrole → heroes map.
 * @param {Record<string, Record<string, string[]>>} roleGroups
 * @returns {Record<string, string[]>}
 */
export function flattenHeroBiographyRoleGroups(roleGroups) {
    /** @type {Record<string, string[]>} */
    const flat = {};
    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        const roleGroup = roleGroups[role] || {};
        for (const subrole of HERO_BIOGRAPHY_SUBROLE_SEGMENT_ORDER) {
            const chips = roleGroup[subrole];
            if (!Array.isArray(chips) || chips.length === 0) continue;
            if (!flat[subrole]) flat[subrole] = [];
            /* Keep Support Unassigned and role-Unassigned chips distinct in flat maps
             * by appending — callers that need bands should use role groups. */
            flat[subrole] = flat[subrole].concat(chips);
        }
    }
    return flat;
}

/**
 * Filters-panel / flat-board packing: labeled subrole segments in two rows.
 * @param {string[]} manifestHeroes
 * @returns {Promise<{ top: HeroBiographyChipSegment[], bottom: HeroBiographyChipSegment[] }>}
 */
export async function buildHeroBiographyFlatChipRowSegments(manifestHeroes) {
    const roleGroups = await buildHeroBiographyRoleGroups(manifestHeroes);
    const flatGroups = flattenHeroBiographyRoleGroups(roleGroups);
    return assignHeroBiographySubroleRows(flatGroups, HERO_BIOGRAPHY_SUBROLE_SEGMENT_ORDER);
}
