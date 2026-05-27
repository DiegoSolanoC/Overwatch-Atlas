/**
 * Wires every button on the Event Manager panel chrome:
 *   - Open/close toggle (`#eventsManageToggle`) — also closes music/filters panels.
 *   - Close button (`#eventsManageClose`).
 *   - Add (`#addEventBtn`), Save (`#saveEventsBtn`), Export (`#exportEventsBtn`),
 *     Import (`#importEventsBtn` + `#importEventsFile`).
 *
 * GitHub Pages disables every "modifying" button (add/save/export/import). Read-only
 * deployments only get the open/close pair.
 *
 * The toggle button is **cloned to drop existing listeners** before re-attaching to avoid
 * double-firing on hot reloads / re-renders. After cloning, the function looks the panel up
 * again because the clone wipes any previously cached node reference.
 *
 * Side effect: sets `eventManager.listenersSetup = true` on success so re-entry is a no-op.
 */

import { dismissAllPanelsExcept } from "../../../interface-shared/dismissAllPanelsExcept.js";

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

  const isGitHubPages = eventManager.isGitHubPages
    ? eventManager.isGitHubPages()
    : false;

  // ------------------------------------------------------------------------
  // Add / Save / Export / Import (all hidden on read-only GitHub Pages builds)
  // ------------------------------------------------------------------------

  const addBtn = document.getElementById("addEventBtn");
  if (addBtn) {
    if (isGitHubPages) {
      addBtn.style.display = "none";
    } else {
      const addBtnClone = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(addBtnClone, addBtn);
      const newAddBtn = document.getElementById("addEventBtn");
      newAddBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (eventManager.addBlankEventAndOpen)
          eventManager.addBlankEventAndOpen();
      });
    }
  } else {
    console.warn(
      "EventListenerService: addEventBtn not found! Make sure events-manage-panel HTML exists.",
    );
  }

  const saveBtn = document.getElementById("saveEventsBtn");
  if (saveBtn) {
    if (isGitHubPages) {
      saveBtn.style.display = "none";
    } else {
      saveBtn.addEventListener("click", () => {
        if (eventManager.saveEvents) eventManager.saveEvents();
      });
    }
  }

  const exportBtn = document.getElementById("exportEventsBtn");
  if (exportBtn) {
    if (isGitHubPages) {
      exportBtn.style.display = "none";
    } else {
      exportBtn.addEventListener("click", () => {
        if (eventManager.exportEvents) eventManager.exportEvents();
      });
    }
  }

  const importBtn = document.getElementById("importEventsBtn");
  const importFileInput = document.getElementById("importEventsFile");
  if (importBtn && importFileInput) {
    if (isGitHubPages) {
      importBtn.style.display = "none";
      importFileInput.style.display = "none";
    } else {
      importBtn.addEventListener("click", () => {
        importFileInput.click();
      });
      importFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && eventManager.importEvents) {
          eventManager.importEvents(file);
          // Reset value so the same file can be re-imported.
          e.target.value = "";
        }
      });
    }
  }
}
