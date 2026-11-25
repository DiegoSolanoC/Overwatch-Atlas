/**
 * Intel entity picker — Heroes | Factions | NPCs.
 * Heroes: shared hero-role board (Chatters visuals + stage shell).
 * Factions/NPCs: same card chrome; width measured from a live Heroes card.
 */

import {
    buildHeroRoleSelectBoard,
    wrapHeroRoleSelectStage,
} from '../../shared/hero-role-select/buildHeroRoleSelectBoard.js';
import { heroFilterIconUrl } from '../../dialogue-theater/data/loadDialogueTheaterAssets.js';
import {
    loadBioFilterManifestEntries,
    resolveBioManifestChipIdentity,
} from './loadBioFilterManifest.js';
import {
    clearBioBiographyEntityFromFilter,
    selectBioBiographyEntityFromFilter,
} from './heroBiographySelection.js';
import { buildFactionBiographyFlatChipRowSegments } from './heroBiographyFactionLayout.js';
import {
    buildNpcBiographyFlatChipRowSegments,
    labelForNpcBiographyCategory,
} from './heroBiographyNpcLayout.js';
import { getHeroDisplayName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import {
    FILTER_IMAGE_PATHS,
    buildFilterImagePath,
} from '../../system-interface/interface-filter-menu/images/filterImagePaths.js';
import { buildFactionFilterImagePath } from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';

function syncDockFlanks() {
    void import('./intelDockFlankControls.js')
        .then((m) => m.syncIntelDockFlankControls?.())
        .catch(() => {});
}

const HOST_ID = 'atlasGalleryHost';

/** @type {HTMLElement | null} */
let rootEl = null;

/** @type {number} */
let renderToken = 0;

/** @type {ResizeObserver | null} */
let cardSizeObserver = null;

/** @type {(() => void) | null} */
let syncCardSize = null;

/**
 * @returns {HTMLElement | null}
 */
function getHost() {
    return document.getElementById(HOST_ID);
}

/**
 * @param {'factions'|'npcs'} kind
 * @param {string} filterKey
 * @returns {string}
 */
function entityIconUrl(kind, filterKey) {
    const key = String(filterKey || '').trim();
    if (!key) return '';
    if (kind === 'factions') {
        return buildFactionFilterImagePath({ filename: key }, FILTER_IMAGE_PATHS.FACTIONS);
    }
    return buildFilterImagePath(key, 'npcs', FILTER_IMAGE_PATHS.NPCS);
}

/**
 * @param {object} opts
 * @param {'factions'|'npcs'} opts.kind
 * @param {string} opts.filterKey
 * @param {string} opts.displayName
 * @param {(kind: string, filterKey: string, displayName: string) => void} opts.onSelect
 * @returns {HTMLButtonElement}
 */
function buildStackedCard({ kind, filterKey, displayName, onSelect }) {
    const label = displayName || filterKey;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chatters-hero-card';
    btn.dataset.kind = kind;
    btn.dataset.filterKey = filterKey;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `${label} intel`);
    btn.title = label;

    const portrait = document.createElement('span');
    portrait.className = 'chatters-hero-card__portrait';
    const img = document.createElement('img');
    img.className = 'chatters-hero-card__img';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const src = entityIconUrl(kind, filterKey);
    if (src) img.src = src;
    else portrait.classList.add('chatters-hero-card__portrait--empty');
    portrait.appendChild(img);

    const name = document.createElement('span');
    name.className = 'chatters-hero-card__name';
    name.textContent = label;

    btn.append(portrait, name);
    btn.addEventListener('click', () => onSelect(kind, filterKey, label));
    return btn;
}

/**
 * Filters-style subgroup: cards strip + label under (hugs content, shares a row).
 * @param {string} key
 * @param {string} labelText
 * @param {HTMLElement[]} cards
 * @returns {HTMLElement}
 */
function buildFlatSubgroup(key, labelText, cards) {
    const group = document.createElement('div');
    group.className = 'intel-entity-select__subgroup';
    group.dataset.subgroupKey = key;
    group.setAttribute('aria-label', labelText || key);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'intel-entity-select__chips-row';
    chipsRow.setAttribute('role', 'list');
    for (const card of cards) chipsRow.appendChild(card);
    group.appendChild(chipsRow);

    const label = document.createElement('div');
    label.className = 'intel-entity-select__subgroup-label';
    const left = document.createElement('span');
    left.className = 'intel-entity-select__subgroup-label-line';
    left.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'intel-entity-select__subgroup-label-text';
    text.textContent = labelText || '';
    const right = document.createElement('span');
    right.className = 'intel-entity-select__subgroup-label-line';
    right.setAttribute('aria-hidden', 'true');
    label.append(left, text, right);
    group.appendChild(label);

    return group;
}

/** Intel select uses 3 shared rows (Filters stays at 2 for the chip strip). */
const INTEL_FLAT_ROW_COUNT = 3;

/**
 * @typedef {{ key?: string, category?: string, label?: string, chips: unknown[] }} IntelFlatSegment
 */

/**
 * Order-preserving pack into N rows with roughly even chip counts.
 * Never splits a category across rows (same rule as Filters).
 * @param {IntelFlatSegment[]} segments
 * @param {number} rowCount
 * @returns {IntelFlatSegment[][]}
 */
function packSegmentsIntoRows(segments, rowCount = INTEL_FLAT_ROW_COUNT) {
    const items = (segments || []).filter((s) => Array.isArray(s.chips) && s.chips.length > 0);
    if (!items.length) return [];

    const n = Math.max(1, Math.min(rowCount, items.length));
    const total = items.reduce((sum, s) => sum + s.chips.length, 0);
    /** @type {IntelFlatSegment[][]} */
    const rows = Array.from({ length: n }, () => []);
    let rowIndex = 0;
    let rowChips = 0;
    let remainingChips = total;
    let remainingRows = n;

    for (let i = 0; i < items.length; i++) {
        const seg = items[i];
        const len = seg.chips.length;
        const segsLeftAfter = items.length - i - 1;
        const rowsLeftAfter = n - rowIndex - 1;

        const mustLeaveSegsForLaterRows =
            rowIndex < n - 1 && rows[rowIndex].length > 0 && segsLeftAfter < rowsLeftAfter;

        const target = remainingChips / Math.max(1, remainingRows);
        const wouldOvershoot =
            rowIndex < n - 1 &&
            rows[rowIndex].length > 0 &&
            rowChips >= target * 0.75 &&
            rowChips + len > target * 1.2;

        if (mustLeaveSegsForLaterRows || wouldOvershoot) {
            remainingChips -= rowChips;
            remainingRows -= 1;
            rowIndex += 1;
            rowChips = 0;
        }

        rows[rowIndex].push(seg);
        rowChips += len;
    }

    return rows.filter((r) => r.length > 0);
}

/**
 * Flatten Filters top/bottom packs back into display order.
 * @param {{ top: IntelFlatSegment[], bottom: IntelFlatSegment[] }} packed
 * @returns {IntelFlatSegment[]}
 */
function flattenFilterRows(packed) {
    return [...(packed?.top || []), ...(packed?.bottom || [])];
}

/**
 * @param {string|number} rowKey
 * @returns {HTMLElement}
 */
function createFlatSubrow(rowKey) {
    const row = document.createElement('div');
    row.className = `intel-entity-select__subrow intel-entity-select__subrow--${rowKey}`;
    return row;
}

/**
 * Filters-style shared-row board, packed into balanced Intel rows.
 * @param {'factions'|'npcs'} kind
 * @param {IntelFlatSegment[][]} rows
 * @param {(kind: string, filterKey: string, displayName: string) => void} onSelect
 * @returns {HTMLElement}
 */
function buildFlatSharedRowBoard(kind, rows, onSelect) {
    const board = document.createElement('div');
    board.className = 'intel-entity-select__flat';
    board.setAttribute('aria-label', kind === 'factions' ? 'Factions' : 'NPCs');

    const body = document.createElement('div');
    body.className = 'intel-entity-select__rows';
    board.appendChild(body);

    rows.forEach((segments, index) => {
        const row = createFlatSubrow(index);
        for (const segment of segments) {
            const chips = segment.chips || [];
            if (!chips.length) continue;

            /** @type {HTMLElement[]} */
            const cards = [];
            if (kind === 'factions') {
                for (const entry of /** @type {Array<{ filename: string, displayName?: string }>} */ (chips)) {
                    const id = resolveBioManifestChipIdentity('factions', entry);
                    cards.push(
                        buildStackedCard({
                            kind: 'factions',
                            filterKey: id.filterKey,
                            displayName: id.displayName,
                            onSelect,
                        }),
                    );
                }
            } else {
                for (const npcId of /** @type {string[]} */ (chips)) {
                    cards.push(
                        buildStackedCard({
                            kind: 'npcs',
                            filterKey: npcId,
                            displayName: getHeroDisplayName(npcId),
                            onSelect,
                        }),
                    );
                }
            }

            const key = String(segment.key || segment.category || '');
            const label =
                kind === 'factions'
                    ? String(segment.label || key)
                    : labelForNpcBiographyCategory(String(segment.category || key));
            row.appendChild(buildFlatSubgroup(key, label, cards));
        }
        if (row.childElementCount > 0) body.appendChild(row);
    });

    return board;
}

/**
 * @param {(kind: string, filterKey: string, displayName: string) => void} onSelect
 * @returns {Promise<HTMLElement>}
 */
async function buildFactionsBoard(onSelect) {
    const factions = await loadBioFilterManifestEntries('factions');
    const filterRows = await buildFactionBiographyFlatChipRowSegments(
        /** @type {Array<{ filename: string, displayName?: string }>} */ (factions),
    );
    const rows = packSegmentsIntoRows(flattenFilterRows(filterRows), INTEL_FLAT_ROW_COUNT);
    return buildFlatSharedRowBoard('factions', rows, onSelect);
}

/**
 * @param {(kind: string, filterKey: string, displayName: string) => void} onSelect
 * @returns {Promise<HTMLElement>}
 */
async function buildNpcsBoard(onSelect) {
    const npcs = /** @type {string[]} */ (await loadBioFilterManifestEntries('npcs'));
    const filterRows = await buildNpcBiographyFlatChipRowSegments(npcs);
    const rows = packSegmentsIntoRows(flattenFilterRows(filterRows), INTEL_FLAT_ROW_COUNT);
    return buildFlatSharedRowBoard('npcs', rows, onSelect);
}

/**
 * @param {HTMLElement} root
 */
function bindCardSizeSync(root) {
    cardSizeObserver?.disconnect();
    cardSizeObserver = null;
    syncCardSize = null;

    const probe = root.querySelector(
        '.intel-entity-select__panel[data-category="heroes"] .chatters-hero-card',
    );
    if (!(probe instanceof HTMLElement)) return;

    const apply = () => {
        const width = probe.getBoundingClientRect().width;
        if (!Number.isFinite(width) || width < 8) return;
        /* Convert screen px → layout px under body desktop-scale */
        const scale = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--desktop-scale'),
        ) || Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--desktop-scale')) || 1;
        const layoutPx = scale > 0 && scale < 1 ? width / scale : width;
        root.style.setProperty('--intel-entity-card', `${Math.round(layoutPx * 100) / 100}px`);
    };

    syncCardSize = apply;
    requestAnimationFrame(() => requestAnimationFrame(apply));
    if (typeof ResizeObserver === 'undefined') return;
    cardSizeObserver = new ResizeObserver(() => apply());
    cardSizeObserver.observe(probe);
    cardSizeObserver.observe(root);
}

/**
 * Show entity stage; hide picker.
 */
export function showIntelEntityView() {
    const host = getHost();
    if (!host) return;
    host.classList.remove('gallery-mode--heroes-select');
    host.classList.add('gallery-mode--entity');
    if (rootEl) rootEl.hidden = true;
    syncDockFlanks();
}

/**
 * Show picker; clear entity stage selection.
 */
export function showIntelHeroesSelect() {
    const host = getHost();
    if (!host) return;
    clearBioBiographyEntityFromFilter();
    host.classList.add('gallery-mode--heroes-select');
    host.classList.remove('gallery-mode--entity');
    if (rootEl) rootEl.hidden = false;
    syncDockFlanks();
    requestAnimationFrame(() => syncCardSize?.());
}

/** @returns {boolean} */
export function isIntelHeroesSelectVisible() {
    const host = getHost();
    return !!host?.classList.contains('gallery-mode--heroes-select');
}

/**
 * @param {HTMLElement} host
 * @returns {Promise<void>}
 */
export async function mountIntelHeroesSelect(host) {
    unmountIntelHeroesSelect();
    renderToken += 1;
    const token = renderToken;

    const onSelect = (kind, filterKey, displayName) => {
        selectBioBiographyEntityFromFilter(kind, filterKey, displayName);
        showIntelEntityView();
        window.SoundEffectsManager?.play?.('eventClick');
    };

    const root = document.createElement('div');
    root.className = 'intel-heroes-select intel-entity-select';
    root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', 'Intel entity select');

    const tabs = document.createElement('div');
    tabs.className = 'intel-entity-select__tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Intel categories');

    const panels = document.createElement('div');
    panels.className = 'intel-entity-select__panels';

    /** @type {Array<{ id: 'heroes'|'factions'|'npcs', label: string }>} */
    const categories = [
        { id: 'heroes', label: 'Heroes' },
        { id: 'factions', label: 'Factions' },
        { id: 'npcs', label: 'NPCs' },
    ];

    /** @type {Record<string, HTMLElement>} */
    const panelById = {};
    /** @type {Record<string, HTMLButtonElement>} */
    const tabById = {};

    const setActive = (id) => {
        for (const cat of categories) {
            const on = cat.id === id;
            tabById[cat.id]?.classList.toggle('is-active', on);
            tabById[cat.id]?.setAttribute('aria-selected', on ? 'true' : 'false');
            if (panelById[cat.id]) panelById[cat.id].hidden = !on;
        }
        if (id === 'heroes') {
            requestAnimationFrame(() => syncCardSize?.());
        }
    };

    for (const cat of categories) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'intel-entity-select__tab';
        tab.setAttribute('role', 'tab');
        tab.dataset.category = cat.id;
        tab.textContent = cat.label;
        tab.addEventListener('click', () => setActive(cat.id));
        tabs.appendChild(tab);
        tabById[cat.id] = tab;

        const panel = document.createElement('div');
        panel.className = 'intel-entity-select__panel';
        panel.dataset.category = cat.id;
        panel.setAttribute('role', 'tabpanel');
        panel.hidden = true;
        panels.appendChild(panel);
        panelById[cat.id] = panel;
    }

    root.append(tabs, panels);

    const loading = document.createElement('p');
    loading.className = 'intel-entity-select__loading';
    loading.textContent = 'Loading…';
    panelById.heroes.appendChild(loading);
    setActive('heroes');

    const heroes = /** @type {string[]} */ (await loadBioFilterManifestEntries('heroes'));
    if (token !== renderToken) return;

    const heroesBoard = await buildHeroRoleSelectBoard(heroes, {
        ariaLabel: 'Intel heroes',
        ariaLabelSuffix: 'intel',
        iconUrl: (heroId) => heroFilterIconUrl(heroId) || '',
        onSelect: (heroId, displayName) => onSelect('heroes', heroId, displayName),
    });
    if (token !== renderToken) return;

    const heroesStage = wrapHeroRoleSelectStage(heroesBoard);
    heroesStage.classList.add('intel-entity-select__heroes-stage');
    panelById.heroes.replaceChildren(heroesStage);

    panelById.factions.replaceChildren(await buildFactionsBoard(onSelect));
    if (token !== renderToken) return;
    panelById.npcs.replaceChildren(await buildNpcsBoard(onSelect));
    if (token !== renderToken) return;

    rootEl = root;
    host.appendChild(root);
    bindCardSizeSync(root);
    showIntelHeroesSelect();
}

export function unmountIntelHeroesSelect() {
    renderToken += 1;
    cardSizeObserver?.disconnect();
    cardSizeObserver = null;
    syncCardSize = null;
    rootEl?.remove();
    rootEl = null;
    const host = getHost();
    host?.classList.remove('gallery-mode--heroes-select', 'gallery-mode--entity');
}
