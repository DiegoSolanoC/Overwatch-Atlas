/**
 * Wires every button on the Event Manager panel chrome:
 *   - Open/close toggle (`#eventsManageToggle`) — also closes music/filters panels.
 *   - Close button (`#eventsManageClose`).
 *   - Add (`#addEventBtn`), Save (`#saveEventsBtn`), Export (`#exportEventsBtn`),
 *     Import (`#importEventsBtn` + `#importEventsFile`).
 *
 * On static deploy (GitHub Pages), Add / Save / Export / Import stay available in Story
 * Timeline and Data Workshop bio archives (localStorage + JSON handoff).
 *
 * The toggle button is **cloned to drop existing listeners** before re-attaching to avoid
 * double-firing on hot reloads / re-renders. After cloning, the function looks the panel up
 * again because the clone wipes any previously cached node reference.
 *
 * Side effect: sets `eventManager.listenersSetup = true` on success so re-entry is a no-op.
 */

import { dismissAllPanelsExcept } from "../../../interface-shared/dismissAllPanelsExcept.js";
import {
  isArchiveImportExportEnabled,
  isArchiveStructuralEditingEnabled,
} from "../../../interface-info-display/isEventSlideEditDevHost.js";

/**
 * Show/hide Add / Save / Export / Import based on the active archive + host.
 * Call after switching archive source (e.g. Data Workshop category change).
 */
export function syncArchiveManagePanelActionVisibility() {
  const canMutateStructure = isArchiveStructuralEditingEnabled();
  const canImportExport = isArchiveImportExportEnabled();
  const addBtn = document.getElementById("addEventBtn");
  const saveBtn = document.getElementById("saveEventsBtn");
  const exportBtn = document.getElementById("exportEventsBtn");
  const importBtn = document.getElementById("importEventsBtn");
  const importFileInput = document.getElementById("importEventsFile");
  if (addBtn) addBtn.style.display = canMutateStructure ? "" : "none";
  if (saveBtn) saveBtn.style.display = canImportExport ? "" : "none";
  if (exportBtn) exportBtn.style.display = canImportExport ? "" : "none";
  if (importBtn) importBtn.style.display = canImportExport ? "" : "none";
  if (importFileInput) {
    importFileInput.style.display = canImportExport ? "" : "none";
  }
}

/**
 * @param {HTMLElement} el
 * @param {string} key
 * @param {(ev: Event) => void} handler
 */
function wireManageButtonOnce(el, key, handler) {
  if (!el || el.dataset[key] === "1") return;
  el.dataset[key] = "1";
  el.addEventListener("click", handler);
}

/**
 * @param {any} listenerService  Owning EventListenerService instance (carries `this.eventManager`).
 * @param {{ panel: HTMLElement, toggleBtn: HTMLElement|null, closeBtn: HTMLElement|null }} dom
 */
export function wireManagePanelButtons(
  listenerService,
  { panel, toggleBtn, closeBtn },
) {
  const { eventManager } = listenerService;
  if (!eventManager) return;

  if (toggleBtn) {
    toggleBtn.style.display = "";
    toggleBtn.style.visibility = "visible";
    toggleBtn.style.opacity = "1";
  }

  if (toggleBtn && panel) {
    // Clone-and-replace strips any prior listeners so a re-init can't double-fire.
    const toggleBtnClone = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(toggleBtnClone, toggleBtn);
    const newToggleBtn = document.getElementById("eventsManageToggle");

    const currentPanel = document.getElementById("eventsManagePanel");
    if (!currentPanel) {
      console.error(
        "EventListenerService: eventsManagePanel not found after button setup",
      );
      return;
    }

    newToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      dismissAllPanelsExcept("eventsManagePanel");

      if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play("eventManager");
      }

      const wasOpen = currentPanel.classList.contains("open");
      currentPanel.classList.toggle("open");
      const isNowOpen = currentPanel.classList.contains("open");

      if (isNowOpen) {
        try {
          window.SummaryInfoBadge?.hide();
        } catch (_) {}
        newToggleBtn.classList.add("active");
        if (eventManager.renderEvents) {
          eventManager.renderService?.requestPageEntranceAnimation?.();
          eventManager.renderEvents();
        }
      } else {
        if (wasOpen && eventManager.resetAllEventVariants) {
          eventManager.resetAllEventVariants();
        }
        newToggleBtn.classList.remove("active");
      }
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => {
      if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play("eventManager");
      }
      if (eventManager.resetAllEventVariants) {
        eventManager.resetAllEventVariants();
      }
      panel.classList.remove("open");
      try {
        window.SummaryInfoBadge?.hide();
      } catch (_) {}
      const liveToggleBtn = document.getElementById("eventsManageToggle");
      if (liveToggleBtn) liveToggleBtn.classList.remove("active");
    });
  }

  const addBtn = document.getElementById("addEventBtn");
  if (addBtn) {
    wireManageButtonOnce(addBtn, "atlasAddWired", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (eventManager.addBlankEventAndOpen) eventManager.addBlankEventAndOpen();
    });
  } else {
    console.warn(
      "EventListenerService: addEventBtn not found! Make sure events-manage-panel HTML exists.",
    );
  }

  const saveBtn = document.getElementById("saveEventsBtn");
  if (saveBtn) {
    wireManageButtonOnce(saveBtn, "atlasSaveWired", () => {
      if (eventManager.saveEvents) eventManager.saveEvents();
    });
  }

  const exportBtn = document.getElementById("exportEventsBtn");
  if (exportBtn) {
    wireManageButtonOnce(exportBtn, "atlasExportWired", () => {
      if (eventManager.exportEvents) eventManager.exportEvents();
    });
  }

  const importBtn = document.getElementById("importEventsBtn");
  const importFileInput = document.getElementById("importEventsFile");
  if (importBtn) {
    wireManageButtonOnce(importBtn, "atlasImportWired", () => {
      importFileInput?.click();
    });
  }
  if (importFileInput && importFileInput.dataset.atlasImportFileWired !== "1") {
    importFileInput.dataset.atlasImportFileWired = "1";
    importFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file && eventManager.importEvents) {
        eventManager.importEvents(file);
        e.target.value = "";
      }
    });
  }

  syncArchiveManagePanelActionVisibility();
}
