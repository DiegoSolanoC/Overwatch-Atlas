/**
 * MarkerCreationLogicHelpers - Utilities for creating single and multi-event markers
 * Extracted from EventMarkerManager to reduce duplication
 */

import { calculateMarkerPosition } from './MarkerPositionHelpers.js';
import {
    createMarkerMesh,
    createMarkerUserData,
    shouldEventBeLocked,
    getMarkerRadius,
    getMarkerColor,
    EVENT_MARKER_LOCKED_HEX
} from './MarkerCreationHelpers.js';
import { createPinLinePoints, createPinLine } from './PinLineHelpers.js';
import { EARTH_GLOBE_LIGHT_LAYER } from '../../../worldview/constants/GlobeLightingConstants.js';
import { useOrbitPanelForStationShipMarkers } from './TransportOrbitPanelHelpers.js';

function stationShipOnOrbitPanel(sceneModel, locationType) {
    return (locationType === 'station' || locationType === 'marsShip')
        && sceneModel
        && useOrbitPanelForStationShipMarkers(sceneModel);
}

/** Map view: old station/ship dots scaled with Earth plane; orbit-panel mode matches Moon/Mars. */
function stationShipWantsEarthMapScaleBoost(isMapView, locationType, sceneModel) {
    return isMapView && (locationType === 'station' || locationType === 'marsShip')
        && !stationShipOnOrbitPanel(sceneModel, locationType);
}

function webglMarkerRadiusLocationType(locationType, sceneModel) {
    if (stationShipOnOrbitPanel(sceneModel, locationType)) return 'moon';
    return locationType;
}

function attachEventMarkerToSceneList(sceneModel, marker, { isMapView, targetParent, globe }) {
    const markers = sceneModel.getMarkers();
    if (markers.indexOf(marker) === -1) {
        markers.push(marker);
    }
    if (isMapView && globe && targetParent === globe && marker.layers) {
        marker.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    }
}

/**
 * Creates a marker for a single event
 * @param {Object} params - Parameters
 * @param {Object} params.event - Event object
 * @param {Object} params.sceneModel - SceneModel instance
 * @param {Object} params.globe - Globe object
 * @param {Object} params.moonPlane - Moon plane object
 * @param {Object} params.marsPlane - Mars plane object
 * @param {Object} params.issSatellite - ISS satellite object
 * @param {boolean} params.animate - Whether to animate
 * @returns {Object|null} - Object with marker and pinLine, or null if creation failed
 */
export function createSingleEventMarker({ event, sceneModel, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite, animate }) {
    const eventLocationType = event.locationType || 'earth';
    const isMapView = sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    if (isMapView && eventLocationType === 'earth') {
        return null;
    }
    const mapScaleFactor = 1;
    const wantsMapScaleBoost = stationShipWantsEarthMapScaleBoost(isMapView, eventLocationType, sceneModel);
    
    // Calculate position using helper
    const positionData = calculateMarkerPosition({
        locationType: eventLocationType,
        lat: event.lat,
        lon: event.lon,
        x: event.x,
        y: event.y,
        globe, moonPlane, marsPlane, issSatellite, marsShipSatellite
    });
    
    if (!positionData) {
        return null; // Helper already logged warning
    }
    
    const { position, targetParent } = positionData;
    
    // Get marker properties using helpers
    const markerRadius = getMarkerRadius(true, webglMarkerRadiusLocationType(eventLocationType, sceneModel));
    const markerColor = getMarkerColor(true); // Orange
    
    // Create marker using helper
    const marker = createMarkerMesh({ radius: markerRadius, color: markerColor, position, flatOnPlane: isMapView });
    
    const displayName = event.name || 'Event';
    
    // Check if this event should be locked using helper
    // NOTE: Use standaloneActiveFilters only - removed sceneModel.activeFilters
    const activeFilters = window.standaloneActiveFilters || new Set();
    const shouldBeLocked = shouldEventBeLocked(event, activeFilters);
    
    // Set initial scale based on animation and locked state
    if (animate) {
        marker.scale.set(0, 0, 0);
    } else if (shouldBeLocked) {
        // If locked and not animating, start at locked scale
        const s = (wantsMapScaleBoost ? mapScaleFactor : 1.0) * 0.75;
        marker.scale.set(s, s, s);
        // Set locked color immediately
        marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
    }
    
    marker.userData = { 
        event: event, // Store full event object
        eventName: displayName,
        locationType: eventLocationType,
        lat: eventLocationType === 'earth' ? event.lat : undefined,
        lon: eventLocationType === 'earth' ? event.lon : undefined,
        x: eventLocationType !== 'earth' ? (event.x !== undefined ? event.x : undefined) : undefined,
        y: eventLocationType !== 'earth' ? (event.y !== undefined ? event.y : undefined) : undefined,
        isEventMarker: true,
        isInteractive: true, // Single events are always interactive
        isMainVariant: true,
        pulseRings: [], // Store pulse rings for this marker
        isLocked: shouldBeLocked, // Set initial locked state based on filters
        originalScale: wantsMapScaleBoost ? mapScaleFactor : 1.0, // Store original scale for unlocking
        originalColor: markerColor,
        // createMarkerMesh sets this, but replacing userData clears it — required for map pulse sizing / draw order.
        ...(isMapView ? { isFlatMapEventMarker: true } : {})
    };

    // If not animating and not locked, apply the intended base scale now.
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

    // Add pin line using helper (globe view only — map uses flat markers on the surface)
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
        // Store pin line reference in marker userData for overlap cycling
        marker.userData.pinLine = pinLine;
    }
    
    return { marker, pinLine };
}

/**
 * Creates markers for a multi-event (all variants)
 * @param {Object} params - Parameters
 * @param {Object} params.event - Event object
 * @param {Object} params.sceneModel - SceneModel instance
 * @param {Object} params.globe - Globe object
 * @param {Object} params.moonPlane - Moon plane object
 * @param {Object} params.marsPlane - Mars plane object
 * @param {Object} params.issSatellite - ISS satellite object
 * @param {boolean} params.animate - Whether to animate
 * @returns {Array} - Array of objects with marker and pinLine (only main variants have pinLines)
 */
export function createMultiEventMarkers({ event, sceneModel, globe, moonPlane, marsPlane, issSatellite, marsShipSatellite, animate }) {
    const results = [];
    const eventLocationType = event.locationType || 'earth';
    const isMapView = sceneModel.getMapViewEnabled ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    const mapScaleFactor = 1;
    // NOTE: Use standaloneActiveFilters only - removed sceneModel.activeFilters
    const activeFilters = window.standaloneActiveFilters || new Set();
    const shouldBeLocked = shouldEventBeLocked(event, activeFilters);
    
    event.variants.forEach((variant, variantIndex) => {
        // Get location type from variant if available, otherwise use event location type
        const variantLocationType = variant.locationType || eventLocationType;
        if (isMapView && variantLocationType === 'earth') {
            return;
        }

        // Calculate position using helper
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
            return; // Helper already logged warning
        }
        
        const { position, targetParent } = positionData;
        
        const isMainVariant = variantIndex === 0;
        
        // Get marker properties using helpers
        const markerRadius = getMarkerRadius(isMainVariant, webglMarkerRadiusLocationType(variantLocationType, sceneModel));
        const markerColor = getMarkerColor(isMainVariant);
        const isInteractive = isMainVariant;
        
        // Create marker using helper
        const marker = createMarkerMesh({ radius: markerRadius, color: markerColor, position, flatOnPlane: isMapView });
        
        const displayName = variant.name || `Variant ${variantIndex + 1}`;
        
        // Set initial scale based on animation and locked state
        if (animate) {
            marker.scale.set(0, 0, 0);
        } else if (shouldBeLocked) {
            // If locked and not animating, start at locked scale
            const wantsMapScaleBoost = stationShipWantsEarthMapScaleBoost(isMapView, variantLocationType, sceneModel);
            const s = (wantsMapScaleBoost ? mapScaleFactor : 1.0) * 0.75;
            marker.scale.set(s, s, s);
            // Set locked color immediately
            marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
        }
        
        // Create userData using helper
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

        // Hide variant markers by default (only show when event is open)
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
                // Store pin line reference in marker userData for overlap cycling
                marker.userData.pinLine = pinLine;
            }
        }
        
        results.push({ marker, pinLine, isMainVariant });
    });
    
    return results;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.MarkerCreationLogicHelpers) {
        window.MarkerCreationLogicHelpers = {};
    }
    window.MarkerCreationLogicHelpers.createSingleEventMarker = createSingleEventMarker;
    window.MarkerCreationLogicHelpers.createMultiEventMarkers = createMultiEventMarkers;
}
