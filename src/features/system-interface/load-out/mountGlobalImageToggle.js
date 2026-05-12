/**
 * The "Image On / Image Off" header button next to the Filters button. When
 * toggled, it persists the user's preference in `localStorage.globalImageToggle`
 * and asks the open event slide (if any) to show/hide its image overlay.
 *
 * Two entry points:
 *   - {@link installGlobalImageToggleButton}: create the button via
 *     `createHeaderHubButton` and read the persisted state.
 *   - {@link wireGlobalImageToggleHandler}: bind the click handler after the
 *     button is in the DOM. (Run on a small `setTimeout` so the DOM has
 *     settled from the header-hub mount.)
 */

/**
 * Read the persisted state, initializing the slot on first run.
 *
 * @returns {boolean} `true` if image display is on (the default for new users).
 */
export function readPersistedGlobalImageToggleState() {
    const storedValue = localStorage.getItem('globalImageToggle');
    if (storedValue === null) {
        localStorage.setItem('globalImageToggle', 'true');
        return true;
    }
    return storedValue !== 'false';
}

/**
 * Clone-and-rebind the global image toggle button to drop any stale listeners
 * and attach the standalone handler. Idempotent across repeated LOAD cycles.
 *
 * @param {boolean} initialState - The persisted "image on?" state, used to set
 *   the initial `.active` class on the button.
 */
export function wireGlobalImageToggleHandler(initialState) {
    const globalImageToggleBtn = document.getElementById('globalImageToggle');
    if (!globalImageToggleBtn) return;

    if (initialState) {
        globalImageToggleBtn.classList.add('active');
    }

    const newBtn = globalImageToggleBtn.cloneNode(true);
    globalImageToggleBtn.parentNode.replaceChild(newBtn, globalImageToggleBtn);

    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentState = localStorage.getItem('globalImageToggle') === 'true';
        const newState = !currentState;
        localStorage.setItem('globalImageToggle', newState.toString());

        if (window.flashButton) {
            window.flashButton(newBtn, newState ? 'flash-green' : 'flash-red');
        }

        const labelEl = newBtn.querySelector('.globe-control-btn__label');
        if (labelEl) {
            labelEl.textContent = newState ? 'Image On' : 'Image Off';
        }
        if (newState) {
            newBtn.classList.add('active');
        } else {
            newBtn.classList.remove('active');
        }

        // If the event slide is closed, open it onto the last viewed event so
        // the user actually sees the image-toggle effect.
        const eventSlide = document.getElementById('eventSlide');
        const isSlideOpen = !!eventSlide?.classList.contains('open');
        const ss = window.standaloneEventSlide;
        if (!isSlideOpen && ss?.showStandaloneEventSlide) {
            const events = window.eventManager?.events || [];
            let idx = Number.isFinite(ss.currentEventIndex) ? ss.currentEventIndex : 0;
            if (idx < 0) idx = 0;
            if (idx >= events.length) idx = Math.max(0, events.length - 1);
            const eventToOpen = ss.currentEventData || events[idx];
            if (eventToOpen) {
                const arch = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                ss._presentationFromDockTimeline = arch === 'story';
                ss.showStandaloneEventSlide(eventToOpen, idx);
            }
        }

        // Apply image state on the next tick, after the slide has opened.
        setTimeout(() => {
            const slideNowOpen = !!document.getElementById('eventSlide')?.classList.contains('open');
            if (!slideNowOpen || !ss) return;
            if (newState) {
                const path = ss.currentImagePath?.trim();
                if (path && ss.showImageOverlayGradually) {
                    ss.showImageOverlayGradually(path, 600);
                }
            } else if (ss.hideImageOverlayGradually) {
                ss.hideImageOverlayGradually(600);
            } else if (ss.hideImageOverlay) {
                ss.hideImageOverlay();
            }
        }, 0);

        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('imageDisplay');
        }
    });
}
