/**
 * bootEventManager — bootstrap entry for the event subsystem.
 *
 * Three exports drive the load-time lifecycle of `EventManager`:
 *   - `initializeEventManager()` tears down any prior `window.eventManager`, ensures the
 *     `EventManager.js` ES module is on the page (loading it as `<script type="module">`
 *     if missing), then constructs + `init()`s a fresh instance.
 *   - `setupEventManagerListeners(em)` wires panel/button event handlers (with a retry
 *     guard in case `#eventsManagePanel` hasn't been mounted yet).
 *   - `syncEventsWithGlobe(globe, em)` thin wrapper that forwards status updates to the
 *     UI status feed while delegating actual sync to `syncEventsWithGlobeCore`.
 *
 * Internally, `createEventManagerInstance()` also lazy-loads `EventDataService` and
 * `EventInitService` via an idempotent `ensureGlobalServiceScript` helper that auto-detects
 * which event-system subfolders require `type="module"` loading.
 */

import { updateStatus } from "../../../../universal-features/atlas-mode-runtime/statusFeed.js";
import { syncEventsWithGlobeCore } from "../../../interface-load-unload/integration/syncEventsWithGlobeCore.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Tears down an existing `window.eventManager` instance, resetting all
 * tracked state before nulling the reference so a fresh instance can be
 * created cleanly.
 */
function _teardownExistingEventManager() {
  if (!window.eventManager) return;
  updateStatus("Cleaning up existing EventManager instance...", "info");
  window.eventManager.listenersSetup = false;
  window.eventManager.events = [];
  window.eventManager.cities = [];
  window.eventManager.airports = [];
  window.eventManager.seaports = [];
  window.eventManager = null;
}

/**
 * Dynamically inserts `EventManager.js` as an ES-module `<script>` tag and
 * returns a Promise that settles once the script has loaded (or failed).
 *
 * @returns {Promise<void>}
 */
async function _loadEventManagerScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "src/features/system-interface/interface-left-panel/coordinator/EventManager.js?" + Date.now();
    script.onload = resolve;
    script.onerror = () => {
      const error = new Error("Failed to load EventManager.js");
      updateStatus(`✗ ${error.message}`, "error");
      reject(error);
    };
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initializes EventManager, handling both script-tag loading and ES-module
 * scenarios.
 *
 * @returns {Promise<EventManager>} The initialized EventManager instance.
 */
export async function initializeEventManager() {
  _teardownExistingEventManager();

  updateStatus("Loading EventManager...", "info");

  const existingScript = document.querySelector(
    'script[src*="EventManager.js"]',
  );

  if (typeof window.EventManager === "undefined" && !existingScript) {
    // Script not yet on the page — inject it and wait for it to load.
    await _loadEventManagerScript();

    // ES modules assign their exports asynchronously even after `onload`.
    await new Promise((r) => setTimeout(r, 50));

    if (typeof window.EventManager === "undefined") {
      throw new Error("EventManager class not found after loading script");
    }
  } else if (typeof window.EventManager === "undefined") {
    // Script tag exists but the class hasn't been assigned yet — poll.
    updateStatus("Waiting for EventManager class to be available...", "info");
    let attempts = 0;
    while (typeof window.EventManager === "undefined" && attempts < 10) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    if (typeof window.EventManager === "undefined") {
      throw new Error("EventManager class not available after waiting");
    }
  }

  return createEventManagerInstance();
}

/**
 * Creates and initializes a new EventManager instance.
 *
 * @returns {Promise<EventManager>}
 */
async function createEventManagerInstance() {
  const ensureGlobalServiceScript = (globalKey, srcPath) =>
    new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && window[globalKey]) {
        resolve();
        return;
      }
      if (typeof document === "undefined") {
        reject(new Error(`Cannot load ${globalKey} outside browser`));
        return;
      }
      const existing = document.querySelector(`script[src*="${srcPath}"]`);
      if (existing) {
        setTimeout(() => {
          if (window[globalKey]) resolve();
          else
            reject(new Error(`${globalKey} script loaded but global missing`));
        }, 50);
        return;
      }
      const script = document.createElement("script");
      // Files in event-system subfolders that contain ES imports must load as
      // type="module"; the boot/* loader entry stays as a classic script.
      if (
        /event-system\/(data|render|form|listeners|edit|interaction|drag-drop|lookup)\//.test(
          srcPath,
        )
      ) {
        script.type = "module";
      }
      script.src = `${srcPath}?${Date.now()}`;
      script.onload = () => {
        // ES modules execute asynchronously even after `load` fires; give them a beat
        // to assign `window[globalKey]` before declaring failure.
        if (window[globalKey]) {
          resolve();
        } else {
          setTimeout(() => {
            if (window[globalKey]) resolve();
            else
              reject(
                new Error(`${globalKey} script loaded but global missing`),
              );
          }, 60);
        }
      };
      script.onerror = () => reject(new Error(`Failed to load ${srcPath}`));
      document.head.appendChild(script);
    });

  await ensureGlobalServiceScript(
    "EventDataService",
    "src/features/system-interface/interface-left-panel/event-system/data/EventDataService.js",
  );
  await ensureGlobalServiceScript(
    "EventInitService",
    "src/features/system-interface/interface-left-panel/event-system/boot/runEventManagerInit.js",
  );

  updateStatus("Creating new EventManager instance...", "info");
  const eventManager = new window.EventManager();
  updateStatus("Initializing EventManager...", "info");
  try {
    await eventManager.init();
    updateStatus("✓ EventManager initialized", "success");
    return eventManager;
  } catch (error) {
    console.error("EventManager initialization error:", error);
    updateStatus(
      `✗ EventManager initialization failed: ${error.message}`,
      "error",
    );
    throw error;
  }
}

/**
 * Sets up event listeners for EventManager with retry logic.
 *
 * @param {EventManager} eventManager - The EventManager instance
 */
export function setupEventManagerListeners(eventManager) {
  updateStatus(
    "Setting up event listeners for add/edit functionality...",
    "info",
  );

  const trySetup = () => {
    const panel = document.getElementById("eventsManagePanel");
    const addBtn = document.getElementById("addEventBtn");

    if (panel && addBtn) {
      eventManager.setupEventListeners();
      updateStatus(
        "✓ Event listeners set up - add/edit functionality ready",
        "success",
      );
      return true;
    }
    return false;
  };

  // Try immediately
  if (trySetup()) {
    return;
  }

  // Retry after short delay
  updateStatus(`⚠ Some elements not found, retrying...`, "error");
  setTimeout(() => {
    if (trySetup()) {
      updateStatus("✓ Event listeners set up (retry successful)", "success");
    } else {
      updateStatus(
        `✗ Failed to set up event listeners - elements still missing`,
        "error",
      );
    }
  }, 200);
}

/**
 * Syncs events with globe and adds markers.
 *
 * @param {Object} globeController - The globe controller instance
 * @param {EventManager} eventManager - The EventManager instance
 */
export function syncEventsWithGlobe(globeController, eventManager) {
  syncEventsWithGlobeCore(globeController, eventManager, (msg, level) =>
    updateStatus(msg, level),
  );
}
