/**
 * Marker lookup helpers — find an existing event marker (WebGL or DOM)
 * for a given event, and synthesize a stub when no real DOM marker exists.
 *
 * Used by dock thumbnails to drive marker hover/highlight/zoom effects from
 * the event pagination strip. Works in both globe view (Three.js markers from
 * SceneModel.getMarkers()) and map view (DOM markers from Map2DLiteLayer).
 *
 * Extracted from main-menu/event-system-load-out/EventSystemLoadOut.js.
 */

/**
 * Build a stub marker that mimics the shape of a real Map2DLiteLayer marker,
 * for use when the requested event has no rendered DOM marker yet
 * (e.g. its location group isn't currently mounted).
 */
export function createStubForMapView(event, _globalEventIndex) {
    if (!event) return null;

    const filters = window.standaloneActiveFilters || new Set();
    const locked = filters.size > 0 && window.MarkerCreationHelpers?.shouldEventBeLocked
        ? window.MarkerCreationHelpers.shouldEventBeLocked(event, filters)
        : false;

    const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
    const displayEvent = isMultiEvent && event.variants[0]
        ? { ...event, ...event.variants[0] }
        : event;

    return {
        userData: {
            isEventMarker: true,
            isInteractive: true,
            isLocked: locked,
            event: event,
            eventName: displayEvent.name || event.name,
            locationType: displayEvent.locationType || event.locationType || 'earth',
            variantIndex: 0,
            isMainVariant: true,
            originalColor: window.MarkerCreationHelpers?.getMarkerColor?.(true) || 0xffaa00,
            isMap2dLiteProxy: true
        }
    };
}

/**
 * Find the marker associated with an event.
 *
 * In globe view: scans SceneModel.getMarkers() for a Three.js marker whose
 * userData.event matches by name or by (locationType, lat/lon, x/y).
 * In map view: scans Map2DLiteLayer's earth/moon/mars/orbit marker
 * containers; returns the matching DOM-backed stub or a synthesized one.
 *
 * @param {Object} event - The event object to look up.
 * @param {number} globalEventIndex - Global timeline index (used by stubs).
 * @returns {Object|null} The marker (real or stub), or null if no scene model.
 */
export function findMarkerForEvent(event, globalEventIndex) {
    if (!event) return null;

    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel) return null;

    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;

    if (isMapView) {
        const map2dLite = window.globeController?.map2dLite;
        if (!map2dLite) return createStubForMapView(event, globalEventIndex);

        const containers = [
            map2dLite.markersEl,
            map2dLite._moonMarkersEl,
            map2dLite._marsMarkersEl,
            map2dLite._orbitMarkersEl
        ];

        for (const container of containers) {
            if (!container) continue;
            const buttons = container.querySelectorAll('.map-2d-lite__marker');
            for (const btn of buttons) {
                const identity = btn.__map2dLiteIdentity;
                if (!identity) continue;

                const markerEvent = identity.event;
                if (!markerEvent) continue;

                const nameMatch = markerEvent.name === event.name;
                const locationMatch =
                    markerEvent.locationType === event.locationType &&
                    markerEvent.lat === event.lat &&
                    markerEvent.lon === event.lon &&
                    markerEvent.x === event.x &&
                    markerEvent.y === event.y;

                if (nameMatch || locationMatch) {
                    const stub = btn.__map2dLiteStub || createStubForMapView(event, globalEventIndex);
                    stub.__domMarkerButton = btn;
                    return stub;
                }
            }
        }

        return createStubForMapView(event, globalEventIndex);
    }

    const markers = sceneModel.getMarkers?.() || [];

    for (const marker of markers) {
        if (!marker.userData?.isEventMarker) continue;

        const markerEvent = marker.userData.event;
        if (!markerEvent) continue;

        const nameMatch = markerEvent.name === event.name;
        const locationMatch =
            markerEvent.locationType === event.locationType &&
            markerEvent.lat === event.lat &&
            markerEvent.lon === event.lon;

        if (nameMatch || locationMatch) {
            return marker;
        }
    }

    return null;
}
