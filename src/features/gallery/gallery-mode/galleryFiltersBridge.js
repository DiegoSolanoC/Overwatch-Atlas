/**
 * Bridge: Filters panel ↔ Gallery (Intel) mode.
 * Heroes / factions / NPCs stay single-select and drive biography + curated dock.
 * Countries are multi-select and further filter that curated dock (normal filter-out).
 */

import {
    clearBioBiographyEntityFromFilter,
    selectBioBiographyEntityFromFilter,
} from './heroBiographySelection.js';
import {
    loadBioFilterManifestEntries,
    resolveBioManifestChipIdentity,
} from './loadBioFilterManifest.js';
import { syncStoryTimelineIfActive } from '../../story/story-mode/StoryTimelineView.js';
import { refreshHeroBiographyDockPagination } from './heroBiographyDockTimeline.js';

const HOST_ID = 'atlasGalleryHost';

/** @type {number | ReturnType<typeof requestIdleCallback> | null} */
let filterCountRefreshHandle = null;
/** @type {'idle' | 'timeout' | null} */
let filterCountRefreshKind = null;

/**
 * Defer Confirm match-count walk so Intel entity picks stay interactive.
 * Chip selected state is already correct; only the badge needs a pass.
 */
function scheduleGalleryFilterCountRefresh() {
    if (filterCountRefreshHandle != null) {
        if (filterCountRefreshKind === 'idle' && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(filterCountRefreshHandle);
        } else {
            clearTimeout(filterCountRefreshHandle);
        }
        filterCountRefreshHandle = null;
        filterCountRefreshKind = null;
    }

    const run = () => {
        filterCountRefreshHandle = null;
        filterCountRefreshKind = null;
        try {
            window.FilterService?.updateFilterCounts?.();
        } catch (_) {
            /* Filters panel may be tearing down */
        }
    };

    if (typeof requestIdleCallback === 'function') {
        filterCountRefreshKind = 'idle';
        filterCountRefreshHandle = requestIdleCallback(run, { timeout: 800 });
    } else {
        filterCountRefreshKind = 'timeout';
        filterCountRefreshHandle = window.setTimeout(run, 120);
    }
}

export function isAtlasGalleryOpen() {
    return !!document.getElementById(HOST_ID);
}

/**
 * @param {{ selectedFilters?: Set<string> } | null | undefined} stateManager
 */
function syncStandaloneFromPending(stateManager) {
    if (!stateManager?.selectedFilters) return;
    if (!(window.standaloneActiveFilters instanceof Set)) {
        window.standaloneActiveFilters = new Set();
    }
    window.standaloneActiveFilters.clear();
    for (const key of stateManager.selectedFilters) {
        window.standaloneActiveFilters.add(key);
    }
    try {
        syncStoryTimelineIfActive();
    } catch (_) {
        /* Story mode may be unloaded */
    }
}

function isCountryFilterKey(key) {
    return String(key || '').startsWith('country:');
}

/**
 * Drop entity chips from selection + visuals; keep any `country:*` picks.
 * @param {object} stateManager
 * @param {HTMLElement | null} grid
 */
function clearNonCountrySelections(stateManager, grid) {
    const keep = [];
    for (const key of stateManager.selectedFilters || []) {
        if (isCountryFilterKey(key)) keep.push(key);
    }
    stateManager.selectedFilters.clear();
    keep.forEach((key) => stateManager.add(key));

    if (grid) {
        grid.querySelectorAll('.filter-btn.selected').forEach((btn) => {
            const key = btn.dataset.filterKey || '';
            if (isCountryFilterKey(key)) return;
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        });
    }
}

/**
 * @param {string} filterKey
 * @param {string} displayName
 * @param {'heroes'|'factions'|'npcs'|'locations'|'countries'|string} type
 */
export function applyExclusiveGallerySelection(filterKey, displayName, type) {
    const fs = window.FilterService;
    const stateManager = fs?.stateManager;
    if (!stateManager) return;

    const grid = document.getElementById('filtersGrid');
    const t = String(type || '').toLowerCase();

    if (t === 'countries') {
        if (stateManager.has(filterKey)) {
            stateManager.remove(filterKey);
        } else {
            stateManager.add(filterKey);
        }
        if (grid) {
            const btn = grid.querySelector(`.filter-btn[data-filter-key="${CSS.escape(filterKey)}"]`);
            if (btn) {
                const on = stateManager.has(filterKey);
                btn.classList.toggle('selected', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            }
        }
        syncStandaloneFromPending(stateManager);
        refreshHeroBiographyDockPagination();
        scheduleGalleryFilterCountRefresh();
        return;
    }

    clearNonCountrySelections(stateManager, grid);
    if (typeof stateManager.add === 'function') {
        stateManager.add(filterKey);
    } else {
        stateManager.selectedFilters.add(filterKey);
    }

    if (grid) {
        const btn = grid.querySelector(`.filter-btn[data-filter-key="${CSS.escape(filterKey)}"]`);
        if (btn) {
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
        }
    }

    if (t === 'heroes' || t === 'factions' || t === 'npcs' || t === 'locations') {
        selectBioBiographyEntityFromFilter(t, filterKey, displayName);
    } else {
        clearBioBiographyEntityFromFilter();
        refreshHeroBiographyDockPagination();
    }

    syncStandaloneFromPending(stateManager);
    scheduleGalleryFilterCountRefresh();
}

/**
 * Intel chip pick: entity types stay exclusive; countries toggle independently.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.filterBtn
 * @param {string} opts.filterKey
 * @param {string} opts.displayName
 * @param {'heroes'|'factions'|'npcs'|'countries'|string} opts.type
 * @param {object} opts.stateManager
 * @param {boolean} opts.wasSelected — true if chip was already selected before click
 */
export function applyGalleryExclusiveFilterPick({
    filterBtn,
    filterKey,
    displayName,
    type,
    stateManager,
    wasSelected,
}) {
    if (!isAtlasGalleryOpen() || !stateManager) return false;

    const grid = filterBtn?.closest?.('.filters-grid') || document.getElementById('filtersGrid');
    const t = String(type || '').toLowerCase();

    if (t === 'countries') {
        if (wasSelected) {
            stateManager.remove(filterKey);
            filterBtn.classList.remove('selected');
            filterBtn.setAttribute('aria-pressed', 'false');
        } else {
            stateManager.add(filterKey);
            filterBtn.classList.add('selected');
            filterBtn.setAttribute('aria-pressed', 'true');
        }
        syncStandaloneFromPending(stateManager);
        refreshHeroBiographyDockPagination();
        scheduleGalleryFilterCountRefresh();
        return true;
    }

    if (wasSelected) {
        stateManager.remove(filterKey);
        filterBtn.classList.remove('selected');
        filterBtn.setAttribute('aria-pressed', 'false');
        clearBioBiographyEntityFromFilter();
        syncStandaloneFromPending(stateManager);
        refreshHeroBiographyDockPagination();
        scheduleGalleryFilterCountRefresh();
        return true;
    }

    clearNonCountrySelections(stateManager, grid);
    stateManager.add(filterKey);
    filterBtn.classList.add('selected');
    filterBtn.setAttribute('aria-pressed', 'true');

    if (t === 'heroes' || t === 'factions' || t === 'npcs' || t === 'locations') {
        selectBioBiographyEntityFromFilter(t, filterKey, displayName);
    } else {
        clearBioBiographyEntityFromFilter();
        refreshHeroBiographyDockPagination();
    }

    syncStandaloneFromPending(stateManager);
    scheduleGalleryFilterCountRefresh();
    return true;
}

/** Clear gallery curation when Filters Clear runs in gallery mode. */
export function clearGalleryFilterSelectionIfOpen() {
    if (!isAtlasGalleryOpen()) return;
    clearBioBiographyEntityFromFilter();
}

/**
 * Open the filters panel for gallery (empty single-select slate).
 */
export function openFiltersPanelForGallery() {
    const fs = window.FilterService;
    if (!fs) return;

    if (fs.stateManager) {
        fs.stateManager.clear?.();
        fs.stateManager.selectedFilters?.clear?.();
    }
    if (window.standaloneActiveFilters instanceof Set) {
        window.standaloneActiveFilters.clear();
    }

    if (typeof fs.openPanelWithMode === 'function') {
        fs.openPanelWithMode('filters');
    } else if (typeof fs.openPanel === 'function') {
        fs.openPanel();
    }
    fs.updateButtonStates?.();
}

/**
 * Pick a random hero whenever Gallery opens so the stage is never empty.
 * Honors a pending deep-link from {@link openBioEntityInGallery}.
 */
export async function pickRandomGalleryHeroOnOpen() {
    if (!isAtlasGalleryOpen()) return;

    try {
        const { consumePendingGalleryBioFocus, focusBioEntityInOpenGallery } =
            await import('./openBioEntityInGallery.js');
        const pending = consumePendingGalleryBioFocus();
        if (pending?.name) {
            const ok = await focusBioEntityInOpenGallery(pending.kind, pending.name);
            if (ok) return;
        }

        const heroes = await loadBioFilterManifestEntries('heroes');
        if (!heroes.length) return;

        const item = heroes[Math.floor(Math.random() * heroes.length)];
        const { filterKey, displayName } = resolveBioManifestChipIdentity('heroes', item);
        if (!filterKey) return;

        applyExclusiveGallerySelection(filterKey, displayName, 'heroes');
    } catch (err) {
        console.warn('[gallery] Failed to pick random hero:', err);
    }
}

/** Close filters when leaving gallery (best-effort). */
export function closeFiltersPanelForGalleryExit() {
    const fs = window.FilterService;
    const panel = document.getElementById('filtersPanel');
    if (fs && panel?.classList.contains('open') && typeof fs.closePanel === 'function') {
        fs.closePanel();
    }
    clearBioBiographyEntityFromFilter();
    if (window.standaloneActiveFilters instanceof Set) {
        window.standaloneActiveFilters.clear();
    }
    if (fs?.stateManager) {
        fs.stateManager.clear?.();
        fs.stateManager.selectedFilters?.clear?.();
    }
}
