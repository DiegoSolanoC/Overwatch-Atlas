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
            if (filtersToggle) {
                filtersToggle.classList.toggle('active', !!filtersPanel?.classList.contains('open'));
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
            observer.observe(filtersPanel, { attributes: true, attributeFilter: ['class'] });
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
