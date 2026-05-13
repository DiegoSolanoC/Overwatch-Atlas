/**
 * Data Archive category hub chrome: hide main menu / Event Manager rail,
 * Escape-to-exit while the hub (not the embedded list) is visible.
 *
 * Used by `archive-mode` (orchestrated session) and optionally by
 * `category-hub-manager` (standalone hub) — one Escape listener at a time.
 */

import { eventsPanelMountedInStoryArchive } from "../archive-support/environment-checks.js";
import { archiveModeSession } from "./sessionState.js";

/** @type {((e: KeyboardEvent) => void) | null} */
let hubEscapeKeyHandler = null;

function clearHubEscapeKey() {
  if (hubEscapeKeyHandler) {
    document.removeEventListener("keydown", hubEscapeKeyHandler);
    hubEscapeKeyHandler = null;
  }
  archiveModeSession.storyArchiveHubKeyHandler = null;
}

/** Shared setup when entering Data Archive (menu hidden, Event Manager rail hidden). */
export function prepareStoryArchiveShell() {
  const testContainer = document.querySelector(".test-container");
  if (testContainer) {
    testContainer.style.display = "none";
  }
  const eventManagerBtn = document.getElementById("eventsManageToggle");
  if (eventManagerBtn) {
    eventManagerBtn.style.setProperty("display", "none", "important");
  }
  const eventsManagePanel = document.getElementById("eventsManagePanel");
  if (eventsManagePanel) {
    eventsManagePanel.classList.remove("open");
  }
}

export function detachStoryArchiveHubDismissChrome() {
  clearHubEscapeKey();
}

/**
 * Escape exits the category hub when the embedded list is not active.
 * Use when `archiveModeSession.onExitMode` is not set (e.g. standalone hub).
 *
 * @param {(restoreMenu?: boolean) => void | Promise<void>} onExit
 * @param {() => boolean} [shouldIgnoreEscape] Return true to keep Escape inert (default: list embedded in archive).
 */
/**
 * Shared factory: builds and attaches a keydown Escape handler.
 * @param {() => unknown} getCallback - Returns the function to call on Escape.
 * @param {() => boolean} shouldIgnore - Return true to suppress Escape.
 */
function _buildAndAttachEscapeHandler(getCallback, shouldIgnore) {
  clearHubEscapeKey();
  const fn = (e) => {
    if (e.key !== "Escape") return;
    if (shouldIgnore()) return;
    e.preventDefault();
    const cb = getCallback();
    if (typeof cb === "function") {
      void cb(true);
    }
  };
  hubEscapeKeyHandler = fn;
  archiveModeSession.storyArchiveHubKeyHandler = fn;
  document.addEventListener("keydown", fn);
}

export function attachCategoryHubEscapeChrome(
  onExit,
  shouldIgnoreEscape = () => eventsPanelMountedInStoryArchive(),
) {
  _buildAndAttachEscapeHandler(() => onExit, shouldIgnoreEscape);
}

/** Escape exits Data Archive when the category hub is showing (orchestrated mode uses session callback). */
export function attachStoryArchiveHubDismissChrome() {
  _buildAndAttachEscapeHandler(
    () => archiveModeSession.onExitMode,
    () => eventsPanelMountedInStoryArchive(),
  );
}
