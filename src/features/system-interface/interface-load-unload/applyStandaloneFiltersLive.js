/**
 * Live filter application — chips commit immediately into
 * `window.standaloneActiveFilters` and refresh mode-specific views.
 * Confirm is retired; Clear and chip toggles both go through here.
 */

import { updateStandalonePaginationForFilters } from './pagination/standalonePaginationFilterSync.js';
import { syncStoryTimelineIfActive } from '../../story/story-mode/StoryTimelineView.js';
import { syncDialogueTheaterListIfActive } from '../../dialogue-theater/dialogue-theater-list/DialogueTheaterListView.js';

/** @type {number | null} */
let applyTimer = null;
/** @type {number} */
let applyGeneration = 0;

/**
 * Copy pending FilterService selection into the live standalone set.
 */
export function syncStandaloneActiveFiltersFromSelection() {
    const pending = window.FilterService?.stateManager?.selectedFilters;
    if (pending instanceof Set) {
        window.standaloneActiveFilters = new Set(pending);
        return;
    }
    if (!(window.standaloneActiveFilters instanceof Set)) {
        window.standaloneActiveFilters = new Set();
    }
}

/**
 * @param {{
 *   syncSelection?: boolean,
 *   updateTrapIcon?: boolean,
 * }} [opts]
 */
export function runStandaloneFilterSideEffects(opts = {}) {
    if (opts.syncSelection !== false) {
        syncStandaloneActiveFiltersFromSelection();
    }

    if (opts.updateTrapIcon !== false && typeof window.syncFiltersPanelTrapIcon === 'function') {
        window.syncFiltersPanelTrapIcon();
    }

    /* Intel owns its own dock curation — skip EM list rebuild + globe/codex thrash. */
    const intelOpen = !!document.getElementById('atlasGalleryHost');
    const codexOpen =
        !!document.body?.classList.contains('codex-mode-active')
        || !!document.getElementById('codex-view-root');

    if (intelOpen) {
        window.syncEventManagerSearchFromFilterSelection?.({ skipApplySearch: true });
        /*
         * Same lock path as World/Codex — do not rebuild thumbs on every chip
         * (that bounce was an Intel-only override). Entity/country curation still
         * rebuilds via galleryFiltersBridge / heroBiographySelection.
         */
        updateStandalonePaginationForFilters();
    } else {
        /* Paint World/Codex first — EM list rebuild was causing a visible pause. */
        if (typeof window.applyCodexFilterState === 'function') {
            window.applyCodexFilterState();
        }

        /*
         * Codex stage is opaque — globe marker locking + Story/Theater list sync
         * still ran on every chip/Clear and stole frames from cord updates.
         */
        if (!codexOpen) {
            if (window.globeEventMarkerManager) {
                window.globeEventMarkerManager.applyFilters();
            } else if (window.globeController?.eventMarkerManager) {
                window.globeController.eventMarkerManager.applyFilters();
            } else {
                updateStandalonePaginationForFilters();
            }
        } else {
            updateStandalonePaginationForFilters();
        }

        const deferHeavy = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 0);
        deferHeavy(() => {
            if (codexOpen) {
                /* Dock thumbs only — skip EM full list + Story/Theater while Codex is up. */
                return;
            }
            window.syncEventManagerSearchFromFilterSelection?.();
            syncStoryTimelineIfActive();
            syncDialogueTheaterListIfActive();
        });
    }

    if (typeof window.LocationFlagHelpers?.scheduleApplyRelevancyRowFilterHighlight === 'function') {
        window.LocationFlagHelpers.scheduleApplyRelevancyRowFilterHighlight();
    }
}

/**
 * Apply selection now (or coalesce rapid chip toggles onto the next frame).
 * @param {{ immediate?: boolean }} [opts]
 */
export function applyStandaloneFiltersLive(opts = {}) {
    syncStandaloneActiveFiltersFromSelection();

    const gen = ++applyGeneration;
    if (applyTimer != null) {
        clearTimeout(applyTimer);
        applyTimer = null;
    }

    const run = () => {
        applyTimer = null;
        if (gen !== applyGeneration) return;
        runStandaloneFilterSideEffects({ syncSelection: true, updateTrapIcon: true });
    };

    if (opts.immediate) {
        run();
        return;
    }

    /*
     * Codex graph work is heavy — coalesce rapid chip taps (~2 frames) so we
     * don't start a prune-graph rebuild for every intermediate selection.
     */
    const codexOpen =
        !!document.body?.classList.contains('codex-mode-active')
        || !!document.getElementById('codex-view-root');
    applyTimer = window.setTimeout(run, codexOpen ? 32 : 0);
}
