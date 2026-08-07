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
import { STRIP_CATEGORY_ICONS } from '../../data-workshop/archive-category-shared/ArchiveCategoryTypes.js';
import { createBioBiographyChip } from './createBioBiographyChip.js';
import {
    clearBioBiographyChipSelectionForCategoryChange,
    destroyHeroBiographySelection,
    initHeroBiographySelection,
} from './heroBiographySelection.js';
import { loadBioFilterManifestEntries } from './loadBioFilterManifest.js';
import {
    buildFactionBiographyFlatChipRowSegments,
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
import { configureHeroBiographyArchiveIoBar } from './heroBiographyArchiveIoBar.js';

/** @type {FilterImageService | null} */
let sessionImageService = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let activeCategory = 'heroes';

/**
 * @returns {import('./bioBiographyCategories.js').BioBiographyArchiveCategory}
 */
export function getHeroBiographyActiveCategory() {
    return activeCategory;
}

/**
 * Re-render chip strip after archive import (when category matches active tab).
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
export async function refreshHeroBiographyCategoryChipsIfActive(category) {
    if (normalizeBioBiographyCategory(category) !== activeCategory) return;
    await renderCategoryChips(activeCategory);
}

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
 * Empty labels still reserve the label band so every category board keeps the same height.
 * @param {string} labelText
 * @param {string} [extraClass]
 * @returns {HTMLElement}
 */
function buildSubgroupLabelWithLines(labelText, extraClass = '') {
    const label = document.createElement('div');
    label.className = 'gallery-hero-filters__subrole-label';
    if (extraClass) label.classList.add(extraClass);
    if (!labelText) {
        label.classList.add('gallery-hero-filters__subrole-label--hidden');
        label.setAttribute('aria-hidden', 'true');
        return label;
    }

    const lineStart = document.createElement('span');
    lineStart.className = 'gallery-hero-filters__subrole-label-line';
    lineStart.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'gallery-hero-filters__subrole-label-text';
    text.textContent = labelText;

    const lineEnd = document.createElement('span');
    lineEnd.className = 'gallery-hero-filters__subrole-label-line';
    lineEnd.setAttribute('aria-hidden', 'true');

    label.append(lineStart, text, lineEnd);
    return label;
}

/**
 * Shared Select File board chrome — heading band + body (columns or flat rows).
 * @param {'columns'|'flat'} variant
 * @param {string} ariaLabel
 * @returns {{ board: HTMLElement, body: HTMLElement }}
 */
function buildFilterBoard(variant, ariaLabel) {
    const board = document.createElement('div');
    board.className = `gallery-hero-filters__board gallery-hero-filters__board--${variant}`;
    board.setAttribute('aria-label', ariaLabel);

    if (variant === 'flat') {
        const heading = document.createElement('div');
        heading.className =
            'gallery-hero-filters__role-heading gallery-hero-filters__role-heading--spacer';
        heading.setAttribute('aria-hidden', 'true');
        heading.textContent = '\u00a0';
        board.appendChild(heading);
    }

    const body = document.createElement('div');
    body.className =
        variant === 'columns'
            ? 'gallery-hero-filters__roles'
            : 'gallery-hero-filters__board-rows';
    board.appendChild(body);
    return { board, body };
}

/**
 * Flat board subrow (NPCs / Locations) — same subgroup + label pattern as hero columns.
 * @param {'top'|'bottom'} rowKey
 * @param {Array<{ key: string, label: string, items: Array<string|{ filename: string, displayName?: string }> }>} segments
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @returns {HTMLElement | null}
 */
function buildBandedFlatSubrow(rowKey, segments, category) {
    const row = document.createElement('div');
    row.className = `gallery-hero-filters__subrow gallery-hero-filters__subrow--${rowKey}`;

    for (const segment of segments) {
        if (!segment.items?.length) continue;
        row.appendChild(
            buildSubgroupChipGroup(segment.key, segment.label, category, segment.items),
        );
    }

    return row.childElementCount > 0 ? row : null;
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
    group.className = 'gallery-hero-filters__subrole-group';
    const count = items.length;
    group.style.setProperty('--hero-count', String(count));

    const label = buildSubgroupLabelWithLines(labelText);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'gallery-hero-filters__chips-row';
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
    row.className = `gallery-hero-filters__subrow gallery-hero-filters__subrow--${rowKey}`;

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
    column.className = `gallery-hero-filters__role-column gallery-hero-filters__role-column--${role.toLowerCase()}`;
    column.setAttribute('aria-label', role);

    const heading = document.createElement('h3');
    heading.className = 'gallery-hero-filters__role-heading';
    heading.textContent = role;

    column.appendChild(heading);

    const topRow = buildSubroleRow('top', role, roleGroup);
    const bottomRow = buildSubroleRow('bottom', role, roleGroup);
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

    const { board, body: rolesRow } = buildFilterBoard('columns', 'Heroes');

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        rolesRow.appendChild(buildRoleColumn(role, roleGroups[role]));
    }

    container.appendChild(board);
    preloadFilterImages(manifestHeroes, 'heroes', FILTER_IMAGE_PATHS.HEROES);
}

/**
 * @param {import('./heroBiographyFactionLayout.js').FactionBiographyChipSegment[]} segments
 * @returns {Array<{ key: string, label: string, items: Array<{ filename: string, displayName?: string }> }>}
 */
function factionSegmentsToBanded(segments) {
    return (segments || [])
        .filter((s) => s.chips?.length)
        .map((s) => ({
            key: s.key,
            label: s.label,
            items: s.chips,
        }));
}

/**
 * Factions use the same flat two-row board as NPCs (labeled type segments).
 * @param {HTMLElement} container
 */
async function renderFactionTypeLayout(container) {
    const manifestFactions = await loadBioFilterManifestEntries('factions');
    const { top, bottom } = await buildFactionBiographyFlatChipRowSegments(manifestFactions);

    const { board, body } = buildFilterBoard('flat', 'Factions');

    const topRow = buildBandedFlatSubrow('top', factionSegmentsToBanded(top), 'factions');
    const bottomRow = buildBandedFlatSubrow('bottom', factionSegmentsToBanded(bottom), 'factions');
    if (topRow) body.appendChild(topRow);
    if (bottomRow) body.appendChild(bottomRow);

    container.appendChild(board);
    preloadFilterImages(manifestFactions, 'factions', FILTER_IMAGE_PATHS.FACTIONS);
}

/**
 * @param {import('./heroBiographyNpcLayout.js').NpcBiographyChipSegment[]} segments
 * @returns {Array<{ key: string, label: string, items: string[] }>}
 */
function npcSegmentsToBanded(segments) {
    return (segments || [])
        .filter((s) => s.chips?.length)
        .map((s) => ({
            key: s.category,
            label: labelForNpcBiographyCategory(s.category),
            items: s.chips,
        }));
}

/**
 * @param {HTMLElement} container
 */
async function renderNpcCategoryLayout(container) {
    const manifestNpcs = await loadBioFilterManifestEntries('npcs');
    const { top, bottom } = await buildNpcBiographyFlatChipRowSegments(manifestNpcs);

    const { board, body } = buildFilterBoard('flat', 'NPCs');

    const topRow = buildBandedFlatSubrow('top', npcSegmentsToBanded(top), 'npcs');
    const bottomRow = buildBandedFlatSubrow('bottom', npcSegmentsToBanded(bottom), 'npcs');
    if (topRow) body.appendChild(topRow);
    if (bottomRow) body.appendChild(bottomRow);

    container.appendChild(board);
    preloadFilterImages(manifestNpcs, 'npcs', FILTER_IMAGE_PATHS.NPCS);
}

/**
 * Locations (and fallbacks) — same flat two-row board as NPCs.
 * @param {HTMLElement} container
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function renderFlatChipGrid(container, category) {
    const cat = normalizeBioBiographyCategory(category);
    const items = await loadBioFilterManifestEntries(cat);

    if (!items.length) {
        const { board, body } = buildFilterBoard('flat', BIO_BIOGRAPHY_CATEGORY_LABELS[cat]);
        const empty = document.createElement('p');
        empty.className = 'gallery-hero-filters__category-empty';
        empty.textContent =
            cat === 'locations'
                ? 'Location biographies are not available yet.'
                : `No ${BIO_BIOGRAPHY_CATEGORY_LABELS[cat].toLowerCase()} in the manifest.`;
        body.appendChild(empty);
        container.appendChild(board);
        return;
    }

    const mid = Math.ceil(items.length / 2);
    const topItems = items.slice(0, mid);
    const bottomItems = items.slice(mid);

    const { board, body } = buildFilterBoard('flat', BIO_BIOGRAPHY_CATEGORY_LABELS[cat]);
    const topRow = buildBandedFlatSubrow(
        'top',
        topItems.length
            ? [{ key: `${cat}-top`, label: BIO_BIOGRAPHY_CATEGORY_LABELS[cat], items: topItems }]
            : [],
        cat,
    );
    const bottomRow = buildBandedFlatSubrow(
        'bottom',
        bottomItems.length
            ? [{ key: `${cat}-bottom`, label: '', items: bottomItems }]
            : [],
        cat,
    );
    if (topRow) body.appendChild(topRow);
    if (bottomRow) body.appendChild(bottomRow);
    container.appendChild(board);

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
    categoryRow.querySelectorAll('.gallery-hero-filters__category-chip').forEach((btn) => {
        const isActive = btn.dataset.bioCategory === cat;
        btn.classList.toggle('gallery-hero-filters__category-chip--active', isActive);
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
    strip.className = 'gallery-hero-filters';
    strip.setAttribute('aria-label', 'Biography archive entity selection');

    const categoryRow = document.createElement('div');
    categoryRow.className = 'gallery-hero-filters__category-row';
    categoryRow.setAttribute('role', 'tablist');
    categoryRow.setAttribute('aria-label', 'Archive category');

    for (const cat of BIO_BIOGRAPHY_ARCHIVE_CATEGORIES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gallery-hero-filters__category-chip';
        btn.dataset.bioCategory = cat;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', cat === activeCategory ? 'true' : 'false');
        btn.setAttribute('aria-label', BIO_BIOGRAPHY_CATEGORY_ARIA[cat]);

        const icon = document.createElement('img');
        icon.className = 'gallery-hero-filters__category-chip-icon';
        icon.src = STRIP_CATEGORY_ICONS[cat];
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        icon.draggable = false;

        const label = document.createElement('span');
        label.className = 'gallery-hero-filters__category-chip-label';
        label.textContent = BIO_BIOGRAPHY_CATEGORY_LABELS[cat];

        btn.append(icon, label);
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
    chipsContentEl.className = 'gallery-hero-filters__content';

    strip.appendChild(categoryRow);
    strip.appendChild(chipsContentEl);
    host.appendChild(strip);
    host._heroBiographyFilterStrip = strip;
    host._heroBiographyActiveCategory = activeCategory;

    configureHeroBiographyArchiveIoBar({
        refreshCategoryChips: refreshHeroBiographyCategoryChipsIfActive,
    });

    setActiveCategoryTab(categoryRow, activeCategory);
    await renderCategoryChips(activeCategory);

    bindHeroBiographyChipStrip(host, strip);
    mountHeroBiographyChipStripToggle();
}

export function unmountHeroBiographyHeroFilterBar() {
    const host = document.getElementById('atlasGalleryHost');
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
