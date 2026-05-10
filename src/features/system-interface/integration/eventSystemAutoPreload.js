/**
 * eventSystemAutoPreload — bridge between mode-entry flows and the Event
 * System ("Load Out").
 *
 * The Event System is a separate heavy feature that the user can opt to
 * preload before entering a mode (so markers / event slides are ready
 * the moment the globe paints). Two questions get asked from the
 * orchestrator and from `loadGlobeAssets`:
 *
 *   - **`isEventSystemLoadOutActive()`** — is the Event System fully up
 *     right now? Used to decide whether to skip an unload (Globe kill
 *     leaves the events UI in place if it's still active) and whether to
 *     mount event markers after a Globe boot.
 *
 *   - **`autoPreloadEventSystemIfEnabled()`** — if the user ticked the
 *     "Auto preload Event System" checkbox in the menu, click `#testBtn`
 *     before mode entry begins and wait until the system is up (or 5s
 *     timeout). Returns `true` if it's safe to proceed with mode entry,
 *     `false` only on timeout.
 *
 * Lives in `system-interface/integration/` — the orchestrator owns mode
 * lifecycle, but the predicate / auto-load that pokes at the Event
 * System's own DOM (`#testBtn`, `#filtersPanel`, `#paginationDock`,
 * `window.eventManager`) belongs with the System Interface feature.
 */

import { showLoadingOverlay, hideLoadingOverlay } from '../../universal-features/runtime/loadingOverlayState.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

const AUTO_PRELOAD_POLL_INTERVAL_MS = 100;
const AUTO_PRELOAD_MAX_ATTEMPTS = 50; // 5s total
const POST_LOAD_SETTLE_MS = 200;

/**
 * Snapshot check: are the Event System DOM + data both up?
 *
 * The Event System is "active" when the test button reports loaded, the
 * event manager has events + listeners, and at least one of its UI hosts
 * (filters panel, pagination dock, filters toggle) is in the DOM.
 *
 * @returns {boolean}
 */
export function isEventSystemLoadOutActive() {
    const testBtn = document.getElementById('testBtn');
    const isLoaded = testBtn?.dataset.loaded === 'true';
    const hasEventManager = window.eventManager?.events?.length > 0;
    const hasListeners = window.eventManager?.listenersSetup === true;
    const hasUI =
        !!document.getElementById('filtersPanel') ||
        !!document.getElementById('paginationDock') ||
        !!document.getElementById('filtersToggle');
    return isLoaded && hasEventManager && hasListeners && hasUI;
}

/**
 * If the user has "auto preload Event System" enabled, click `#testBtn`
 * and wait until the system reports loaded (or timeout). Designed to be
 * awaited at the top of a mode-entry flow.
 *
 * @returns {Promise<boolean>} `true` if it's safe to continue mode entry
 *   (auto-preload off, already loaded, or completed in time). `false`
 *   only if auto-preload was on and the load timed out.
 */
export async function autoPreloadEventSystemIfEnabled() {
    const autoPreloadEnabled = localStorage.getItem('autoPreloadEventSystem') === 'true';
    if (!autoPreloadEnabled) return true;

    if (isEventSystemLoadOutActive()) return true;

    const testBtn = document.getElementById('testBtn');
    if (!testBtn) return true;

    console.log('[eventSystemAutoPreload] Auto-preloading Event System...');
    showLoadingOverlay();
    updateStatus('→ Auto-loading Event System...', 'info');

    testBtn.click();

    let attempts = 0;
    while (!isEventSystemLoadOutActive() && attempts < AUTO_PRELOAD_MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, AUTO_PRELOAD_POLL_INTERVAL_MS));
        attempts++;
    }

    if (isEventSystemLoadOutActive()) {
        console.log('[eventSystemAutoPreload] Event System auto-loaded successfully');
        updateStatus('✓ Event System auto-loaded', 'success');
        await new Promise(r => setTimeout(r, POST_LOAD_SETTLE_MS));
        // Caller drops the overlay when its own mode entry finishes.
        return true;
    }

    console.warn('[eventSystemAutoPreload] Event System auto-load timed out');
    updateStatus('⚠ Event System auto-load timed out', 'warning');
    hideLoadingOverlay();
    return false;
}
