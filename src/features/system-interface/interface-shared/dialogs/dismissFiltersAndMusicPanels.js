/**
 * Close filters + music panels so the event manager can open without overlap
 * (matches EventListenerService behavior when toggling the Events header button).
 */
export function dismissFiltersAndMusicPanels() {
    const musicPanel = document.getElementById('musicPanel');
    const musicButton = document.getElementById('musicToggle');
    if (musicPanel && musicPanel.classList.contains('open')) {
        musicPanel.classList.remove('open');
        if (musicButton) musicButton.classList.remove('active');
    }

    const filtersPanel = document.getElementById('filtersPanel');
    const filtersButton = document.getElementById('filtersToggle');
    if (filtersPanel && filtersPanel.classList.contains('open')) {
        filtersPanel.classList.remove('open');
        if (filtersButton) filtersButton.classList.remove('active');
    }
}

if (typeof window !== 'undefined') {
    window.dismissFiltersAndMusicPanels = dismissFiltersAndMusicPanels;
}
