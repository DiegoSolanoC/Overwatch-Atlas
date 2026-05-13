/**
 * HomeButtonHandler — wires the universal "Home" header button.
 *
 * Clicking Home plays the mode-switch SFX, hides the various event/image
 * overlays, gracefully unloads whatever mode is active (Worldview /
 * Codex / Data Archive), restores the main menu, and clears persisted
 * mode so a refresh also lands on the menu.
 *
 * The Event System Load Out (filters panel, pagination dock, news ticker,
 * standalone slide) is **not** torn down on Home — it's mounted at boot
 * and stays alive for the lifetime of the page.
 *
 * Designed to be attached once during `loadHeaderModeButtons`.
 */

import {
  showLoadingOverlay,
  hideLoadingOverlay,
  setRunOperation,
} from "../../runtime/loadingOverlayState.js";
import { updateStatus } from "../../runtime/statusFeed.js";
import {
  getCurrentModeOrMenu,
  clearCurrentMode,
} from "../../ComponentSetUp/mode-lifecycle/CurrentModeStatus.js";
import { teardownGlobeMapChooserHub } from "../../../Interactive-Worldview/entry/GlobeMapLaunchChoice.js";
import { playModeSwitchSound } from "../../Audio/SoundEffects/playModeSwitchSound.js";

function closeFloatingOverlays() {
  if (window.standaloneEventSlide?.hideEventSlide) {
    window.standaloneEventSlide.hideEventSlide();
  }
  if (window.imageOverlay?.hide) {
    window.imageOverlay.hide();
  }
}

async function unloadActiveModeBeforeReturningHome(currentMode) {
  if (
    currentMode === "biography" &&
    typeof window.killBiographyComponents === "function"
  ) {
    await window.killBiographyComponents();
  }

  if (
    (currentMode === "glossary" ||
      document.body.classList.contains("codex-mode-active")) &&
    typeof window.killGlossaryComponents === "function"
  ) {
    await window.killGlossaryComponents();
  }

  if (currentMode === "globe") {
    teardownGlobeMapChooserHub();
    const runBtn = document.getElementById("runGlobeBtn");
    if (runBtn) runBtn.disabled = false;
  }

  if (
    window.globeController &&
    typeof window.killGlobeComponents === "function"
  ) {
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
  homeButton.addEventListener("click", async function (e) {
    e.stopPropagation();
    e.preventDefault();

    playModeSwitchSound(false);

    const currentMode = getCurrentModeOrMenu();

    setRunOperation(false);
    setRunOperation(true);
    showLoadingOverlay();
    updateStatus("Returning to Home...", "info");

    closeFloatingOverlays();

    await unloadActiveModeBeforeReturningHome(currentMode);

    if (typeof window.restoreMainMenu === "function") {
      await window.restoreMainMenu();
    }

    clearCurrentMode();

    setRunOperation(false);
    hideLoadingOverlay({ force: true });
    updateStatus("✓ Returned to Home", "success");
  });
}
