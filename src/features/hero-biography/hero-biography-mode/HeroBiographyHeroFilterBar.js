/**
 * Bottom hero chip strip for Hero Biography mode — grouped by role / subrole.
 */

import { FilterImageService } from '../../system-interface/interface-filter-menu/images/FilterImageLoader.js';
import { createHeroBiographyChip } from './createHeroBiographyChip.js';
import { preloadFilterImages } from '../../system-interface/interface-filter-menu/images/preloadFilterImages.js';
import { FILTER_IMAGE_PATHS } from '../../system-interface/interface-filter-menu/images/filterImagePaths.js';
import {
    destroyHeroBiographySelection,
    initHeroBiographySelection,
} from './heroBiographySelection.js';
import { loadHeroFilterManifest } from './loadHeroFilterManifest.js';
import {
    buildHeroBiographyRoleGroups,
    HERO_BIOGRAPHY_ROLE_ORDER,
    HERO_BIOGRAPHY_SUBROLE_ROWS,
    labelForHeroBiographySubrole,
} from './heroBiographyRoleLayout.js';
import {
    bindHeroBiographyChipStrip,
    mountHeroBiographyChipStripToggle,
    unmountHeroBiographyChipStripControls,
} from './heroBiographyChipStripVisibility.js';

/** @type {FilterImageService | null} */
let sessionImageService = null;

function getSoundManager() {
    return typeof window !== 'undefined' ? window.SoundEffectsManager : null;
}

/**
 * @param {HTMLElement} chipsRow
 * @param {string[]} heroIds
 */
function appendHeroChips(chipsRow, heroIds) {
    if (!sessionImageService || !heroIds?.length) return;
    const soundManager = getSoundManager();
    for (const heroId of heroIds) {
        const wrap = createHeroBiographyChip(heroId, sessionImageService, soundManager);
        wrap.setAttribute('role', 'listitem');
        chipsRow.appendChild(wrap);
    }
}

/**
 * @param {string} subrole
 * @param {string[]} heroIds
 * @returns {HTMLElement}
 */
function buildSubroleGroup(subrole, heroIds) {
    const group = document.createElement('div');
    group.className = 'hero-biography-hero-filters__subrole-group';
    const count = heroIds.length;
    group.style.setProperty('--hero-count', String(count));

    const label = document.createElement('div');
    label.className = 'hero-biography-hero-filters__subrole-label';
    label.textContent = labelForHeroBiographySubrole(subrole);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'hero-biography-hero-filters__chips-row';
    chipsRow.style.setProperty('--chip-count', String(count));
    chipsRow.setAttribute('role', 'list');
    appendHeroChips(chipsRow, heroIds);

    group.appendChild(chipsRow);
    group.appendChild(label);
    return group;
}

/**
 * @param {'top'|'bottom'} rowKey
 * @param {string} role
 * @param {Record<string, string[]>} roleGroup
 * @returns {HTMLElement}
 */
function buildSubroleRow(rowKey, role, roleGroup) {
    const row = document.createElement('div');
    row.className = `hero-biography-hero-filters__subrow hero-biography-hero-filters__subrow--${rowKey}`;

    const subroles = HERO_BIOGRAPHY_SUBROLE_ROWS[role][rowKey];
    for (const subrole of subroles) {
        const ids = roleGroup[subrole] || [];
        if (ids.length === 0) continue;
        row.appendChild(buildSubroleGroup(subrole, ids));
    }

    return row.childElementCount > 0 ? row : null;
}

/**
 * @param {string} role
 * @param {Record<string, string[]>} roleGroup
 * @returns {HTMLElement}
 */
function buildRoleColumn(role, roleGroup) {
    const column = document.createElement('section');
    column.className = `hero-biography-hero-filters__role-column hero-biography-hero-filters__role-column--${role.toLowerCase()}`;
    column.setAttribute('aria-label', role);

    const heading = document.createElement('h3');
    heading.className = 'hero-biography-hero-filters__role-heading';
    heading.textContent = role;

    column.appendChild(heading);

    const topRow = buildSubroleRow('top', role, roleGroup);
    const bottomRow = buildSubroleRow('bottom', role, roleGroup);
    if (topRow) column.appendChild(topRow);
    if (bottomRow) column.appendChild(bottomRow);

    return column;
}

/**
 * @param {HTMLElement} host
 * @param {HTMLElement} mainEl
 */
export async function mountHeroBiographyHeroFilterBar(host, mainEl) {
    unmountHeroBiographyHeroFilterBar();

    sessionImageService = new FilterImageService();
    initHeroBiographySelection(host, mainEl);

    const manifestHeroes = await loadHeroFilterManifest();
    const roleGroups = await buildHeroBiographyRoleGroups(manifestHeroes);

    const strip = document.createElement('div');
    strip.className = 'hero-biography-hero-filters';
    strip.setAttribute('aria-label', 'Hero selection by role');

    const rolesRow = document.createElement('div');
    rolesRow.className = 'hero-biography-hero-filters__roles';

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        rolesRow.appendChild(buildRoleColumn(role, roleGroups[role]));
    }

    strip.appendChild(rolesRow);
    host.appendChild(strip);
    host._heroBiographyFilterStrip = strip;

    bindHeroBiographyChipStrip(host, strip);
    mountHeroBiographyChipStripToggle();

    preloadFilterImages(manifestHeroes, 'heroes', FILTER_IMAGE_PATHS.HEROES);
}

export function unmountHeroBiographyHeroFilterBar() {
    const host = document.getElementById('atlasHeroBiographyHost');
    host?._heroBiographyFilterStrip?.remove();
    if (host) delete host._heroBiographyFilterStrip;
    unmountHeroBiographyChipStripControls();
    destroyHeroBiographySelection();
    sessionImageService = null;
}
