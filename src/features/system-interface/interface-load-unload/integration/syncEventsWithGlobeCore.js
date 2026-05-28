/**
 * Shared implementation: copy {@link EventManager} events into {@link GlobeController#dataModel}
 * and refresh markers via {@link window.TimelineMarkerSync} / {@link window.globeEventMarkerManager}.
 *
 * @param {import('../../world/worldview-controls-ui/controllers/WorldviewGlobeController.js').GlobeController|null|undefined} globeController
 * @param {{ events?: unknown[] }|null|undefined} eventManager
 * @param {(message: string, level?: string) => void} [notify]
 */
export function syncEventsWithGlobeCore(globeController, eventManager, notify) {
    if (!globeController || !eventManager) {
        return;
    }

    const say = typeof notify === 'function' ? notify : () => {};
    say('Syncing events with globe...', 'info');

    const T = typeof window !== 'undefined' ? window.TimelineMarkerSync : null;
    const events = eventManager.events;
    if (T && typeof T.copyEventsToGlobeDataModel === 'function') {
        T.copyEventsToGlobeDataModel(globeController, events);
    } else if (globeController.dataModel && Array.isArray(events)) {
        globeController.dataModel.events = [...events];
    }
    if (T && typeof T.refreshTimelineEventMarkers === 'function') {
        T.refreshTimelineEventMarkers();
    }

    const ui = globeController.uiView;
    if (ui && typeof ui.setupEventPagination === 'function') {
        ui.setupEventPagination(() => {
            if (T && typeof T.refreshTimelineEventMarkers === 'function') {
                T.refreshTimelineEventMarkers(true, { preservePaginationThumbEntrance: true });
            }
        });
    }
    if (ui && typeof ui.setupEventNumberButtons === 'function') {
        ui.setupEventNumberButtons(() => {
            if (T && typeof T.refreshTimelineEventMarkers === 'function') {
                T.refreshTimelineEventMarkers();
            }
        });
    }

    say('OK: Events synced with globe and markers updated', 'success');
}
