/**
 * Bridge: Filters panel ↔ Gallery mode.
 * While `#atlasGalleryHost` is open, filter chips are single-select and drive
 * gallery stage + curated dock timeline (countries → timeline only).
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

const HOST_ID = 'atlasGalleryHost';

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

/**
 * @param {string} filterKey
 * @param {string} displayName
 * @param {'heroes'|'factions'|'npcs'|'countries'|string} type
 */
function applyExclusiveGallerySelection(filterKey, displayName, type) {
    const fs = window.FilterService;
    const stateManager = fs?.stateManager;
    const grid = document.getElementById('filtersGrid');

    if (stateManager?.selectedFilters) {
        stateManager.selectedFilters.clear();
        if (typeof stateManager.add === 'function') {
            stateManager.add(filterKey);
        } else {
            stateManager.selectedFilters.add(filterKey);
        }
    }

    if (grid) {
        grid.querySelectorAll('.filter-btn.selected').forEach((btn) => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        });
        const btn = grid.querySelector(`.filter-btn[data-filter-key="${CSS.escape(filterKey)}"]`);
        if (btn) {
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
        }
    }

    const t = String(type || '').toLowerCase();
    if (t === 'heroes' || t === 'factions' || t === 'npcs' || t === 'countries') {
        selectBioBiographyEntityFromFilter(t, filterKey, displayName);
    } else {
        clearBioBiographyEntityFromFilter();
    }

    syncStandaloneFromPending(stateManager);
    fs?.updateButtonStates?.();
    fs?.updateFilterCounts?.();
}

/**
 * Enforce one selected filter key and apply it to gallery + dock.
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

    if (wasSelected) {
        stateManager.remove(filterKey);
        filterBtn.classList.remove('selected');
        filterBtn.setAttribute('aria-pressed', 'false');
        clearBioBiographyEntityFromFilter();
        syncStandaloneFromPending(stateManager);
        window.FilterService?.updateButtonStates?.();
        window.FilterService?.updateFilterCounts?.();
        return true;
    }

    stateManager.selectedFilters.clear();
    if (grid) {
        grid.querySelectorAll('.filter-btn.selected').forEach((btn) => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        });
    }

    stateManager.add(filterKey);
    filterBtn.classList.add('selected');
    filterBtn.setAttribute('aria-pressed', 'true');

    const t = String(type || '').toLowerCase();
    if (t === 'heroes' || t === 'factions' || t === 'npcs' || t === 'countries') {
        selectBioBiographyEntityFromFilter(t, filterKey, displayName);
    } else {
        clearBioBiographyEntityFromFilter();
    }

    syncStandaloneFromPending(stateManager);
    window.FilterService?.updateButtonStates?.();
    window.FilterService?.updateFilterCounts?.();
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
 */
export async function pickRandomGalleryHeroOnOpen() {
    if (!isAtlasGalleryOpen()) return;

    try {
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
