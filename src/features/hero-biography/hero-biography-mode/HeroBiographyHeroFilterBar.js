/**
 * Bottom entity chip strip for Biography mode — category tabs + chips per archive type.
 */

import { FilterImageService } from '../../system-interface/interface-filter-menu/images/FilterImageLoader.js';
import { preloadFilterImages } from '../../system-interface/interface-filter-menu/images/preloadFilterImages.js';
import { FILTER_IMAGE_PATHS } from '../../system-interface/interface-filter-menu/images/filterImagePaths.js';
import {
    BIO_BIOGRAPHY_ARCHIVE_CATEGORIES,
    BIO_BIOGRAPHY_CATEGORY_ARIA,
    BIO_BIOGRAPHY_CATEGORY_LABELS,
    normalizeBioBiographyCategory,
} from './bioBiographyCategories.js';
import { createBioBiographyChip } from './createBioBiographyChip.js';
import {
    clearBioBiographyChipSelectionForCategoryChange,
    destroyHeroBiographySelection,
    initHeroBiographySelection,
} from './heroBiographySelection.js';
import { loadBioFilterManifestEntries } from './loadBioFilterManifest.js';
import {
    buildFactionBiographyTypeGroups,
    FACTION_BIOGRAPHY_SUBROW_LAYOUT,
    FACTION_BIOGRAPHY_TYPE_ORDER,
    factionBiographyColumnClassSlug,
    headingLabelForFactionBiographyColumn,
    labelForFactionBiographySubgroup,
} from './heroBiographyFactionLayout.js';
import {
    buildHeroBiographyRoleGroups,
    HERO_BIOGRAPHY_ROLE_ORDER,
    HERO_BIOGRAPHY_SUBROLE_ROWS,
    labelForHeroBiographySubrole,
} from './heroBiographyRoleLayout.js';
import {
    buildNpcBiographyFlatChipRowSegments,
    labelForNpcBiographyCategory,
} from './heroBiographyNpcLayout.js';
import {
    bindHeroBiographyChipStrip,
    mountHeroBiographyChipStripToggle,
    unmountHeroBiographyChipStripControls,
} from './heroBiographyChipStripVisibility.js';

/** @type {FilterImageService | null} */
let sessionImageService = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let activeCategory = 'heroes';

/** @type {HTMLElement | null} */
let chipsContentEl = null;

function getSoundManager() {
    return typeof window !== 'undefined' ? window.SoundEffectsManager : null;
}

/**
 * @param {HTMLElement} chipsRow
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {Array<string|{ filename: string, displayName: string }>} items
 */
function appendEntityChips(chipsRow, category, items) {
    if (!sessionImageService || !items?.length) return;
    const soundManager = getSoundManager();
    for (const item of items) {
        const wrap = createBioBiographyChip(category, item, sessionImageService, soundManager);
        wrap.setAttribute('role', 'listitem');
        chipsRow.appendChild(wrap);
    }
}

/**
 * Subgroup caption with horizontal rules that break for the text (heroes / factions / NPCs).
 * @param {string} labelText
 * @param {string} [extraClass]
 * @returns {HTMLElement}
 */
function buildSubgroupLabelWithLines(labelText, extraClass = '') {
    const label = document.createElement('div');
    label.className = 'hero-biography-hero-filters__subrole-label';
    if (extraClass) label.classList.add(extraClass);
    if (!labelText) {
        label.classList.add('hero-biography-hero-filters__subrole-label--hidden');
        return label;
    }

    const lineStart = document.createElement('span');
    lineStart.className = 'hero-biography-hero-filters__subrole-label-line';
    lineStart.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'hero-biography-hero-filters__subrole-label-text';
    text.textContent = labelText;

    const lineEnd = document.createElement('span');
    lineEnd.className = 'hero-biography-hero-filters__subrole-label-line';
    lineEnd.setAttribute('aria-hidden', 'true');

    label.append(lineStart, text, lineEnd);
    return label;
}

/**
 * @param {string} subgroupKey
 * @param {string} labelText
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {Array<string|{ filename: string, displayName: string }>} items
 * @returns {HTMLElement}
 */
function buildSubgroupChipGroup(subgroupKey, labelText, category, items) {
    const group = document.createElement('div');
    group.className = 'hero-biography-hero-filters__subrole-group';
    const count = items.length;
    group.style.setProperty('--hero-count', String(count));

    const label = buildSubgroupLabelWithLines(labelText);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'hero-biography-hero-filters__chips-row';
    chipsRow.style.setProperty('--chip-count', String(count));
    chipsRow.setAttribute('role', 'list');
    appendEntityChips(chipsRow, category, items);

    group.appendChild(chipsRow);
    group.appendChild(label);
    return group;
}

/**
 * @param {string} subrole
 * @param {string[]} heroIds
 * @returns {HTMLElement}
 */
function buildSubroleGroup(subrole, heroIds) {
    return buildSubgroupChipGroup(
        subrole,
        labelForHeroBiographySubrole(subrole),
        'heroes',
        heroIds,
    );
}

/**
 * @param {'top'|'bottom'} rowKey
 * @param {string} role
 * @param {Record<string, string[]>} roleGroup
 * @returns {HTMLElement | null}
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
 * @param {'top'|'bottom'} rowKey
 * @param {string} typeLabel
 * @param {Record<string, Array<{ filename: string, displayName?: string }>>} typeGroup
 * @returns {HTMLElement | null}
 */
function buildFactionSubroleRow(rowKey, typeLabel, typeGroup) {
    const row = document.createElement('div');
    row.className = `hero-biography-hero-filters__subrow hero-biography-hero-filters__subrow--${rowKey}`;

    const subgroups = FACTION_BIOGRAPHY_SUBROW_LAYOUT[typeLabel][rowKey];
    for (const subgroupKey of subgroups) {
        const entries = typeGroup[subgroupKey] || [];
        if (entries.length === 0) continue;
        row.appendChild(
            buildSubgroupChipGroup(
                subgroupKey,
                labelForFactionBiographySubgroup(subgroupKey),
                'factions',
                entries,
            ),
        );
    }

    return row.childElementCount > 0 ? row : null;
}

/**
 * @param {string} typeLabel
 * @param {Record<string, Array<{ filename: string, displayName?: string }>>} typeGroup
 * @returns {HTMLElement}
 */
function buildFactionTypeColumn(typeLabel, typeGroup) {
    const slug = factionBiographyColumnClassSlug(typeLabel);
    const column = document.createElement('section');
    column.className = `hero-biography-hero-filters__role-column hero-biography-hero-filters__role-column--${slug}`;
    column.setAttribute('aria-label', typeLabel);

    const heading = document.createElement('h3');
    heading.className = 'hero-biography-hero-filters__role-heading';
    heading.textContent = headingLabelForFactionBiographyColumn(typeLabel);

    column.appendChild(heading);

    const topRow = buildFactionSubroleRow('top', typeLabel, typeGroup);
    const bottomRow = buildFactionSubroleRow('bottom', typeLabel, typeGroup);
    if (topRow) column.appendChild(topRow);
    if (bottomRow) column.appendChild(bottomRow);

    return column;
}

/**
 * @param {HTMLElement} container
 */
async function renderHeroRoleLayout(container) {
    const manifestHeroes = await loadBioFilterManifestEntries('heroes');
    const roleGroups = await buildHeroBiographyRoleGroups(manifestHeroes);

    const rolesRow = document.createElement('div');
    rolesRow.className = 'hero-biography-hero-filters__roles';

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        rolesRow.appendChild(buildRoleColumn(role, roleGroups[role]));
    }

    container.appendChild(rolesRow);
    preloadFilterImages(manifestHeroes, 'heroes', FILTER_IMAGE_PATHS.HEROES);
}

/**
 * @param {HTMLElement} container
 */
async function renderFactionTypeLayout(container) {
    const manifestFactions = await loadBioFilterManifestEntries('factions');
    const { groups, other } = await buildFactionBiographyTypeGroups(manifestFactions);

    const typesRow = document.createElement('div');
    typesRow.className =
        'hero-biography-hero-filters__roles hero-biography-hero-filters__roles--factions';

    for (const typeLabel of FACTION_BIOGRAPHY_TYPE_ORDER) {
        typesRow.appendChild(buildFactionTypeColumn(typeLabel, groups[typeLabel]));
    }

    container.appendChild(typesRow);

    if (other.length > 0) {
        const otherWrap = document.createElement('div');
        otherWrap.className = 'hero-biography-hero-filters__faction-other';
        const otherLabel = buildSubgroupLabelWithLines(
            'Other',
            'hero-biography-hero-filters__faction-other-label',
        );
        const chipsRow = document.createElement('div');
        chipsRow.className =
            'hero-biography-hero-filters__chips-row hero-biography-hero-filters__chips-row--flat';
        chipsRow.setAttribute('role', 'list');
        appendEntityChips(chipsRow, 'factions', other);
        otherWrap.append(otherLabel, chipsRow);
        container.appendChild(otherWrap);
    }

    preloadFilterImages(manifestFactions, 'factions', FILTER_IMAGE_PATHS.FACTIONS);
}

/**
 * @param {import('./heroBiographyNpcLayout.js').NpcBiographyChipSegment[]} segments
 * @param {string} ariaLabel
 * @returns {HTMLElement | null}
 */
function buildNpcFlatBiographyRow(segments, ariaLabel) {
    const row = document.createElement('div');
    row.className = 'hero-biography-hero-filters__npc-flat-row';
    row.setAttribute('aria-label', ariaLabel);

    for (const segment of segments) {
        if (!segment.chips?.length) continue;
        row.appendChild(
            buildSubgroupChipGroup(
                segment.category,
                labelForNpcBiographyCategory(segment.category),
                'npcs',
                segment.chips,
            ),
        );
    }

    return row.childElementCount > 0 ? row : null;
}

/**
 * @param {HTMLElement} container
 */
async function renderNpcCategoryLayout(container) {
    const manifestNpcs = await loadBioFilterManifestEntries('npcs');
    const { top, bottom } = await buildNpcBiographyFlatChipRowSegments(manifestNpcs);

    const flat = document.createElement('div');
    flat.className = 'hero-biography-hero-filters__npc-flat';
    flat.setAttribute('aria-label', 'NPCs');

    const topRow = buildNpcFlatBiographyRow(top, 'NPCs row 1');
    const bottomRow = buildNpcFlatBiographyRow(bottom, 'NPCs row 2');
    if (topRow) flat.appendChild(topRow);
    if (bottomRow) flat.appendChild(bottomRow);

    container.appendChild(flat);

    preloadFilterImages(manifestNpcs, 'npcs', FILTER_IMAGE_PATHS.NPCS);
}

/**
 * @param {HTMLElement} container
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function renderFlatChipGrid(container, category) {
    const cat = normalizeBioBiographyCategory(category);
    const items = await loadBioFilterManifestEntries(cat);

    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'hero-biography-hero-filters__category-empty';
        empty.textContent =
            cat === 'locations'
                ? 'Location biographies are not available yet.'
                : `No ${BIO_BIOGRAPHY_CATEGORY_LABELS[cat].toLowerCase()} in the manifest.`;
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'hero-biography-hero-filters__flat-grid';
    grid.setAttribute('role', 'list');
    grid.setAttribute('aria-label', BIO_BIOGRAPHY_CATEGORY_LABELS[cat]);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'hero-biography-hero-filters__chips-row hero-biography-hero-filters__chips-row--flat';
    chipsRow.style.setProperty('--chip-count', String(items.length));
    appendEntityChips(chipsRow, cat, items);
    grid.appendChild(chipsRow);
    container.appendChild(grid);

    const folder =
        cat === 'factions'
            ? FILTER_IMAGE_PATHS.FACTIONS
            : cat === 'npcs'
                ? FILTER_IMAGE_PATHS.NPCS
                : FILTER_IMAGE_PATHS.HEROES;
    const filterType = cat === 'factions' ? 'factions' : cat === 'npcs' ? 'npcs' : 'heroes';
    preloadFilterImages(items, filterType, folder);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function renderCategoryChips(category) {
    if (!chipsContentEl) return;
    chipsContentEl.replaceChildren();

    const cat = normalizeBioBiographyCategory(category);
    if (cat === 'heroes') {
        await renderHeroRoleLayout(chipsContentEl);
        return;
    }
    if (cat === 'factions') {
        await renderFactionTypeLayout(chipsContentEl);
        return;
    }
    if (cat === 'npcs') {
        await renderNpcCategoryLayout(chipsContentEl);
        return;
    }
    await renderFlatChipGrid(chipsContentEl, cat);
}

/**
 * @param {HTMLElement} categoryRow
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
function setActiveCategoryTab(categoryRow, category) {
    const cat = normalizeBioBiographyCategory(category);
    activeCategory = cat;
    categoryRow.querySelectorAll('.hero-biography-hero-filters__category-chip').forEach((btn) => {
        const isActive = btn.dataset.bioCategory === cat;
        btn.classList.toggle('hero-biography-hero-filters__category-chip--active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

/**
 * @param {HTMLElement} host
 * @param {HTMLElement} mainEl
 */
export async function mountHeroBiographyHeroFilterBar(host, mainEl) {
    unmountHeroBiographyHeroFilterBar();

    sessionImageService = new FilterImageService();
    initHeroBiographySelection(host, mainEl);
    activeCategory = 'heroes';

    const strip = document.createElement('div');
    strip.className = 'hero-biography-hero-filters';
    strip.setAttribute('aria-label', 'Biography archive entity selection');

    const categoryRow = document.createElement('div');
    categoryRow.className = 'hero-biography-hero-filters__category-row';
    categoryRow.setAttribute('role', 'tablist');
    categoryRow.setAttribute('aria-label', 'Archive category');

    for (const cat of BIO_BIOGRAPHY_ARCHIVE_CATEGORIES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hero-biography-hero-filters__category-chip';
        btn.dataset.bioCategory = cat;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', cat === activeCategory ? 'true' : 'false');
        btn.setAttribute('aria-label', BIO_BIOGRAPHY_CATEGORY_ARIA[cat]);
        btn.textContent = BIO_BIOGRAPHY_CATEGORY_LABELS[cat];
        btn.addEventListener('click', () => {
            const nextCat = normalizeBioBiographyCategory(btn.dataset.bioCategory);
            if (nextCat === activeCategory) return;
            clearBioBiographyChipSelectionForCategoryChange();
            setActiveCategoryTab(categoryRow, nextCat);
            void renderCategoryChips(nextCat);
            getSoundManager()?.play?.('filterPick');
        });
        categoryRow.appendChild(btn);
    }

    chipsContentEl = document.createElement('div');
    chipsContentEl.className = 'hero-biography-hero-filters__content';

    strip.appendChild(categoryRow);
    strip.appendChild(chipsContentEl);
    host.appendChild(strip);
    host._heroBiographyFilterStrip = strip;
    host._heroBiographyActiveCategory = activeCategory;

    setActiveCategoryTab(categoryRow, activeCategory);
    await renderCategoryChips(activeCategory);

    bindHeroBiographyChipStrip(host, strip);
    mountHeroBiographyChipStripToggle();
}

export function unmountHeroBiographyHeroFilterBar() {
    const host = document.getElementById('atlasHeroBiographyHost');
    host?._heroBiographyFilterStrip?.remove();
    if (host) {
        delete host._heroBiographyFilterStrip;
        delete host._heroBiographyActiveCategory;
    }
    chipsContentEl = null;
    unmountHeroBiographyChipStripControls();
    destroyHeroBiographySelection();
    sessionImageService = null;
    activeCategory = 'heroes';
}
