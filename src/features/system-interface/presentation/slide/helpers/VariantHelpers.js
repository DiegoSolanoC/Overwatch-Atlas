/**
 * VariantHelpers - Utilities for handling event variants
 * Extracted from EventSlideManager
 */

/**
 * Finds the marker for a specific variant
 * @param {Object} sceneModel - Scene model instance
 * @param {Object} eventData - Event data
 * @param {number} variantIndex - Variant index
 * @returns {Object|null} - The variant marker or null
 */
export function findVariantMarker(sceneModel, eventData, variantIndex) {
    if (!window.globeController || !window.globeController.interactionController) {
        return null;
    }

    const mapOn = sceneModel.getMapViewEnabled?.() ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
    if (mapOn && window.globeController.map2dLite?.getStubForVariant) {
        const stub = window.globeController.map2dLite.getStubForVariant(eventData, variantIndex);
        if (stub) return stub;
    }

    const markers = sceneModel.getMarkers();
    
    // Try to find the marker for this specific variant
    for (const marker of markers) {
        if (marker.userData.isEventMarker &&
            marker.userData.event === eventData &&
            marker.userData.variantIndex === variantIndex) {
            return marker;
        }
    }
    
    // If no variant-specific marker found, use the main marker
    // (for backward compatibility with events that don't have variant-specific markers yet)
    for (const marker of markers) {
        if (marker.userData.isEventMarker &&
            marker.userData.event === eventData &&
            (marker.userData.isMainVariant || marker.userData.variantIndex === 0)) {
            return marker;
        }
    }
    
    return null;
}

/**
 * Creates a temporary marker for zooming to coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object|null} - Temporary marker object or null
 */
export function createTempMarkerForCoords(lat, lon) {
    const THREE = window.THREE;
    if (!THREE) return null;
    
    const tempMarker = new THREE.Object3D();
    tempMarker.userData = {
        lat: lat,
        lon: lon,
        isEventMarker: true
    };
    
    // Calculate position using lat/lon (same formula as latLonToVector3)
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const radius = 1.02;
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    tempMarker.position.set(x, y, z);
    
    return tempMarker;
}

/**
 * Handles zooming to a variant based on location type
 * @param {Object} variantMarker - Variant marker (can be null)
 * @param {string} locationType - Location type
 * @param {number} lat - Latitude (for Earth)
 * @param {number} lon - Longitude (for Earth)
 */
export function zoomToVariantLocation(variantMarker, locationType, lat = null, lon = null) {
    if (!window.globeController || !window.globeController.interactionController) {
        return;
    }
    
    const controller = window.globeController.interactionController;
    
    if (variantMarker) {
        if (locationType === 'moon' || locationType === 'mars') {
            controller.resetCameraToDefault();
        } else if (locationType === 'station' || locationType === 'marsShip') {
            // Guard rail: check if on orbit panel
            const sceneModel = window.globeController?.sceneModel;
            const orbitMarkerParent = sceneModel?.getOrbitMarkerParent ? sceneModel.getOrbitMarkerParent() : sceneModel?.orbitPlane;
            const isOnOrbitPanel = orbitMarkerParent && variantMarker.parent === orbitMarkerParent;
            
            if (isOnOrbitPanel) {
                // Treat like moon/mars - reset camera instead of following
                controller.resetCameraToDefault();
            } else {
                controller.setPlanesVisibility(false);
                controller.startFollowingStation(variantMarker);
            }
        } else {
            controller.zoomToMarker(variantMarker);
        }
    } else if (locationType === 'earth' && lat !== undefined && lon !== undefined) {
        // Fallback: create a temporary marker to zoom to (Earth only)
        const tempMarker = createTempMarkerForCoords(lat, lon);
        if (tempMarker) {
            controller.zoomToMarker(tempMarker);
        }
    } else if (locationType === 'moon' || locationType === 'mars') {
        // For Moon/Mars without marker, just reset camera
        controller.resetCameraToDefault();
    }
}
