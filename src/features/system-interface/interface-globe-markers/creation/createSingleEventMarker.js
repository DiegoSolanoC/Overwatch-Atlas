import { calculateMarkerPosition } from './calculateMarkerPosition.js';
import { createMarkerMesh } from './createMarkerMesh.js';
import { createMarkerUserData } from './createMarkerUserData.js';
import { shouldEventBeLocked } from '../filtering/shouldEventBeLocked.js';
import { getMarkerRadius } from '../styling/markerSizes.js';
import { getMarkerColor, EVENT_MARKER_LOCKED_HEX } from '../styling/markerColors.js';
import { createPinLinePoints } from './pin-lines/createPinLinePoints.js';
import { createPinLine } from './pin-lines/createPinLineMesh.js';
import {
    attachEventMarkerToSceneList,
    stationShipWantsEarthMapScaleBoost,
    webglMarkerRadiusLocationType
} from './eventMarkerSceneAttach.js';

/**
 * @param {Object} params
 * @returns {{marker: THREE.Mesh, pinLine: THREE.Line|null}|null}
 */
export function createSingleEventMarker({ event, sceneModel, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite, animate }) {
    const eventLocationType = event.locationType || 'earth';
    const isMapView = sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    if (isMapView && eventLocationType === 'earth') {
        return null;
    }
    const mapScaleFactor = 1;
    const wantsMapScaleBoost = stationShipWantsEarthMapScaleBoost(isMapView, eventLocationType, sceneModel);

    const positionData = calculateMarkerPosition({
        locationType: eventLocationType,
        lat: event.lat,
        lon: event.lon,
        x: event.x,
        y: event.y,
        globe, moonPlane, marsPlane, issSatellite, marsShipSatellite
    });

    if (!positionData) {
        return null;
    }

    const { position, targetParent } = positionData;

    const markerRadius = getMarkerRadius(true, webglMarkerRadiusLocationType(eventLocationType, sceneModel));
    const markerColor = getMarkerColor(true);

    const marker = createMarkerMesh({ radius: markerRadius, color: markerColor, position, flatOnPlane: isMapView });

    const displayName = event.name || 'Event';

    const activeFilters = window.standaloneActiveFilters || new Set();
    const shouldBeLocked = shouldEventBeLocked(event, activeFilters);

    if (animate) {
        marker.scale.set(0, 0, 0);
    } else if (shouldBeLocked) {
        const s = (wantsMapScaleBoost ? mapScaleFactor : 1.0) * 0.75;
        marker.scale.set(s, s, s);
        marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
    }

    marker.userData = {
        event: event,
        eventName: displayName,
        locationType: eventLocationType,
        lat: eventLocationType === 'earth' ? event.lat : undefined,
        lon: eventLocationType === 'earth' ? event.lon : undefined,
        x: eventLocationType !== 'earth' ? (event.x !== undefined ? event.x : undefined) : undefined,
        y: eventLocationType !== 'earth' ? (event.y !== undefined ? event.y : undefined) : undefined,
        isEventMarker: true,
        isInteractive: true,
        isMainVariant: true,
        pulseRings: [],
        isLocked: shouldBeLocked,
        originalScale: wantsMapScaleBoost ? mapScaleFactor : 1.0,
        originalColor: markerColor,
        ...(isMapView ? { isFlatMapEventMarker: true } : {})
    };

    if (!animate && !shouldBeLocked && marker.userData.originalScale !== 1.0) {
        const s = marker.userData.originalScale;
        marker.scale.set(s, s, s);
    }

    targetParent.add(marker);
    attachEventMarkerToSceneList(sceneModel, marker, { isMapView, targetParent, globe });

    let pinLine = null;
    if (isMapView) {
        return { marker, pinLine };
    }

    const pinLineData = createPinLinePoints({
        locationType: eventLocationType,
        markerPosition: position,
        lat: eventLocationType === 'earth' ? event.lat : undefined,
        lon: eventLocationType === 'earth' ? event.lon : undefined,
        globe, moonPlane, marsPlane, issSatellite, marsShipSatellite
    });

    if (pinLineData) {
        const lineColor = shouldBeLocked ? EVENT_MARKER_LOCKED_HEX : markerColor;
        pinLine = createPinLine({
            linePoints: pinLineData.linePoints,
            color: lineColor,
            animate,
            marker
        });

        pinLineData.lineParent.add(pinLine);
        marker.userData.pinLine = pinLine;
    }

    return { marker, pinLine };
}
