/**
 * `#filtersPanel` is a **shared container** that hosts either the filters
 * UI (default) or the music UI. The right-edge trapezium handle on the music
 * side launches music mode; the filters trapezium launches filters mode. Each
 * mode is reflected on the panel via two CSS classes
 * (`filters-panel--filters-mode` / `filters-panel--music-mode`) plus a
 * `data-panel-mode` attribute.
 *
 * In music mode we hijack the music content from the legacy `#musicPanel`
 * (still rendered for accessibility / non-shared layouts) and graft it into
 * `#filtersPanel` so resize, close, and outside-click handling all share one
 * panel chrome.
 */

export function getPanelModeFor(filtersPanel, fallback) {
    const panel = filtersPanel || document.getElementById('filtersPanel');
    const mode = panel?.dataset?.panelMode || fallback;
    return mode === 'music' ? 'music' : 'filters';
}

export function setPanelModeFor(filtersPanel, mode) {
    const nextMode = mode === 'music' ? 'music' : 'filters';
    const panel = filtersPanel || document.getElementById('filtersPanel');
    if (!panel) return nextMode;
    panel.classList.toggle('filters-panel--music-mode', nextMode === 'music');
    panel.classList.toggle('filters-panel--filters-mode', nextMode !== 'music');
    panel.dataset.panelMode = nextMode;

    /* Toggle visuals only when the panel is actually open — otherwise the
       toolbar buttons would lit up with the panel still hidden. */
    if (panel.classList.contains('open')) {
        const filtersButton = document.getElementById('filtersToggle');
        const musicButton = document.getElementById('musicToggle');
        filtersButton?.classList.toggle('active', nextMode !== 'music');
        musicButton?.classList.toggle('active', nextMode === 'music');
    }
    return nextMode;
}

/**
 * Move the music UI from the legacy `#musicPanel` into `#filtersPanel` the
 * first time music mode is requested. Idempotent.
 */
export function adoptLegacyMusicContentIntoSharedPanel(filtersPanel) {
    const panel = filtersPanel || document.getElementById('filtersPanel');
    if (!panel) return;
    if (panel.querySelector('.music-panel-content')) return;
    const legacyMusicPanel = document.getElementById('musicPanel');
    const musicContent = legacyMusicPanel?.querySelector('.music-panel-content');
    if (!musicContent) return;
    panel.appendChild(musicContent);
    legacyMusicPanel.style.display = 'none';
}
