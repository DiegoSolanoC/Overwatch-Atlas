/**
 * ExitButton — creates the absolute-positioned exit button shown inside heavy
 * modes (Globe / Codex / Bios) and wires its click handler.
 *
 * Clicking it: plays the mode-switch SFX, clears the persisted current mode,
 * and awaits the caller-supplied `killGlobeComponents` (or equivalent kill
 * routine) under the run-operation flag so the loading overlay is held for
 * the full teardown.
 *
 * Sole consumer: `BootUp/loaders/ControlsLoaders.js`.
 */

import { updateStatus } from "../atlas-mode-runtime/statusFeed.js";
import {
  showLoadingOverlay,
  hideLoadingOverlay,
} from "../atlas-mode-runtime/loadingOverlayState.js";
import { clearCurrentMode } from "../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js";
import { playModeSwitchSound } from "../atlas-sound-effects/playModeSwitchSound.js";

function _buildExitButtonElement() {
  const exitBtn = document.createElement("button");
  exitBtn.id = "exitButton";
  exitBtn.className = "globe-control-btn exit-btn";
  exitBtn.title = "Exit to Main Menu";
  exitBtn.innerHTML = `
        <span id="exitIcon">
            <img src="src/assets/images/Icons/Mode%20Icons/Home%20Button.png" alt="Exit" style="width: 100%; height: 100%; object-fit: contain;">
        </span>
    `;
  return exitBtn;
}

function _attachExitClickHandler(
  exitBtn,
  setIsRunOperation,
  killGlobeComponents,
) {
  exitBtn.addEventListener("click", async function () {
    setIsRunOperation(true);
    showLoadingOverlay();

    playModeSwitchSound(false);

    clearCurrentMode();
    updateStatus("Exiting to main menu...", "info");

    try {
      await killGlobeComponents();
    } catch (error) {
      console.error("[Exit Button] Error in killGlobeComponents:", error);
    } finally {
      setIsRunOperation(false);
      hideLoadingOverlay();
    }
  });
}

/**
 * Creates and sets up the exit button.
 * @param {Function} setIsRunOperation - Function to set run operation flag
 * @param {Function} killGlobeComponents - Function to kill globe components
 * @returns {HTMLElement|null} - The created exit button or null if content element missing
 */
export function createExitButton(setIsRunOperation, killGlobeComponents) {
  if (document.getElementById("exitButton")) {
    return document.getElementById("exitButton");
  }

  const contentEl = document.getElementById("content");
  if (!contentEl) {
    console.error("[Exit Button] Content element not found!");
    updateStatus("✗ Error: Content element not found for exit button", "error");
    return null;
  }

  const exitBtn = _buildExitButtonElement();
  contentEl.appendChild(exitBtn);
  _attachExitClickHandler(exitBtn, setIsRunOperation, killGlobeComponents);
  updateStatus("✓ Exit button added", "success");

  return exitBtn;
}
