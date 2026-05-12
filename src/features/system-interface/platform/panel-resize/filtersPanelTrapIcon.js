/**
 * The filters panel handle wears a small "trap" icon that mirrors whether any
 * filter is currently active (full icon) or none are (empty icon). FilterService
 * and the standalone-filter system both call `window.syncFiltersPanelTrapIcon`
 * when their selections change, so we expose a window alias.
 */

const FILTERS_TRAP_EMPTY = 'src/assets/images/Icons/Filter%20Icons/Empty%20Filter%20Icon.png';
const FILTERS_TRAP_ACTIVE = 'src/assets/images/Icons/Filter%20Icons/Filter%20Icon.png';

export const FILTERS_TRAP_ICONS = { empty: FILTERS_TRAP_EMPTY, active: FILTERS_TRAP_ACTIVE };
export const EVENT_TRAP_PAGE_ICON = 'src/assets/images/Icons/Utility%20Icons/Page%20Icon.png';
export const MUSIC_TRAP_ICON = 'src/assets/images/Icons/Music%20Icons/Music%20Icon.png';

function filtersTrapHasActiveSelection() {
    try {
        if (
            window.FilterService &&
            window.FilterService.stateManager &&
            window.FilterService.stateManager.selectedFilters
        ) {
            return window.FilterService.stateManager.selectedFilters.size > 0;
        }
    } catch (e) {
        /* ignore */
    }
    return !!(window.standaloneActiveFilters && window.standaloneActiveFilters.size > 0);
}

/** @param {HTMLImageElement|null|undefined} trapImg optional img from ensureHandle */
export function syncFiltersPanelTrapIcon(trapImg) {
    let img = trapImg;
    if (!img || !img.tagName || img.tagName.toLowerCase() !== 'img') {
        const panel = document.getElementById('filtersPanel');
        /* Only update the filters-mode trapezium icon; keep music-mode icon untouched. */
        img =
            panel &&
            panel.querySelector(
                '.panel-resize-handle[data-panel-mode="filters"] .panel-resize-handle__trap-icon'
            );
    }
    if (!img || !img.tagName || img.tagName.toLowerCase() !== 'img') return;
    img.src = filtersTrapHasActiveSelection() ? FILTERS_TRAP_ACTIVE : FILTERS_TRAP_EMPTY;
}

export function syncFiltersPanelTrapIconFromWindow() {
    syncFiltersPanelTrapIcon(null);
}

export function installFiltersTrapIconWindowApi() {
    if (typeof window === 'undefined') return;
    window.syncFiltersPanelTrapIcon = syncFiltersPanelTrapIconFromWindow;
}
