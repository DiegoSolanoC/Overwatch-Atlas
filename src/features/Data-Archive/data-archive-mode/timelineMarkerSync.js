/**
 * Timeline ↔ worldview marker sync (Event System Load Out).
 * Story markers on the globe/map are owned by {@link EventMarkerManager} at
 * {@link window.globeEventMarkerManager}, not by {@link GlobeView}.
 */
(function attachTimelineMarkerSync(global) {
    'use strict';

    /**
     * @param {boolean} [animate=true]
     * @param {object} [options]
     * @returns {unknown}
     */
    function refreshTimelineEventMarkers(animate, options) {
        var a = animate === undefined ? true : animate;
        var mm = global.globeEventMarkerManager;
        if (mm && typeof mm.refreshEventMarkers === 'function') {
            return mm.refreshEventMarkers(a, options || {});
        }
        return undefined;
    }

    /**
     * @param {{ dataModel?: { events?: unknown } }|null|undefined} globeController
     * @param {unknown[]} events
     */
    function copyEventsToGlobeDataModel(globeController, events) {
        if (!globeController || !globeController.dataModel || !Array.isArray(events)) {
            return;
        }
        globeController.dataModel.events = events.slice();
    }

    global.TimelineMarkerSync = {
        refreshTimelineEventMarkers: refreshTimelineEventMarkers,
        copyEventsToGlobeDataModel: copyEventsToGlobeDataModel
    };
})(typeof window !== 'undefined' ? window : globalThis);
