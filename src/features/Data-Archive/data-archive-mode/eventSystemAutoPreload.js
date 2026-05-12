/**
 * eventSystemAutoPreload — predicate the orchestrator and `loadGlobeAssets`
 * use to decide "is the Event System Load Out fully up?".
 *
 * Today the Load Out is mounted unconditionally during the boot sequence
 * (`AppInitializer.js → loadEventSystem(null)`), so this predicate
 * effectively flips to `true` once boot finishes. It still earns its keep:
 *
 *   - `loadGlobeAssets.mountEventMarkersIfNeeded` calls in to confirm the
 *     events UI is live before constructing globe markers (avoids a race
 *     during very early Worldview entry).
 *   - `globeModeLifecycle.killGlobeMode` calls in to skip the legacy
 *     events-loader unload step when the Load Out is up — it would be a
 *     no-op anyway, but keeping the guard documents intent.
 *
 * The historical `autoPreloadEventSystemIfEnabled()` helper is gone now
 * that there is no opt-in checkbox; the function used to click `#testBtn`
 * and wait for it to flip into "loaded" state.
 */

/**
 * Snapshot check: are the Event System DOM + data both up?
 *
 * @returns {boolean}
 */
export function isEventSystemLoadOutActive() {
    const bodyFlag = typeof document !== 'undefined'
        && document.body?.classList?.contains('event-system-loaded');
    const hasEventManager = window.eventManager?.events?.length > 0;
    const hasListeners = window.eventManager?.listenersSetup === true;
    const hasUI =
        !!document.getElementById('filtersPanel') ||
        !!document.getElementById('paginationDock') ||
        !!document.getElementById('filtersToggle');
    return !!bodyFlag && hasEventManager && hasListeners && hasUI;
}
