/**
 * Heroes filter tab in "grouped" mode: emit a top-level role separator (e.g.
 * `Tank`, `Damage`, `Support`) followed by sub-role separators (e.g.
 * `Sustain`, `Anchor`) under each role, then the manifest hero chips.
 *
 * The same hero may appear under multiple archive rows but we only render the
 * chip once (`usedHeroIds`). Heroes missing from the archive entirely land in
 * a final "Other" bucket.
 */

import { createFilterButton } from '../createFilterButton.js';
import { matchHeroManifestToArchiveRowName } from '../filterKeyMapping.js';
import { getHeroesArchiveRowsForFilterGrouping } from './archiveLayoutSnapshots.js';

export function buildGroupedHeroArchiveFilterDom(
    items, folder, filtersGrid, stateManager, imageService, soundManager, updateFilterCounts
) {
    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const cachedButtons = [];
    filtersGrid.innerHTML = '';

    if (!hro || typeof hro.normalizeHeroArchiveRole !== 'function' ||
        !Array.isArray(items) || items.length === 0) {
        return cachedButtons;
    }

    const events = getHeroesArchiveRowsForFilterGrouping();
    if (typeof hro.sortHeroesArchiveEventsStable === 'function') {
        hro.sortHeroesArchiveEventsStable(events);
    }

    /** @type {{ roleKey: string, roleLabel: string, subKey: string, subLabel: string, heroes: string[] }[]} */
    const segments = [];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const hid = matchHeroManifestToArchiveRowName(ev?.name, items);
        if (!hid) continue;
        const roleNorm = hro.normalizeHeroArchiveRole(ev?.heroRole);
        const roleKey = `${hro.heroArchiveRoleRank(ev?.heroRole)}|${roleNorm}`;
        const subKey = `${hro.heroArchiveSubroleRank(ev?.heroSubRole, roleNorm)}|${hro.normalizeHeroArchiveSubrole(ev?.heroSubRole, roleNorm)}`;
        const last = segments[segments.length - 1];
        if (last && last.roleKey === roleKey && last.subKey === subKey) {
            if (!last.heroes.includes(hid)) last.heroes.push(hid);
        } else {
            segments.push({
                roleKey,
                roleLabel: hro.displayLabelForHeroArchiveRole(ev?.heroRole),
                subKey,
                subLabel: hro.displayLabelForHeroArchiveSubrole(ev?.heroSubRole, roleNorm),
                heroes: [hid]
            });
        }
    }

    const usedHeroIds = new Set();
    let prevRoleKey = null;
    let prevSubKey = null;
    for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        if (seg.roleKey !== prevRoleKey) {
            prevRoleKey = seg.roleKey;
            prevSubKey = null;
            const sep = document.createElement('div');
            sep.className = 'filters-grid-type-separator filters-grid-hero-role-separator';
            sep.setAttribute('role', 'separator');
            sep.setAttribute('aria-label', seg.roleLabel);
            sep.textContent = seg.roleLabel;
            filtersGrid.appendChild(sep);
            cachedButtons.push(sep);
        }
        if (seg.subKey !== prevSubKey) {
            prevSubKey = seg.subKey;
            const subSep = document.createElement('div');
            subSep.className = 'filters-grid-hero-subrole-separator';
            subSep.setAttribute('role', 'separator');
            subSep.setAttribute('aria-label', seg.subLabel);
            subSep.textContent = seg.subLabel;
            filtersGrid.appendChild(subSep);
            cachedButtons.push(subSep);
        }
        for (let h = 0; h < seg.heroes.length; h++) {
            const heroId = seg.heroes[h];
            usedHeroIds.add(heroId);
            const btn = createFilterButton(heroId, 'heroes', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        }
    }

    /* Manifest heroes never seen in any archive row -> "Other" bucket. */
    const rest = items.filter(id => id && !usedHeroIds.has(id));
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'filters-grid-type-separator';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-label', 'Other');
        sep.textContent = 'Other';
        filtersGrid.appendChild(sep);
        cachedButtons.push(sep);
        rest.forEach(heroId => {
            const btn = createFilterButton(heroId, 'heroes', folder, stateManager, imageService, soundManager, updateFilterCounts);
            filtersGrid.appendChild(btn);
            cachedButtons.push(btn);
        });
    }

    return cachedButtons;
}
