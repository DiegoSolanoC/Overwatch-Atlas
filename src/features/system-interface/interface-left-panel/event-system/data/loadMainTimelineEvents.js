/**
 * Main-timeline load (story archive).
 *   1. Try `src/data/event-system/timeline-events.json` (source of truth) with a cache-busted 10s timeout.
 *   2. Compare with localStorage `timelineEvents`.
 *
 * Selection rules:
 *   GitHub Pages           → use shipped JSON unless localStorage has strictly more rows.
 *   Localhost + file > LS  → prefer file (single extra event is enough).
 *   Localhost + LS >= file → prefer localStorage (user's saved edits stay).
 *   Localhost + LS+5 < file → assume file caught up significantly, use file.
 *   File missing           → fall back to localStorage even on GitHub Pages.
 *   Both missing           → empty list + error status.
 *
 * After the chosen branch wins, `_finishMainTimelineLoadEvents` migrates legacy filter/place shapes
 * before returning the `{ events, source, shouldSync }` descriptor.
 */

import { fetchJsonWithTimeout } from "./fetchWithTimeout.js";
import { FILES } from "../../../../../data/registry.js";
import { repairMisfiledLifecycleEventsFromFile } from "./repairMisfiledLifecycleEvents.js";
import { repairCorruptedTimelineTailFromFile } from "./repairCorruptedTimelineTailFromFile.js";
import { repairStalePlaceholderRowsFromFile } from "./repairStalePlaceholderRowsFromFile.js";
import {
  buildTimelineBundleStamp,
  clearTimelineBundleStamp,
  readStoredTimelineBundleStamp,
  readTimelineBundleStampFromMeta,
  writeTimelineBundleStamp,
} from "./timelineBundleStamp.js";

/**
 * @param {unknown[]|null} fileEvents
 */
function rememberTimelineBundleStamp(fileEvents) {
  const stamp =
    readTimelineBundleStampFromMeta() ||
    buildTimelineBundleStamp(fileEvents);
  if (stamp) writeTimelineBundleStamp(stamp);
}

/**
 * Escape hatch: `?resetTimeline=1` drops cached `timelineEvents` and reloads from the bundle.
 * @returns {boolean}
 */
function consumeResetTimelineUrlParam() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resetTimeline") !== "1") return false;
    localStorage.removeItem("timelineEvents");
    clearTimelineBundleStamp();
    params.delete("resetTimeline");
    const nextSearch = params.toString();
    const nextUrl =
      window.location.pathname +
      (nextSearch ? `?${nextSearch}` : "") +
      window.location.hash;
    window.history.replaceState(null, "", nextUrl);
    return true;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/**
 * Pure function that decides which data source wins.
 *
 * @param {any[]|null}  fileEvents     Parsed events from `events.json`, or null if unavailable.
 * @param {any[]|null}  localEvents    Parsed events from localStorage, or null if unavailable.
 * @param {boolean}     isGitHubPages  Whether we are running on GitHub Pages.
 * @param {boolean}     cacheMatchesDeploy  Whether localStorage was derived from the current
 *                                          deploy stamp (GitHub Pages only).
 * @returns {'file' | 'localStorage' | 'localStorage-wins'}
 *   - `'file'`            → use fileEvents (and reset localStorage).
 *   - `'localStorage'`    → use localEvents.
 *   - `'localStorage-wins'` → use localEvents (ties or local has more), but still check big-divergence.
 */
function _selectEventsSource(fileEvents, localEvents, isGitHubPages, cacheMatchesDeploy) {
  const fileCount = fileEvents ? fileEvents.length : 0;
  const localCount = localEvents ? localEvents.length : 0;

  if (!fileEvents || fileCount === 0) {
    // No file available — localStorage is the only option.
    return "localStorage";
  }

  if (!localEvents || localCount === 0) {
    // No localStorage — file wins by default.
    return "file";
  }

  if (isGitHubPages) {
    // Static site: the deploy stamp is authoritative. The shipped bundle carries a
    // content hash, so ANY change to the committed timeline ships a new stamp. Keep
    // the browser cache only when it was derived from this exact deploy (protects
    // live in-browser edits made between deploys); otherwise take the shipped bundle
    // — this is what makes deploys reliably override stale caches without
    // ?resetTimeline. Row count is intentionally not consulted here.
    return cacheMatchesDeploy ? "localStorage-wins" : "file";
  }

  // Deployed / disk bundle ahead of cache — pick up new timeline rows from git.
  if (fileCount > localCount) {
    return "file";
  }

  // Localhost: localStorage ties or wins — prefer user's local edits.
  // (Big-divergence catch-up is checked separately in the caller.)
  return "localStorage-wins";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** @param {import('./EventDataService.js').default} dataService */
export async function loadMainTimelineEvents(dataService) {
  let fileEvents = null;
  dataService.updateStatus(
    "EventDataService: Starting events load process...",
    "info",
  );

  // ------------------------------------------------------------------
  // 1. Fetch events.json
  // ------------------------------------------------------------------
  try {
    const data = await fetchJsonWithTimeout(FILES.eventSystem.timelineEvents);
    if (data && Array.isArray(data.events) && data.events.length > 0) {
      fileEvents = data.events;
      dataService.updateStatus(
        `EventDataService: Found ${fileEvents.length} events in events.json`,
        "success",
      );
    } else {
      console.warn(
        "EventDataService: events.json loaded but has no events array or is empty",
        data,
      );
      dataService.updateStatus(
        "EventDataService: events.json has no events array or is empty",
        "warning",
      );
    }
  } catch (error) {
    console.error(
      `EventDataService: ✗ CRITICAL - Could not load from ${FILES.eventSystem.timelineEvents}:`,
      error,
    );
    dataService.updateStatus(
      `EventDataService: events.json fetch error: ${error.message}`,
      "error",
    );
  }

  // ------------------------------------------------------------------
  // 2. Read localStorage (optional hard reset via ?resetTimeline=1)
  // ------------------------------------------------------------------
  const isGitHubPages = dataService.isGitHubPages();
  const forcedFileReset = consumeResetTimelineUrlParam();
  if (forcedFileReset) {
    // Drop every story-timeline cache so merge/export cannot keep a half-applied import.
    try {
      localStorage.removeItem("timelineEvents");
    } catch (_) {
      /* ignore */
    }
    clearTimelineBundleStamp();
    dataService._storyDockEventsSnapshot = [];
    dataService._storyDockEventsSnapshotFromLs = null;
    dataService.updateStatus(
      "EventDataService: resetTimeline=1 — cleared timelineEvents cache; loading bundled JSON",
      "warning",
    );
  }

  const savedEvents = forcedFileReset
    ? null
    : localStorage.getItem("timelineEvents");
  let localEvents = null;

  if (savedEvents) {
    try {
      localEvents = JSON.parse(savedEvents);
      dataService.updateStatus(
        `EventDataService: Found ${localEvents.length} events in localStorage`,
        "success",
      );
    } catch (error) {
      console.error("EventDataService: Error parsing saved events:", error);
      dataService.updateStatus(
        "EventDataService: Error parsing localStorage (corrupted?), trying events.json...",
        "error",
      );
      if (fileEvents && fileEvents.length > 0) {
        dataService.updateStatus(
          `EventDataService: Using events.json (${fileEvents.length} events, localStorage was corrupted)`,
          "info",
        );
        localStorage.removeItem("timelineEvents");
        dataService.events = fileEvents;
        dataService._storyDockEventsSnapshot = fileEvents.slice();
        dataService._storyDockEventsSnapshotFromLs = null;
        dataService.saveEvents({ persistToRepo: false });
        rememberTimelineBundleStamp(fileEvents);
        return dataService._finishMainTimelineLoadEvents({
          events: dataService.events,
          source: "file",
          shouldSync: true,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Decide which source wins
  // ------------------------------------------------------------------
  // On GitHub Pages the deploy stamp (content hash) is authoritative: keep the
  // cache only when it was derived from this exact shipped bundle.
  const deployedStamp = isGitHubPages
    ? readTimelineBundleStampFromMeta() || buildTimelineBundleStamp(fileEvents)
    : "";
  const storedStamp = isGitHubPages ? readStoredTimelineBundleStamp() : "";
  const cacheMatchesDeploy = Boolean(deployedStamp) && storedStamp === deployedStamp;

  const source =
    forcedFileReset && fileEvents && fileEvents.length > 0
      ? "file"
      : _selectEventsSource(
          fileEvents,
          localEvents,
          isGitHubPages,
          cacheMatchesDeploy,
        );

  if (source === "file") {
    dataService.updateStatus(
      `EventDataService: Using events.json (${fileEvents.length} events)${forcedFileReset ? " [resetTimeline]" : ""}`,
      "info",
    );
    dataService.events = fileEvents;
    dataService._storyDockEventsSnapshot = fileEvents.slice();
    dataService._storyDockEventsSnapshotFromLs = null;
    localStorage.removeItem("timelineEvents");
    // LS only — never POST load results to disk (that was overwriting git checkouts).
    dataService.saveEvents({ persistToRepo: false });
    rememberTimelineBundleStamp(fileEvents);
    return dataService._finishMainTimelineLoadEvents({
      events: dataService.events,
      source: "file",
      shouldSync: true,
    });
  }

  if (source === "localStorage" && (!localEvents || localEvents.length === 0)) {
    // Nothing from either source.
    dataService.events = [];
    console.error(
      "EventDataService: CRITICAL - No events found from events.json or localStorage!",
    );
    dataService.updateStatus(
      "EventDataService: ERROR - No events found. Check events.json file.",
      "error",
    );
    return dataService._finishMainTimelineLoadEvents({
      events: dataService.events,
      source: "none",
      shouldSync: true,
    });
  }

  // source === 'localStorage' or 'localStorage-wins'
  dataService.events = localEvents;
  dataService.updateStatus(
    `EventDataService: Using localStorage (${localEvents.length} events, user's saved changes)`,
    "info",
  );

  if (fileEvents && fileEvents.length > 0) {
    const repaired = repairMisfiledLifecycleEventsFromFile(dataService.events, fileEvents);
    if (repaired !== dataService.events) {
      dataService.events = repaired;
      dataService.updateStatus(
        "EventDataService: Repaired misfiled lifecycle rows (Siebren / Olivia) from timeline-events.json",
        "warning",
      );
      dataService.saveEvents({ persistToRepo: false });
    }

    const tailRepaired = repairCorruptedTimelineTailFromFile(dataService.events, fileEvents);
    if (tailRepaired !== dataService.events) {
      dataService.events = tailRepaired;
      dataService.updateStatus(
        "EventDataService: Restored missing tail event (Facing Demons) from timeline-events.json",
        "warning",
      );
      dataService.saveEvents({ persistToRepo: false });
    }

    const placeholdersRepaired = repairStalePlaceholderRowsFromFile(
      dataService.events,
      fileEvents,
    );
    if (placeholdersRepaired !== dataService.events) {
      dataService.events = placeholdersRepaired;
      dataService.updateStatus(
        "EventDataService: Restored blank placeholder events from timeline-events.json",
        "warning",
      );
      dataService.saveEvents({ persistToRepo: false });
    }
  }

  // Merge file metadata when counts match.
  if (fileEvents && fileEvents.length === dataService.events.length) {
    dataService.mergeTimelineMetadataFromFileEvents(fileEvents);
  }

  // Big-divergence catch-up: if file has significantly more entries the user
  // is behind — override with the file regardless of the earlier decision.
  if (fileEvents && fileEvents.length > 0) {
    const bigDivergence = fileEvents.length > dataService.events.length + 4;

    if (bigDivergence) {
      const label = isGitHubPages ? 'GitHub Pages' : 'Localhost';
      console.warn(
        `EventDataService [${label}]: localStorage has ${dataService.events.length} events, but events.json has ${fileEvents.length}. Using events.json.`,
      );
      dataService.updateStatus(
        `EventDataService: Updating from events.json (${fileEvents.length} events, localStorage had ${dataService.events.length})`,
        "warning",
      );
      dataService.events = fileEvents;
      localStorage.removeItem("timelineEvents");
      dataService.saveEvents({ persistToRepo: false });
      rememberTimelineBundleStamp(fileEvents);
      return dataService._finishMainTimelineLoadEvents({
        events: dataService.events,
        source: "file",
        shouldSync: true,
      });
    }
  }

  return dataService._finishMainTimelineLoadEvents({
    events: dataService.events,
    source: "localStorage",
    shouldSync: true,
  });
}
