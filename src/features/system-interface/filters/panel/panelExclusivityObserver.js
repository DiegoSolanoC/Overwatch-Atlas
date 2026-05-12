/**
 * Mutual exclusion between the filters panel and the event info slide.
 *
 * Both panels can be open simultaneously according to their own state
 * machines, but visually they overlap on common screen sizes. The observer
 * watches the `class` attribute of both panels and, the moment they're both
 * `.open`, closes the event slide (filters wins because the user just opened
 * it). It also keeps the `#filtersToggle` button's `.active` class in sync
 * with the actual `#filtersPanel.open` state, so the toolbar reflects truth
 * even if external code mutated the panel directly.
 *
 * `_enforcingPanelExclusivity` is a recursion guard — the observer fires on
 * any class change, and we're about to mutate classes ourselves.
 */

export function createPanelExclusivityObserver() {
    let observer = null;
    let enforcing = false;

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
                /* Filters wins — close event slide + its image overlay. */
                eventSlide.classList.remove('open');
                const overlay = document.getElementById('eventImageOverlay');
                if (overlay) {
                    overlay.classList.remove('open', 'slide-open', 'fade-in', 'fade-out');
                    overlay.style.display = 'none';
                    overlay.style.opacity = '0';
                }
                const eventImage = document.getElementById('eventImage');
                if (eventImage) eventImage.style.display = 'none';
                try {
                    if (window.standaloneEventSlide?.hideImageOverlay) {
                        window.standaloneEventSlide.hideImageOverlay();
                    } else if (window.globeController?.uiView?.hideImageOverlay) {
                        window.globeController.uiView.hideImageOverlay();
                    }
                } catch (_) {}
            }
            if (filtersToggle) {
                filtersToggle.classList.toggle('active', !!filtersPanel?.classList.contains('open'));
            }
        } finally {
            enforcing = false;
        }
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
