/**
 * The "Image On / Image Off" dock button. When toggled, it persists the user's
 * preference in `localStorage.globalImageToggle` and, if an event slide is
 * already open, shows or hides its image overlay. It does not open events.
 *
 * Two entry points:
 *   - {@link installGlobalImageToggleButton}: create the button via
 *     `createHeaderHubButton` and read the persisted state.
 *   - {@link wireGlobalImageToggleHandler}: bind the click handler after the
 *     button is in the DOM. (Run on a small `setTimeout` so the DOM has
 *     settled from the header-hub mount.)
 */

import { isDialogueTheaterImageOverlayContext } from '../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import { isMobileEventSlideViewport } from '../interface-event-slide/standalone-slide/image-overlay/mobileEventSlideImageLayout.js';

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

        const eventSlide = document.getElementById('eventSlide');
        const isSlideOpen = !!eventSlide?.classList.contains('open');
        const ss = window.standaloneEventSlide;

        if (isSlideOpen && ss) {
            const isMobile = isMobileEventSlideViewport();
            if (newState) {
                if (isDialogueTheaterImageOverlayContext()) {
                    if (isMobile && ss.showImageOverlay) {
                        ss.showImageOverlay('');
                    } else if (ss.showImageOverlayGradually) {
                        ss.showImageOverlayGradually('', 600);
                    }
                } else if (isMobile) {
                    const path = ss.currentImagePath?.trim();
                    if (path && ss.showImageOverlay) {
                        ss.showImageOverlay(path);
                    }
                } else {
                    const path = ss.currentImagePath?.trim();
                    if (path && ss.showImageOverlayGradually) {
                        ss.showImageOverlayGradually(path, 600);
                    }
                }
            } else if (isMobile && ss.hideImageOverlay) {
                ss.hideImageOverlay();
            } else if (ss.hideImageOverlayGradually) {
                ss.hideImageOverlayGradually(600);
            } else if (ss.hideImageOverlay) {
                ss.hideImageOverlay();
            }
        }

        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('imageDisplay');
        }
    });
}
