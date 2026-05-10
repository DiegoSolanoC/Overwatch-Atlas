/**
 * HomeButtonHandler — wires the universal "Home" header button.
 *
 * Clicking Home plays the mode-switch SFX, hides the various event/image
 * overlays, gracefully unloads whatever mode is active (Worldview /
 * Codex / Data Archive), restores the main menu, and clears persisted
 * mode so a refresh also lands on the menu.
 *
 * Designed to be attached once during `loadHeaderModeButtons`.
 */

import {
    showLoadingOverlay,
    hideLoadingOverlay
} from '../../runtime/loadingOverlayState.js';
import { updateStatus } from '../../runtime/statusFeed.js';
import {
    getCurrentModeOrMenu,
    clearCurrentMode
} from '../../ComponentSetUp/CurrentModeStatus.js';

const MODE_SWITCH_SFX_KEY = 'modeSwitch';
const MODE_SWITCH_SFX_PATH = 'src/assets/audio/sfx/Mode Switch.mp3';
const SFX_LAZY_LOAD_DELAY_MS = 100;
const EVENT_SYSTEM_UNLOAD_SETTLE_MS = 500;

function playModeSwitchSfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds[MODE_SWITCH_SFX_KEY]) {
        sfx.play(MODE_SWITCH_SFX_KEY);
        return;
    }
    sfx.loadSound(MODE_SWITCH_SFX_KEY, MODE_SWITCH_SFX_PATH);
    setTimeout(() => sfx.play(MODE_SWITCH_SFX_KEY), SFX_LAZY_LOAD_DELAY_MS);
}

function closeFloatingOverlays() {
    if (window.EventSlideManager?.instance?.hideEventSlide) {
        window.EventSlideManager.instance.hideEventSlide();
    }
    if (window.standaloneEventSlide?.hideEventSlide) {
        window.standaloneEventSlide.hideEventSlide();
    }
    if (window.imageOverlay?.hide) {
        window.imageOverlay.hide();
    }
}

async function unloadActiveModeBeforeReturningHome(currentMode) {
    // Standalone Event System tears itself down via its own toggle handler.
    const testBtn = document.getElementById('testBtn');
    if (testBtn && testBtn.dataset.loaded === 'true') {
        console.log('[Home Button] Unloading Event System...');
        testBtn.click();
        await new Promise((r) => setTimeout(r, EVENT_SYSTEM_UNLOAD_SETTLE_MS));
    }

    if (currentMode === 'biography' && typeof window.killBiographyComponents === 'function') {
        await window.killBiographyComponents();
    }

    if ((currentMode === 'glossary' || document.body.classList.contains('codex-mode-active'))
        && typeof window.killGlossaryComponents === 'function') {
        await window.killGlossaryComponents();
    }

    if (window.globeController && typeof window.killGlobeComponents === 'function') {
        await window.killGlobeComponents();
    }
}

/**
 * Attach the Home-button click handler. Idempotent caller's responsibility:
 * `loadHeaderModeButtons` only attaches this once because it bails if the
 * button already exists.
 *
 * @param {HTMLElement} homeButton - the `#homeBtn` element to bind
 */
export function attachHomeButtonHandler(homeButton) {
    homeButton.addEventListener('click', async function (e) {
        e.stopPropagation();
        e.preventDefault();

        playModeSwitchSfx();

        const currentMode = getCurrentModeOrMenu();

        showLoadingOverlay();
        updateStatus('Returning to Home...', 'info');

        closeFloatingOverlays();

        await unloadActiveModeBeforeReturningHome(currentMode);

        if (typeof window.restoreMainMenu === 'function') {
            await window.restoreMainMenu();
        }

        clearCurrentMode();

        hideLoadingOverlay();
        updateStatus('✓ Returned to Home', 'success');
    });
}
