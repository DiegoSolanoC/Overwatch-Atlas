/**
 * Side-panel / event-slide coordination.
 *
 * On desktop flex layout the info slide and filters/music panel sit side by
 * side, so both may stay `.open`. While both are open we fade out the center
 * stage image so it does not linger over the panel chrome; closing the side
 * panel restores it (see `panelSideImageOverlaySync.js`).
 *
 * Also keeps `#filtersToggle.active` in sync with `#filtersPanel.open`.
 *
 * `_enforcingPanelExclusivity` is a recursion guard — the observer fires on
 * any class change, and we're about to mutate classes ourselves.
 */

import { hideEventImageOverlayForSidePanel } from './panelSideImageOverlaySync.js';

export function createPanelExclusivityObserver() {
    let observer = null;
    let enforcing = false;
    let hidImageForOpenSidePanel = false;

    function enforcePanelExclusivity() {
        if (enforcing) return;
        enforcing = true;
        try {
            const filtersPanel = document.getElementById('filtersPanel');
            const eventSlide = document.getElementById('eventSlide');
            const filtersToggle = document.getElementById('filtersToggle');
            const filtersOpen = !!filtersPanel?.classList.contains('open');
            const eventOpen = !!eventSlide?.classList.contains('open');

            if (filtersOpen && eventOpen) {
                if (!hidImageForOpenSidePanel) {
                    hideEventImageOverlayForSidePanel();
                    hidImageForOpenSidePanel = true;
                }
            } else {
                hidImageForOpenSidePanel = false;
            }
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
            /* Enforce once on start in case both are already open at boot. */
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
