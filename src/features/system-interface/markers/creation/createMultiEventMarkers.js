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
 * @returns {Array<{marker: THREE.Mesh, pinLine: THREE.Line|null, isMainVariant: boolean}>}
 */
export function createMultiEventMarkers({ event, sceneModel, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite, animate }) {
    const results = [];
    const eventLocationType = event.locationType || 'earth';
    const isMapView = sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    const mapScaleFactor = 1;
    const activeFilters = window.standaloneActiveFilters || new Set();
    const shouldBeLocked = shouldEventBeLocked(event, activeFilters);

    event.variants.forEach((variant, variantIndex) => {
        const variantLocationType = variant.locationType || eventLocationType;
        if (isMapView && variantLocationType === 'earth') {
            return;
        }

        const lat = variant.lat !== undefined ? variant.lat : event.lat;
        const lon = variant.lon !== undefined ? variant.lon : event.lon;
        const x = variant.x !== undefined ? variant.x : (event.x !== undefined ? event.x : undefined);
        const y = variant.y !== undefined ? variant.y : (event.y !== undefined ? event.y : undefined);

        const positionData = calculateMarkerPosition({
            locationType: variantLocationType,
            lat, lon, x, y,
            globe, moonPlane, marsPlane, issSatellite, marsShipSatellite
        });

        if (!positionData) {
            return;
        }

        const { position, targetParent } = positionData;

        const isMainVariant = variantIndex === 0;

        const markerRadius = getMarkerRadius(isMainVariant, webglMarkerRadiusLocationType(variantLocationType, sceneModel));
        const markerColor = getMarkerColor(isMainVariant);
        const isInteractive = isMainVariant;

        const marker = createMarkerMesh({ radius: markerRadius, color: markerColor, position, flatOnPlane: isMapView });

        const displayName = variant.name || `Variant ${variantIndex + 1}`;

        if (animate) {
            marker.scale.set(0, 0, 0);
        } else if (shouldBeLocked) {
            const wantsMapScaleBoost = stationShipWantsEarthMapScaleBoost(isMapView, variantLocationType, sceneModel);
            const s = (wantsMapScaleBoost ? mapScaleFactor : 1.0) * 0.75;
            marker.scale.set(s, s, s);
            marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
        }

        marker.userData = createMarkerUserData({
            event,
            variant,
            variantIndex,
            displayName,
            locationType: variantLocationType,
            lat: variantLocationType === 'earth' ? lat : undefined,
            lon: variantLocationType === 'earth' ? lon : undefined,
            x: variantLocationType !== 'earth' ? x : undefined,
            y: variantLocationType !== 'earth' ? y : undefined,
            isInteractive,
            isMainVariant,
            shouldBeLocked,
            originalColor: markerColor
        });

        const wantsMapScaleBoost = stationShipWantsEarthMapScaleBoost(isMapView, variantLocationType, sceneModel);
        if (wantsMapScaleBoost) {
            marker.userData.originalScale = mapScaleFactor;
            if (!animate && !shouldBeLocked) {
                marker.scale.set(mapScaleFactor, mapScaleFactor, mapScaleFactor);
            }
        }
        if (isMapView) {
            marker.userData.isFlatMapEventMarker = true;
        }

        if (!isMainVariant) {
            marker.visible = false;
        }

        targetParent.add(marker);
        attachEventMarkerToSceneList(sceneModel, marker, { isMapView, targetParent, globe });

        let pinLine = null;
        if (isMainVariant && !isMapView) {
            const pinLineData = createPinLinePoints({
                locationType: variantLocationType,
                markerPosition: position,
                lat: variantLocationType === 'earth' ? lat : undefined,
                lon: variantLocationType === 'earth' ? lon : undefined,
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
        }

        results.push({ marker, pinLine, isMainVariant });
    });

    return results;
}
