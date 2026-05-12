/**
 * Find an existing event marker (WebGL or DOM) for a given event, or synthesize a map-view stub.
 * Used by dock thumbnails / pagination to drive hover, highlight, and zoom from the event strip.
 */
import { shouldEventBeLocked } from './filtering/shouldEventBeLocked.js';
import { getMarkerColor } from './styling/markerColors.js';

/**
 * Stub marker when Map2DLite has no DOM button yet for this event.
 */
export function createStubForMapView(event) {
    if (!event) return null;

    const filters = window.standaloneActiveFilters || new Set();
    const locked = filters.size > 0 ? shouldEventBeLocked(event, filters) : false;

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
            originalColor: getMarkerColor(true),
            isMap2dLiteProxy: true
        }
    };
}

/**
 * @param {Object} event
 * @param {number} _globalEventIndex reserved for callers that pass timeline index
 * @returns {Object|null}
 */
export function findMarkerForEvent(event, _globalEventIndex) {
    if (!event) return null;

    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel) return null;

    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;

    if (isMapView) {
        const map2dLite = window.globeController?.map2dLite;
        if (!map2dLite) return createStubForMapView(event);

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
                    const stub = btn.__map2dLiteStub || createStubForMapView(event);
                    stub.__domMarkerButton = btn;
                    return stub;
                }
            }
        }

        return createStubForMapView(event);
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
