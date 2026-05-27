/**
 * PaletteToggleSetup — idempotent wiring for `#colorPaletteToggle` + `#paletteMenu`.
 * Called from `PaletteLoaders.js` after the header button exists.
 */

import {
  normalizeSavedPalette,
  applyPaletteBodyClasses,
  updateHeaderWebsiteLogo,
} from "./PaletteConstants.js";
import {
  ensurePaletteMenuDom,
  updatePaletteMenuActiveState,
  updatePaletteButtonIcon,
} from "./PaletteMenuDom.js";
import { openPaletteMenu, closePaletteMenu } from "./PaletteMenuPositioning.js";
import { changePalette, playColorChangeSound } from "./PaletteSwitching.js";

let paletteToggleSetup = false;
let _clickOutsideHandler = null;

/**
 * Setup palette toggle. Safe to call again after the button is re-created
 * (e.g. palette unload/reload); re-attaches listeners when needed.
 */
export function setupPaletteToggle() {
  const colorPaletteToggle = document.getElementById("colorPaletteToggle");
  if (!colorPaletteToggle) return;

  const wasAlreadySetup =
    paletteToggleSetup && colorPaletteToggle.dataset.setup === "true";

  const savedPalette = localStorage.getItem("colorPalette");
  const activePalette = normalizeSavedPalette(savedPalette);
  applyPaletteBodyClasses(activePalette);
  updateHeaderWebsiteLogo(activePalette);

  if (wasAlreadySetup) {
    const paletteMenu = document.getElementById("paletteMenu");
    if (paletteMenu) {
      const optionButtons = paletteMenu.querySelectorAll(".palette-option-btn");
      let needsReattach = false;
      optionButtons.forEach((btn) => {
        if (!btn._paletteOptionHandler) needsReattach = true;
      });
      if (!needsReattach && colorPaletteToggle._paletteButtonHandler) {
        updateHeaderWebsiteLogo(activePalette);
        updatePaletteMenuActiveState(activePalette);
        return;
      }
    }
  }

  colorPaletteToggle.dataset.setup = "true";
  paletteToggleSetup = true;

  const paletteMenu = ensurePaletteMenuDom();

  updatePaletteMenuActiveState(activePalette);
  updatePaletteButtonIcon(activePalette);

  const handlePaletteButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("paletteMenu");
    if (!menu) return;

    if (menu.classList.contains("open")) {
      closePaletteMenu();
    } else {
      openPaletteMenu();
      playColorChangeSound();
    }
  };

  const handlePaletteOptionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const palette = e.currentTarget?.dataset?.palette;
    if (palette) changePalette(palette);
  };

  const oldHandler = colorPaletteToggle._paletteButtonHandler;
  if (oldHandler) {
    colorPaletteToggle.removeEventListener("click", oldHandler, true);
  }

  colorPaletteToggle._paletteButtonHandler = handlePaletteButtonClick;
  colorPaletteToggle.addEventListener("click", handlePaletteButtonClick, true);

  paletteMenu.querySelectorAll(".palette-option-btn").forEach((btn) => {
    const oldOptionHandler = btn._paletteOptionHandler;
    if (oldOptionHandler) {
      btn.removeEventListener("click", oldOptionHandler);
    }
    btn._paletteOptionHandler = handlePaletteOptionClick;
    btn.addEventListener("click", handlePaletteOptionClick);
  });

  if (!_clickOutsideHandler) {
    _clickOutsideHandler = (e) => {
      const menu = document.getElementById("paletteMenu");
      const toggle = document.getElementById("colorPaletteToggle");
      if (menu && menu.classList.contains("open")) {
        const isPaletteOption = e.target.closest(".palette-option-btn");
        if (
          !menu.contains(e.target) &&
          toggle &&
          !toggle.contains(e.target) &&
          !isPaletteOption
        ) {
          closePaletteMenu();
        }
      }
    };
    document.addEventListener("click", _clickOutsideHandler, true);
  }
}

/**
 * Reset setup flag so the next `setupPaletteToggle()` runs full wiring.
 * Used when unloading palette (`PaletteLoaders.unloadPalette`).
 */
export function resetPaletteToggleSetup() {
  paletteToggleSetup = false;
  if (_clickOutsideHandler) {
    document.removeEventListener("click", _clickOutsideHandler, true);
    _clickOutsideHandler = null;
  }
}
