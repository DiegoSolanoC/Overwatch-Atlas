/**
 * Hero Biography strip layout — mirrors heroes-archive role / subrole grouping
 * (see filters `buildGroupedHeroDom.js`) in a 3-column Tank | Damage | Support grid.
 */

import {
    getHeroDisplayName,
    matchHeroManifestToArchiveRowName,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import {
    ensureArchiveLayoutSnapshotsForFilter,
    getHeroesArchiveRowsForFilterGrouping,
} from '../../system-interface/interface-filter-menu/buttons/archive-layouts/archiveLayoutSnapshots.js';
import { normalizeHeroArchiveSubrole } from '../../Data-Archive/archive-category-heroes/ArchiveHeroSubroles.js';
import { normalizeHeroArchiveRole } from '../../Data-Archive/archive-category-heroes/ArchiveHeroRoles.js';

/** Left → right columns */
export const HERO_BIOGRAPHY_ROLE_ORDER = Object.freeze(['Tank', 'Damage', 'Support']);

/**
 * Subrole rows per role (matches filter-panel archive order; Support uses
 * "Strategist" label for archive `Tactician`).
 */
export const HERO_BIOGRAPHY_SUBROLE_ROWS = Object.freeze({
    Tank: {
        top: Object.freeze(['Initiator', 'Bruiser']),
        bottom: Object.freeze(['Stalwart']),
    },
    Damage: {
        top: Object.freeze(['Specialist', 'Sharpshooter']),
        bottom: Object.freeze(['Flanker', 'Recon']),
    },
    Support: {
        top: Object.freeze(['Tactician', 'Medic']),
        bottom: Object.freeze(['Survivor']),
    },
});

/** @type {Record<string, string>} */
export const HERO_BIOGRAPHY_SUBROLE_LABELS = Object.freeze({
    Tactician: 'Strategist',
});

/**
 * @param {string} subrole
 * @returns {string}
 */
export function labelForHeroBiographySubrole(subrole) {
    return HERO_BIOGRAPHY_SUBROLE_LABELS[subrole] || subrole;
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
    const groups = {
        Tank: {},
        Damage: {},
        Support: {},
    };

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
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

            const role = normalizeHeroArchiveRole(ev?.heroRole);
            if (!HERO_BIOGRAPHY_ROLE_ORDER.includes(role)) continue;

            const sub = normalizeHeroArchiveSubrole(ev?.heroSubRole);
            used.add(heroId);

            if (groups[role][sub]) {
                groups[role][sub].push(heroId);
            }
            /* Unknown subrole or manifest-only placeholders: omitted from bio strip for now. */
        }
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
