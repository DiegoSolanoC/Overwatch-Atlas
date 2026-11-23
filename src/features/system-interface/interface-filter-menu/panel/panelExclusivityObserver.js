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
        let skipLayoutSync = false;
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
            /*
             * Closing uses panel--closing + width/drawbridge tweens. A globe layout
             * sync on that same tick steals frames from the bridge animation —
             * FiltersPanel.finishClose already requests layout after settle.
             * Overlay panels also do not resize the WebGL stage on open.
             */
            skipLayoutSync =
                !!filtersPanel?.classList.contains('panel--closing')
                || !!filtersPanel?.classList.contains('open')
                || !!document.getElementById('eventSlide')?.classList.contains('panel--closing')
                || !!document.getElementById('eventSlide')?.classList.contains('open');
        } finally {
            enforcing = false;
        }
        if (skipLayoutSync) return;
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
