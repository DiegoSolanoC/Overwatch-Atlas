/**
 * Wire the standalone filter Confirm / Clear buttons.
 *
 * In standalone (non-globe) mode, the filter buttons live in the right panel
 * but operate on `window.standaloneActiveFilters` rather than the globe scene
 * model. We swap each button by cloning to drop any stale listeners and bind
 * fresh handlers that:
 *   - confirm: copy `FilterService.stateManager.selectedFilters` into
 *     `standaloneActiveFilters`, refresh pagination thumbs, refresh markers,
 *     refresh codex highlight + relevancy rows, close the panel.
 *   - clear: empty the standalone set, ask FilterService to reset, refresh.
 *
 * `window._menuHelpersFilterHandlersInstalled` is set so FilterService skips
 * re-binding its own globe-mode handlers on top.
 */

import { updateStatus } from '../../universal-features/runtime/statusFeed.js';
import { updateStandalonePaginationForFilters } from './pagination/standalonePaginationFilterSync.js';

/**
 * Replace `#confirmFiltersBtn` and `#clearFiltersBtn` with cloned copies wired
 * for standalone-mode behavior. Idempotent: subsequent calls will re-clone the
 * current buttons and rebind handlers from scratch.
 */
export function wireStandaloneFilterButtons() {
    window._menuHelpersFilterHandlersInstalled = true;

    const confirmFiltersBtn = document.getElementById('confirmFiltersBtn');
    if (confirmFiltersBtn) {
        const newConfirmBtn = confirmFiltersBtn.cloneNode(true);
        confirmFiltersBtn.parentNode.replaceChild(newConfirmBtn, confirmFiltersBtn);
        newConfirmBtn.addEventListener('click', () => {
            if (window.FilterService?.stateManager?.selectedFilters) {
                window.standaloneActiveFilters = new Set(window.FilterService.stateManager.selectedFilters);
            }
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('filterConfirm');
            }
            updateStandalonePaginationForFilters();
            if (window.globeEventMarkerManager) {
                window.globeEventMarkerManager.applyFilters();
            } else if (window.globeController?.eventMarkerManager) {
                window.globeController.eventMarkerManager.applyFilters();
            }
            if (typeof window.applyCodexFilterState === 'function') {
                window.applyCodexFilterState();
            }
            if (typeof window.LocationFlagHelpers?.scheduleApplyRelevancyRowFilterHighlight === 'function') {
                window.LocationFlagHelpers.scheduleApplyRelevancyRowFilterHighlight();
            }
            const filtersPanel = document.getElementById('filtersPanel');
            if (filtersPanel) filtersPanel.classList.remove('open');
            const filtersToggle = document.getElementById('filtersToggle');
            if (filtersToggle) filtersToggle.classList.remove('active');
            if (typeof window.syncFiltersPanelTrapIcon === 'function') {
                window.syncFiltersPanelTrapIcon();
            }
            updateStatus('Filters applied', 'success');
        });
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        const newClearBtn = clearFiltersBtn.cloneNode(true);
        clearFiltersBtn.parentNode.replaceChild(newClearBtn, clearFiltersBtn);
        newClearBtn.addEventListener('click', () => {
            window.standaloneActiveFilters?.clear();
            if (window.FilterService?.stateManager) {
                window.FilterService.stateManager.clear();
            }
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('filterClear');
            }
            if (window.FilterService?.updateButtonStates) {
                window.FilterService.updateButtonStates();
            }
            updateStandalonePaginationForFilters();
            if (window.globeEventMarkerManager) {
                window.globeEventMarkerManager.applyFilters();
            }
            if (typeof window.applyCodexFilterState === 'function') {
                window.applyCodexFilterState();
            }
            if (typeof window.LocationFlagHelpers?.scheduleApplyRelevancyRowFilterHighlight === 'function') {
                window.LocationFlagHelpers.scheduleApplyRelevancyRowFilterHighlight();
            }
            updateStatus('Filters cleared', 'success');
        });
    }
}
