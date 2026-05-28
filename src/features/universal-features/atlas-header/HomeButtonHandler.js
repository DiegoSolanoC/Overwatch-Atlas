/**
 * HomeButtonHandler — wires the universal "Home" header button.
 */

import {
  showLoadingOverlay,
  hideLoadingOverlay,
  setRunOperation,
} from "../atlas-mode-runtime/loadingOverlayState.js";
import { updateStatus } from "../atlas-mode-runtime/statusFeed.js";
import {
  getCurrentModeOrMenu,
  clearCurrentMode,
} from "../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js";
import { ATLAS_MODE, isAtlasMode } from "../atlas-mode-runtime/atlasModes.js";
import { teardownGlobeMapChooserHub } from "../../world/worldview-mode-entry/entry/WorldviewMapLaunchChoice.js";
import { playModeSwitchSound } from "../atlas-sound-effects/playModeSwitchSound.js";
import {
  killPlaceholderModeIfActive,
  killPlaceholderModeFromDomIfPresent,
} from "./triggerHomeExit.js";

function closeFloatingOverlays() {
  if (window.standaloneEventSlide?.hideEventSlide) {
    window.standaloneEventSlide.hideEventSlide();
  }
  if (window.imageOverlay?.hide) {
    window.imageOverlay.hide();
  }
}

async function unloadActiveModeBeforeReturningHome(currentMode) {
  if (await killPlaceholderModeIfActive(currentMode)) {
    return;
  }
  if (await killPlaceholderModeFromDomIfPresent()) {
    return;
  }

  if (
    isAtlasMode(currentMode, ATLAS_MODE.DATA_WORKSHOP) &&
    typeof window.killDataWorkshopComponents === "function"
  ) {
    await window.killDataWorkshopComponents();
  }

  if (
    (isAtlasMode(currentMode, ATLAS_MODE.CODEX) ||
      document.body.classList.contains("codex-mode-active")) &&
    typeof window.killCodexComponents === "function"
  ) {
    await window.killCodexComponents();
  }

  if (isAtlasMode(currentMode, ATLAS_MODE.WORLD)) {
    teardownGlobeMapChooserHub();
    const runBtn = document.getElementById("runGlobeBtn");
    if (runBtn) runBtn.disabled = false;
  }

  if (
    window.globeController &&
    typeof window.killWorldComponents === "function"
  ) {
    await window.killWorldComponents();
  }
}

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
