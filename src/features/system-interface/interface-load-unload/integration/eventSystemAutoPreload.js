/**
 * Event System + Worldview load-out guard (`system-interface/interface-load-unload/integration/`, not Data Archive).
 * - This file: {@link isEventSystemLoadOutActive} — body class guard for loaders/teardown.
 * - `timelineMarkerSync.js` (classic script in index.html) — installs `window.TimelineMarkerSync`.
 * - `syncEventsWithGlobeCore.js` — copies EventManager events into the globe data model.
 *
 * For the Data Archive **app mode** (category hub, embedded panel), see `Data-Archive/archive-mode/`.
 */
export function isEventSystemLoadOutActive() {
    return typeof document !== 'undefined'
        && document.body?.classList?.contains('event-system-loaded');
}
