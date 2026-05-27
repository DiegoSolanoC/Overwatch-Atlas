/**
 * Wire the **toggle** (#filtersToggle) and **close** (#filtersPanelClose)
 * buttons of the filters panel. These two are owned by `FiltersPanel` itself
 * (load-out's `mountEventSystemFilters.js` owns Clear / Confirm).
 *
 * Click logic:
 *   - Toggle while panel is open in **music mode** -> swap back to filters
 *     mode without closing the panel.
 *   - Toggle otherwise -> open or close the panel (`togglePanel()`).
 *   - Close button -> reset pending selection to confirmed state and close.
 *
 * SFX (`filterButton`) and flash feedback are fired here.
 */

export function wireFilterPanelToggleAndClose(panel, {
    filtersButton,
    filtersPanelClose,
    soundManager,
    getPanelMode,
    setPanelMode,
    togglePanel,
    resetToConfirmedFilters,
    closePanel
}) {
    if (filtersButton) {
        filtersButton.addEventListener('click', () => {
            const mode = getPanelMode();
            if (panel?.classList.contains('open') && mode === 'music') {
                setPanelMode('filters');
                filtersButton.classList.add('active');
                document.getElementById('musicToggle')?.classList.remove('active');
                window.flashButton?.(filtersButton, 'flash-orange');
                soundManager?.play?.('filterButton');
                return;
            }
            setPanelMode('filters');
            const isOpening = !panel?.classList.contains('open');
            togglePanel();
            if (isOpening) soundManager?.play?.('filterButton');
            window.flashButton?.(filtersButton, 'flash-orange');
        });
    }

    if (filtersPanelClose) {
        filtersPanelClose.addEventListener('click', () => {
            resetToConfirmedFilters();
            closePanel();
            soundManager?.play?.('filterButton');
        });
    }
}
