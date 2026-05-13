/**
 * Event System Load Out service — the heavy LOAD / UNLOAD payload that mounts
 * the Filters button, Image Display toggle, pagination dock, news ticker,
 * standalone Event Slide, and (when the globe is loaded) event markers.
 *
 * Today the Event System is **always loaded at boot** (see `AppInitializer.js`),
 * so `loadEventSystem` is invoked once during the boot sequence and is not
 * normally torn down by the app shell — the Home button leaves it in place.
 * `unloadEventSystem` is retained for completeness (and exercised by the
 * Worldview kill cascade's `preserveEventsUi` guard) but no UI affordance
 * triggers it directly.
 *
 * Exposed entry points:
 *   - `loadEventSystem(testBtn?)` — mounts the full payload. `testBtn` is
 *     optional; when present it gets flipped into its "loaded" presentation
 *     (legacy main-menu button shape). At boot we pass `null`.
 *   - `unloadEventSystem(testBtn?)` — tears it all back down. Same nullable
 *     `testBtn` contract.
 */

import { updateStatus } from "../../Universal-Features/runtime/statusFeed.js";
import { lookAndAddElement } from "../../Universal-Features/ComponentSetUp/dom/lookAndAddElement.js";
import { createEventPagination } from "../dock/EventPaginationDom.js";
import { createFiltersPanel } from "../filters/filtersPanelMarkup.js";
import { createHeaderHubButton } from "../../Universal-Features/BootUp/header/HeaderHubButton.js";
import { EventMarkerManager } from "../markers/EventMarkerManager.js";
import {
  teardownMenuHelpersEventSystemLayout,
  sweepEventSystemDockOrphans,
  ensureDockGlobeRailCenterRestored,
} from "../dock/dockChromeLifecycle.js";
import { installEventSlidePlainPasteGuard } from "../info-panel/installEventSlidePlainPasteGuard.js";
import {
  installPageInputContainerReflow,
  installDockChromeRailLayout,
} from "./mountEventSystemDockChrome.js";
import { wireStandaloneFilterButtons } from "./mountEventSystemFilters.js";
import {
  readPersistedGlobalImageToggleState,
  wireGlobalImageToggleHandler,
} from "./mountGlobalImageToggle.js";
import { createStandaloneEventSlide } from "./standalone-slide/createStandaloneEventSlide.js";

installEventSlidePlainPasteGuard();

/** Promisified `setTimeout` so deferred mounts can be awaited. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves after the browser has committed layout + paint for the next
 * frame, so callers can trust that the DOM mutations they just made are
 * actually on screen before they fire follow-up work.
 */
const nextPaintCommitted = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

/**
 * LOAD path — mount the full Event System Load Out:
 *   - Filters button + Filters panel
 *   - Image Display toggle
 *   - Pagination dock and slider
 *   - News ticker
 *   - Event markers on the globe / map (when the globe is loaded)
 * Then, if a `testBtn` was supplied, flip it into its "loaded" presentation.
 *
 * `body.event-system-loaded` is the canonical "the system is up" signal —
 * predicates and resize handles read it instead of poking at the legacy
 * button.
 *
 * @param {HTMLButtonElement|null} [testBtn] - Optional legacy main-menu
 *   button to flip into its "loaded" presentation.
 */
export async function loadEventSystem(testBtn) {
  updateStatus("Loading Event System...", "info");
  try {
    teardownMenuHelpersEventSystemLayout();
    sweepEventSystemDockOrphans();

    createHeaderHubButton({
      id: "filtersToggle",
      className: "dock-globe-rail__btn",
      title: "Open Filters",
      label: "Filters",
      iconPath: "src/assets/images/Icons/Filter%20Icons/Filter%20Icon.png",
      iconAlt: "Filters",
      parentId: "dockGlobeRailCenter",
      baseClass: "globe-control-btn",
      headerOrder: 5,
      mobileParentId: "dockGlobeRailLeft",
      mobileBaseClass: "globe-control-btn",
      mobileClassName: "dock-globe-rail__btn",
    });

    const globalImageToggleState = readPersistedGlobalImageToggleState();
    createHeaderHubButton({
      id: "globalImageToggle",
      className: "dock-globe-rail__btn",
      title: "Toggle Image Display",
      label: globalImageToggleState ? "Image On" : "Image Off",
      iconPath:
        "src/assets/images/Icons/Utility%20Icons/Image%20Display%20Icon.png",
      iconAlt: "Images",
      parentId: "dockGlobeRailCenter",
      baseClass: "globe-control-btn",
      headerOrder: 6,
      mobileParentId: "dockGlobeRailLeft",
      mobileBaseClass: "globe-control-btn",
      mobileClassName: "dock-globe-rail__btn",
    });
    await wait(100);
    wireGlobalImageToggleHandler(globalImageToggleState);

    installPageInputContainerReflow();

    // Initialize EventManager if not already loaded
    if (!window.eventManager) {
      const { initializeEventManager } =
        await import("../event-system/boot/bootEventManager.js");
      window.eventManager = await initializeEventManager();
    }

    // Initialize FlashButtonHelper for Event System (works in all modes)
    if (!window.flashButton) {
      await import("../utils/dialogs/flashButton.js");
    }

    // Initialize EventMarkerManager for Globe (if Globe is loaded)
    if (window.globeController?.sceneModel && !window.globeEventMarkerManager) {
      updateStatus("Initializing event markers...", "info");
      window.globeEventMarkerManager = new EventMarkerManager(
        window.globeController.sceneModel,
        window.globeController.dataModel,
      );
      // Add event markers to the globe
      await window.globeEventMarkerManager.addEventMarkers(true);
      updateStatus("Event markers added", "success");
    }

    // Add timeline-loaded class to footer (enables background + Atlas News logo)
    const footer = document.querySelector("footer");
    if (footer) {
      footer.classList.add("timeline-loaded");
    }

    // Initialize news ticker
    if (!window.newsTickerService) {
      window.newsTickerService = new window.NewsTickerService();
    }
    window.newsTickerService.init();

    // Update ticker with all events
    const events = window.eventManager.events || [];
    window.newsTickerService.updateTicker(events);

    // Wire up Event Manager panel controls (no dock toggle � list via Data Archive)
    if (window.eventManager && !window.eventManager.listenersSetup) {
      window.eventManager.setupEventListeners();
    }

    // Create pagination dock for standalone mode
    lookAndAddElement(
      "eventPagination",
      () => {
        updateStatus("Creating pagination dock...", "info");
        return createEventPagination();
      },
      "Pagination dock",
    );

    // Wait for the pagination dock DOM to settle, then run the full rail layout.
    await wait(200);
    installDockChromeRailLayout();

    // Create filters panel for standalone mode (decoupled from globe)
    lookAndAddElement(
      "filtersPanel",
      () => {
        updateStatus("Creating filters panel...", "info");
        return createFiltersPanel();
      },
      "Filters panel",
    );

    // Initialize FilterService for standalone mode. `init()` is
    // async (awaits the manifest fetch + initial heroes-tab
    // button render) so we await it here — otherwise the
    // filter chips would populate visibly after the boot mask
    // drops.
    if (
      window.FilterService &&
      typeof window.FilterService.init === "function"
    ) {
      await window.FilterService.init();
      updateStatus("Filter panel initialized", "success");
    }

    if (!window.standaloneActiveFilters) {
      window.standaloneActiveFilters = new Set();
    }

    wireStandaloneFilterButtons();

    const filtersToggle = document.getElementById("filtersToggle");
    if (filtersToggle) {
      filtersToggle.style.setProperty("display", "flex", "important");
    }

    // Initialize standalone Event Slide (decoupled from globe)
    if (!window.standaloneEventSlide) {
      window.standaloneEventSlide = createStandaloneEventSlide();

      const backBtnInit = document.getElementById("eventSlideBack");
      if (backBtnInit && !backBtnInit.dataset.slideNavBound) {
        backBtnInit.dataset.slideNavBound = "1";
        backBtnInit.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.standaloneEventSlide?.goBackSlide) {
            await window.standaloneEventSlide.goBackSlide();
          }
        });
      }

      // Wire up Event Manager list clicks (index is into the *active* archive list, not the dock timeline)
      window.eventManager.openEventFromList = function (event, index) {
        if (window.standaloneEventSlide) {
          const list = window.eventManager?.events || [];
          let idx = typeof index === "number" ? index : list.indexOf(event);
          if (idx < 0 || idx >= list.length) idx = list.indexOf(event);
          if (idx < 0 || idx >= list.length) return;
          window.standaloneEventSlide.showEvent(idx, { eventList: list });
          if (window.SoundEffectsManager?.play) {
            window.SoundEffectsManager.play("eventClick");
          }
        }
      };

      // Setup standalone pagination dock (wait for dock to be created)
      if (window.standaloneEventSlide?.setupStandalonePagination) {
        await wait(200);
        window.standaloneEventSlide.setupStandalonePagination();
      }
    }

    // Final paint flush so the loading overlay only drops after the
    // browser has actually committed everything we just mounted.
    await nextPaintCommitted();

    if (testBtn) {
      testBtn.dataset.loaded = "true";
      testBtn.textContent = "UNLOAD Event System Load Out";
      testBtn.style.background = "#c93439";
    }
    document.body.classList.add("event-system-loaded");
    updateStatus("Event System loaded", "success");
  } catch (error) {
    console.error("Error loading Event System:", error);
    updateStatus(`Error: ${error.message}`, "error");
  }
}

/**
 * UNLOAD path — tear down everything LOAD set up:
 *   - Remove the dock, pagination strip, filters panel/button, image toggle
 *   - Clear the news ticker, close the event slide and overlays
 *   - Reset standalone filters and the standalone event slide proxy
 * Then, if a `testBtn` was supplied, flip it back to its "load" presentation.
 *
 * @param {HTMLButtonElement|null} [testBtn] - Optional legacy main-menu
 *   button to flip back to its "load" presentation.
 */
export async function unloadEventSystem(testBtn) {
  updateStatus("Unloading Event System...", "info");
  teardownMenuHelpersEventSystemLayout();

  // Clear news ticker
  if (window.newsTickerService) {
    window.newsTickerService.clear();
  }

  // Remove timeline-loaded class from footer
  const footer = document.querySelector("footer");
  if (footer) {
    footer.classList.remove("timeline-loaded");
  }

  document.getElementById("eventsManageToggle")?.remove();

  // Close event slide panel if open
  const eventSlide = document.getElementById("eventSlide");
  if (eventSlide) {
    eventSlide.classList.remove("open");
  }

  // Hide image overlay if open
  const eventImageOverlay = document.getElementById("eventImageOverlay");
  if (eventImageOverlay) {
    eventImageOverlay.classList.remove("open");
  }

  // Clean up standalone event slide
  window.standaloneEventSlide = null;

  // Remove pagination dock (includes eventPagination inside it)
  const paginationDock = document.getElementById("paginationDock");
  if (paginationDock) {
    paginationDock.remove();
  }
  const paginationDockCollapseStrip = document.getElementById(
    "paginationDockCollapseStrip",
  );
  if (paginationDockCollapseStrip) {
    paginationDockCollapseStrip.remove();
  }
  // Also explicitly remove eventPagination if it exists outside the dock
  const eventPagination = document.getElementById("eventPagination");
  if (eventPagination) {
    eventPagination.remove();
  }
  // Clear eventNumberButtons content to prevent duplicate thumbnails
  const eventNumberButtons = document.getElementById("eventNumberButtons");
  if (eventNumberButtons) {
    eventNumberButtons.innerHTML = "";
  }

  document.getElementById("globalImageToggle")?.remove();
  document
    .querySelectorAll(".page-input-container")
    .forEach((el) => el.remove());
  ensureDockGlobeRailCenterRestored();

  // Close events manage panel if open
  const eventsManagePanel = document.getElementById("eventsManagePanel");
  if (eventsManagePanel) {
    eventsManagePanel.classList.remove("open");
  }

  // Clear events list
  const eventsList = document.getElementById("eventsList");
  if (eventsList) {
    eventsList.innerHTML = "";
  }

  // Remove event manager listeners flag so it can be re-initialized
  if (window.eventManager) {
    window.eventManager.listenersSetup = false;
  }

  // Cleanup SummaryInfoBadge (reset module state)
  if (window.SummaryInfoBadge?.cleanup) {
    window.SummaryInfoBadge.cleanup();
  }

  // Clear standalone filters
  if (window.standaloneActiveFilters) {
    window.standaloneActiveFilters.clear();
  }
  if (window.FilterService?.stateManager) {
    window.FilterService.stateManager.clear();
  }
  if (window.FilterService?.reset) {
    window.FilterService.reset();
  }

  // Remove filters toggle button
  const filtersToggle = document.getElementById("filtersToggle");
  if (filtersToggle) {
    filtersToggle.remove();
  }

  // Close and remove filters panel
  const filtersPanel = document.getElementById("filtersPanel");
  if (filtersPanel) {
    filtersPanel.classList.remove("open");
    filtersPanel.remove();
  }

  if (testBtn) {
    testBtn.dataset.loaded = "false";
    testBtn.textContent = "LOAD Event System Load Out";
    testBtn.style.background = "#333";
  }
  document.body.classList.remove("event-system-loaded");
  updateStatus("Event System unloaded", "success");
}
