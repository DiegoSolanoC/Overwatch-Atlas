/**
 * Bridge: Filters panel ↔ Gallery (Intel) mode.
 * Entity chips drive the biography stage; deep-links use
 * {@link applyExclusiveGallerySelection}.
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
import {
    isHeroBiographyDockFilterActive,
    refreshHeroBiographyDockPagination,
} from './heroBiographyDockTimeline.js';
import { updateStandalonePaginationForFilters } from '../../system-interface/interface-load-unload/pagination/standalonePaginationFilterSync.js';
import { showIntelEntityView } from './intelHeroesSelect.js';

/** Country chips: rebuild only when an entity strip is curated; else shared lock. */
function syncIntelDockAfterCountryChip() {
    if (isHeroBiographyDockFilterActive()) {
        refreshHeroBiographyDockPagination();
        return;
    }
    updateStandalonePaginationForFilters();
}

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
 * Open an Intel entity (deep-link / programmatic). Does not exclusive-lock Filters.
 * @param {string} filterKey
 * @param {string} displayName
 * @param {'heroes'|'factions'|'npcs'|'locations'|'countries'|string} type
 */
export function applyExclusiveGallerySelection(filterKey, displayName, type) {
    const t = String(type || '').toLowerCase();

    if (t === 'countries') {
        const fs = window.FilterService;
        const stateManager = fs?.stateManager;
        if (!stateManager) return;
        if (stateManager.has(filterKey)) {
            stateManager.remove(filterKey);
        } else {
            stateManager.add(filterKey);
        }
        syncStandaloneFromPending(stateManager);
        syncIntelDockAfterCountryChip();
        scheduleGalleryFilterCountRefresh();
        return;
    }

    if (t === 'heroes' || t === 'factions' || t === 'npcs' || t === 'locations') {
        selectBioBiographyEntityFromFilter(t, filterKey, displayName);
        if (isAtlasGalleryOpen()) showIntelEntityView();
    } else {
        clearBioBiographyEntityFromFilter();
        refreshHeroBiographyDockPagination();
    }

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
        syncIntelDockAfterCountryChip();
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
        showIntelEntityView();
    } else {
        clearBioBiographyEntityFromFilter();
        refreshHeroBiographyDockPagination();
    }

    syncStandaloneFromPending(stateManager);
    scheduleGalleryFilterCountRefresh();
    return true;
}

/** Dock refresh after Filters Clear while Intel is open. */
export function clearGalleryFilterSelectionIfOpen() {
    if (!isAtlasGalleryOpen()) return;
    refreshHeroBiographyDockPagination();
}

/** @deprecated Filters open normally via the trap. */
export function openFiltersPanelForGallery() {
    /* no-op */
}

/** Deep-link / pending focus when Intel opens. */
export async function pickRandomGalleryHeroOnOpen() {
    if (!isAtlasGalleryOpen()) return;
    try {
        const { consumePendingGalleryBioFocus, focusBioEntityInOpenGallery } =
            await import('./openBioEntityInGallery.js');
        const pending = consumePendingGalleryBioFocus();
        if (pending?.name) {
            await focusBioEntityInOpenGallery(pending.kind, pending.name);
        }
    } catch (err) {
        console.warn('[gallery] Pending intel focus failed:', err);
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
    /* Drop sticky chip chrome so main menu does not keep a selected hero. */
    try {
        fs?.updateButtonStates?.();
        fs?.updateFilterCounts?.();
    } catch (_) {
        /* Filters may already be torn down */
    }
    if (typeof window.syncFiltersPanelTrapIcon === 'function') {
        window.syncFiltersPanelTrapIcon();
    }
}
