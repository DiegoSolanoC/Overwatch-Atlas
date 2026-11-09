/**
 * Side-panel / event-slide coordination.
 *
 * Keeps `#filtersToggle.active` in sync with `#filtersPanel.open` and nudges
 * stage layout when either panel toggles.
 *
 * Opening filters or music fully closes the info slide (see
 * `closeEventInfoPanelIfOpen.js`); they no longer share the stage side-by-side.
 */

export function createPanelExclusivityObserver() {
    let observer = null;
    let enforcing = false;

    function enforcePanelExclusivity() {
        if (enforcing) return;
        enforcing = true;
        try {
            const filtersPanel = document.getElementById('filtersPanel');
            const filtersToggle = document.getElementById('filtersToggle');
            const musicToggle = document.getElementById('musicToggle');
            const panelOpen = !!filtersPanel?.classList.contains('open');
            const musicMode =
                panelOpen
                && (filtersPanel?.dataset?.panelMode === 'music'
                    || filtersPanel?.classList.contains('filters-panel--music-mode'));
            if (filtersToggle) {
                // Shared panel hosts music too — only light Filters when in filters mode.
                filtersToggle.classList.toggle('active', panelOpen && !musicMode);
            }
            if (musicToggle) {
                musicToggle.classList.toggle('active', musicMode);
            }
        } finally {
            enforcing = false;
        }
        window.globeController?.requestStageLayoutSync?.();
    }

    return {
        start() {
            if (observer) return;
            const filtersPanel = document.getElementById('filtersPanel');
            const eventSlide = document.getElementById('eventSlide');
            if (!filtersPanel || !eventSlide || typeof MutationObserver === 'undefined') return;
            observer = new MutationObserver(enforcePanelExclusivity);
            observer.observe(filtersPanel, {
                attributes: true,
                attributeFilter: ['class', 'data-panel-mode'],
            });
            observer.observe(eventSlide, { attributes: true, attributeFilter: ['class'] });
            enforcePanelExclusivity();
        },
        stop() {
            if (!observer) return;
            try { observer.disconnect(); } catch (_) {}
            observer = null;
            enforcing = false;
        }
    };
}
